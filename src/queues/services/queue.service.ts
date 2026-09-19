import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { withTimeout } from '../../common/utils/async.util';
import { errorMessage } from '../../common/utils/error.util';
import { AppConfig } from '../../config/configuration';
import { QueuedExecutionJob, WorkflowJobData } from '../interfaces/workflow-job.interface';
import { EXECUTE_WORKFLOW_JOB, REDIS_OPERATION_TIMEOUT_MS, WORKFLOW_QUEUE_NAME } from '../queue.constants';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
    // Retries happen per step inside the runner. Retrying a whole job would repeat
    // steps that already succeeded (and their side effects), so jobs run once.
    attempts: 1,
    removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
    removeOnFail: { age: 7 * 24 * 60 * 60 },
};

/** Producer side of the workflow queue, used by the API. */
@Injectable()
export class QueueService implements OnModuleDestroy {
    private readonly logger = new Logger(QueueService.name);
    private readonly connection: Redis;
    readonly queue: Queue<WorkflowJobData>;

    constructor(config: ConfigService<AppConfig, true>) {
        // Fail fast instead of buffering commands while Redis is unreachable,
        // so API requests return 503 promptly rather than hanging.
        this.connection = new Redis(config.get('redis', { infer: true }).url, {
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
        });
        this.queue = new Queue<WorkflowJobData>(WORKFLOW_QUEUE_NAME, {
            connection: this.connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
        });
        // BullMQ re-emits connection errors on the queue and falls back to console.error when
        // nothing listens, so route them through the application logger instead.
        this.queue.on('error', (error) => this.logger.warn(`Redis connection error: ${error.message}`));
    }

    /** Enqueues an execution that already has a database row. The execution id doubles as the job id, so enqueueing is idempotent. */
    async enqueueExecution(job: QueuedExecutionJob): Promise<void> {
        await this.runRedisOperation('enqueue execution', () =>
            this.queue.add(EXECUTE_WORKFLOW_JOB, job, { jobId: job.executionId }),
        );
    }

    async ping(): Promise<void> {
        await withTimeout(this.connection.ping(), REDIS_OPERATION_TIMEOUT_MS, 'Redis ping timed out');
    }

    /** Runs a Redis operation with a timeout, translating any failure into HTTP 503. */
    async runRedisOperation<T>(action: string, operation: () => Promise<T>): Promise<T> {
        try {
            return await withTimeout(operation(), REDIS_OPERATION_TIMEOUT_MS);
        } catch (error) {
            this.logger.error(`Failed to ${action}: ${errorMessage(error)}`);
            throw new ServiceUnavailableException('The job queue is temporarily unavailable. Please retry shortly.');
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.queue.close();
        await this.connection.quit().catch(() => this.connection.disconnect());
    }
}
