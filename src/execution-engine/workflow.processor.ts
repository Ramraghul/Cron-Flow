import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { errorMessage } from '../common/utils/error.util';
import { AppConfig } from '../config/configuration';
import { ExecutionsRepository } from '../executions/repositories/executions.repository';
import { WorkflowJobData } from '../queues/interfaces/workflow-job.interface';
import { WORKFLOW_QUEUE_NAME } from '../queues/queue.constants';
import { RunOutcome, WorkflowRunnerService } from './services/workflow-runner.service';

/**
 * Owns the BullMQ worker. Runs inside the API when WORKER_ENABLED=true, or on its own via
 * `node dist/worker.js` so API and workers scale independently.
 */
@Injectable()
export class WorkflowProcessor implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WorkflowProcessor.name);
    private worker?: Worker<WorkflowJobData, RunOutcome>;
    private connection?: Redis;

    constructor(
        private readonly runner: WorkflowRunnerService,
        private readonly repository: ExecutionsRepository,
        private readonly config: ConfigService<AppConfig, true>,
    ) {}

    onModuleInit(): void {
        const { enabled, concurrency } = this.config.get('worker', { infer: true });
        if (!enabled) {
            this.logger.log('Worker disabled in this process (WORKER_ENABLED=false)');
            return;
        }

        // Workers issue blocking Redis commands, for which BullMQ requires unlimited retries.
        this.connection = new Redis(this.config.get('redis', { infer: true }).url, { maxRetriesPerRequest: null });

        this.worker = new Worker<WorkflowJobData, RunOutcome>(WORKFLOW_QUEUE_NAME, (job) => this.process(job), {
            connection: this.connection,
            concurrency,
        });
        this.worker.on('failed', (job, error) => this.logger.error(`Job ${job?.id ?? 'unknown'} failed: ${error.message}`));
        this.worker.on('error', (error) => this.logger.error(`Worker error: ${error.message}`));

        this.logger.log(`Worker consuming "${WORKFLOW_QUEUE_NAME}" with concurrency ${concurrency}`);
    }

    async process(job: Job<WorkflowJobData>): Promise<RunOutcome> {
        try {
            return await this.runner.run(job.data);
        } catch (error) {
            // Infrastructure failure (e.g. database unreachable): don't leave the execution RUNNING forever.
            const { executionId } = job.data;
            if (executionId) {
                await this.repository
                    .failInterrupted(executionId, `Internal error: ${errorMessage(error)}`)
                    .catch((markError: unknown) =>
                        this.logger.error(`Could not mark execution ${executionId} as failed: ${errorMessage(markError)}`),
                    );
            }
            throw error;
        }
    }

    async onModuleDestroy(): Promise<void> {
        // close() waits for in-flight jobs, so a deploy doesn't cut executions off mid-step.
        await this.worker?.close();
        await this.connection?.quit().catch(() => this.connection?.disconnect());
    }
}
