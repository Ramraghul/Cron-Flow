import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../queues/services/queue.service';

@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly queueService: QueueService,
        private readonly schedulerRegistry: SchedulerRegistry,
    ) {}

    async onApplicationBootstrap() {
        await this.loadAndRegisterAll();
    }

    onApplicationShutdown() {
        this.unregisterAll();
    }

    // ── Public API used by WorkflowService ─────────────────────────────────

    register(workflowId: string, cronExpression: string) {
        this.unregister(workflowId); // idempotent
        const job = new CronJob(cronExpression, () => this.dispatch(workflowId));
        this.schedulerRegistry.addCronJob(workflowId, job);
        job.start();
        this.logger.log(`Registered cron job for workflow ${workflowId}: ${cronExpression}`);
    }

    unregister(workflowId: string) {
        try {
            this.schedulerRegistry.deleteCronJob(workflowId);
            this.logger.log(`Unregistered cron job for workflow ${workflowId}`);
        } catch (_) {
            // Job didn't exist — ignore
        }
    }

    listJobs(): Array<{ workflowId: string; nextRun: Date | null; running: boolean }> {
        const jobs = this.schedulerRegistry.getCronJobs();
        const result: Array<{ workflowId: string; nextRun: Date | null; running: boolean }> = [];
        jobs.forEach((job, name) => {
            result.push({
                workflowId: name,
                nextRun: job.nextDate()?.toJSDate() ?? null,
                running: job.running ?? false,
            });
        });
        return result;
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private async loadAndRegisterAll() {
        const workflows = await this.prisma.workflow.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, cronExpression: true },
        });
        for (const wf of workflows) {
            try {
                this.register(wf.id, wf.cronExpression);
            } catch (err: any) {
                this.logger.warn(`Invalid cron for workflow ${wf.id}: ${err.message}`);
            }
        }
        this.logger.log(`Scheduler loaded ${workflows.length} active workflow(s)`);
    }

    private unregisterAll() {
        const jobs = this.schedulerRegistry.getCronJobs();
        jobs.forEach((_, name) => this.unregister(name));
    }

    private async dispatch(workflowId: string) {
        try {
            const execution = await this.prisma.execution.create({
                data: { workflowId, triggerType: 'CRON' },
            });
            await this.queueService.addWorkflowJob({
                executionId: execution.id,
                workflowId,
            });
            this.logger.log(`Cron dispatched execution ${execution.id} for workflow ${workflowId}`);
        } catch (err: any) {
            this.logger.error(`Failed to dispatch cron job for workflow ${workflowId}: ${err.message}`);
        }
    }
}
