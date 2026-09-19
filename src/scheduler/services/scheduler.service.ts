import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TriggerType, Workflow, WorkflowStatus } from '@prisma/client';
import { errorMessage } from '../../common/utils/error.util';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { EXECUTE_WORKFLOW_JOB } from '../../queues/queue.constants';
import { QueueService } from '../../queues/services/queue.service';
import { ScheduleDto } from '../dto/schedule-response.dto';

export type WorkflowSchedule = Pick<Workflow, 'id' | 'cronExpression' | 'timezone'>;

export interface ReconcileResult {
    registered: number;
    removed: number;
    failed: number;
}

/** BullMQ job ids may not contain ':', so a dash separates the prefix. */
const SCHEDULER_ID_PREFIX = 'workflow-';

export function schedulerIdFor(workflowId: string): string {
    return `${SCHEDULER_ID_PREFIX}${workflowId}`;
}

function workflowIdFromSchedulerId(schedulerId: string): string | null {
    return schedulerId.startsWith(SCHEDULER_ID_PREFIX) ? schedulerId.slice(SCHEDULER_ID_PREFIX.length) : null;
}

/**
 * Cron scheduling via BullMQ job schedulers. Schedules live in Redis rather than in process
 * memory, so any number of API replicas can run without firing a workflow more than once.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private readonly queueService: QueueService,
        private readonly prisma: PrismaService,
        private readonly config: ConfigService<AppConfig, true>,
    ) {}

    onApplicationBootstrap(): void {
        if (!this.config.get('scheduler', { infer: true }).syncOnBoot) {
            return;
        }

        // Not awaited: the HTTP server must start even if Redis is slow or down.
        // The readiness probe reports Redis health in the meantime.
        this.reconcile()
            .then(({ registered, removed, failed }) =>
                this.logger.log(`Schedules reconciled: ${registered} registered, ${removed} removed, ${failed} failed`),
            )
            .catch((error: unknown) => this.logger.error(`Schedule reconciliation failed: ${errorMessage(error)}`));
    }

    /** Creates or updates a workflow's schedule. Idempotent. Throws 503 if Redis is unavailable. */
    async upsertSchedule(workflow: WorkflowSchedule): Promise<void> {
        await this.queueService.runRedisOperation(`register schedule for workflow ${workflow.id}`, () =>
            this.registerJobScheduler(workflow),
        );
    }

    /** Removes a workflow's schedule if one exists. Throws 503 if Redis is unavailable. */
    async removeSchedule(workflowId: string): Promise<void> {
        await this.queueService.runRedisOperation(`remove schedule for workflow ${workflowId}`, () =>
            this.queueService.queue.removeJobScheduler(schedulerIdFor(workflowId)),
        );
    }

    /** Schedules for a user's ACTIVE workflows, with next-run times read from Redis. */
    async listForUser(userId: string): Promise<ScheduleDto[]> {
        const workflows = await this.prisma.workflow.findMany({
            where: { userId, status: WorkflowStatus.ACTIVE },
            select: { id: true, name: true, cronExpression: true, timezone: true },
            orderBy: { createdAt: 'desc' },
        });

        const schedulers = await this.queueService.runRedisOperation('list schedules', () =>
            Promise.all(workflows.map((workflow) => this.queueService.queue.getJobScheduler(schedulerIdFor(workflow.id)))),
        );

        return workflows.map((workflow, index) => {
            const scheduler = schedulers[index];
            return {
                workflowId: workflow.id,
                workflowName: workflow.name,
                cronExpression: workflow.cronExpression,
                timezone: workflow.timezone,
                registered: Boolean(scheduler),
                nextRunAt: scheduler?.next ? new Date(scheduler.next) : null,
            };
        });
    }

    /**
     * Makes Redis match PostgreSQL: registers every ACTIVE workflow and removes schedules for
     * workflows that were paused or deleted while Redis was unreachable.
     */
    async reconcile(): Promise<ReconcileResult> {
        const activeWorkflows = await this.prisma.workflow.findMany({
            where: { status: WorkflowStatus.ACTIVE },
            select: { id: true, cronExpression: true, timezone: true },
        });
        const activeIds = new Set(activeWorkflows.map((workflow) => workflow.id));

        const result: ReconcileResult = { registered: 0, removed: 0, failed: 0 };

        for (const scheduler of await this.queueService.queue.getJobSchedulers(0, -1)) {
            const workflowId = workflowIdFromSchedulerId(scheduler.key);
            if (workflowId && !activeIds.has(workflowId)) {
                await this.queueService.queue.removeJobScheduler(scheduler.key);
                result.removed++;
            }
        }

        for (const workflow of activeWorkflows) {
            try {
                await this.registerJobScheduler(workflow);
                result.registered++;
            } catch (error) {
                result.failed++;
                this.logger.warn(`Could not schedule workflow ${workflow.id}: ${errorMessage(error)}`);
            }
        }

        return result;
    }

    private async registerJobScheduler(workflow: WorkflowSchedule): Promise<void> {
        await this.queueService.queue.upsertJobScheduler(
            schedulerIdFor(workflow.id),
            { pattern: workflow.cronExpression, tz: workflow.timezone },
            { name: EXECUTE_WORKFLOW_JOB, data: { workflowId: workflow.id, triggerType: TriggerType.CRON } },
        );
    }
}
