import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { TriggerType } from '@prisma/client';
import { Job, JobSchedulerJson, Queue } from 'bullmq';
import { createConfigMock, createMock, flushPromises } from '../../../test/utils/mocks';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowJobData } from '../../queues/interfaces/workflow-job.interface';
import { EXECUTE_WORKFLOW_JOB } from '../../queues/queue.constants';
import { QueueService } from '../../queues/services/queue.service';
import { schedulerIdFor, SchedulerService } from './scheduler.service';

function schedulerJson(key: string, next?: number): JobSchedulerJson<WorkflowJobData> {
    return { key, name: EXECUTE_WORKFLOW_JOB, next };
}

describe('SchedulerService', () => {
    let queue: jest.Mocked<Queue<WorkflowJobData>>;
    let runRedisOperation: jest.Mock;
    let findManyWorkflows: jest.Mock;

    function createService(syncOnBoot = false): SchedulerService {
        const queueService = { queue, runRedisOperation } as unknown as QueueService;
        const prisma = { workflow: { findMany: findManyWorkflows } } as unknown as PrismaService;
        return new SchedulerService(queueService, prisma, createConfigMock({ scheduler: { syncOnBoot } }));
    }

    beforeEach(() => {
        queue = createMock<Queue<WorkflowJobData>>([
            'upsertJobScheduler',
            'removeJobScheduler',
            'getJobScheduler',
            'getJobSchedulers',
        ]);
        queue.upsertJobScheduler.mockResolvedValue({} as Job<WorkflowJobData>);
        queue.removeJobScheduler.mockResolvedValue(true);
        runRedisOperation = jest.fn((_action: string, operation: () => Promise<unknown>) => operation());
        findManyWorkflows = jest.fn();
    });

    it('derives BullMQ-safe scheduler ids from workflow ids', () => {
        expect(schedulerIdFor('cm0x8b1f4')).toBe('workflow-cm0x8b1f4');
        expect(schedulerIdFor('cm0x8b1f4')).not.toContain(':');
    });

    describe('upsertSchedule', () => {
        it('registers a cron job scheduler that enqueues CRON jobs in the workflow timezone', async () => {
            await createService().upsertSchedule({ id: 'w1', cronExpression: '0 2 * * *', timezone: 'Europe/London' });

            expect(runRedisOperation).toHaveBeenCalledWith('register schedule for workflow w1', expect.any(Function));
            expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
                'workflow-w1',
                { pattern: '0 2 * * *', tz: 'Europe/London' },
                { name: EXECUTE_WORKFLOW_JOB, data: { workflowId: 'w1', triggerType: TriggerType.CRON } },
            );
        });

        it('surfaces Redis failures as 503', async () => {
            runRedisOperation.mockRejectedValue(new ServiceUnavailableException());

            await expect(
                createService().upsertSchedule({ id: 'w1', cronExpression: '0 2 * * *', timezone: 'UTC' }),
            ).rejects.toBeInstanceOf(ServiceUnavailableException);
        });
    });

    describe('removeSchedule', () => {
        it('removes the scheduler for the workflow', async () => {
            await createService().removeSchedule('w1');

            expect(queue.removeJobScheduler).toHaveBeenCalledWith('workflow-w1');
        });
    });

    describe('listForUser', () => {
        it('reports the next run for registered schedules and flags missing ones', async () => {
            const nextRun = Date.parse('2026-09-15T02:00:00.000Z');
            findManyWorkflows.mockResolvedValue([
                { id: 'w1', name: 'Nightly sync', cronExpression: '0 2 * * *', timezone: 'UTC' },
                { id: 'w2', name: 'Hourly ping', cronExpression: '0 * * * *', timezone: 'UTC' },
            ]);
            queue.getJobScheduler.mockImplementation(async (id) => (id === 'workflow-w1' ? schedulerJson(id, nextRun) : undefined));

            const schedules = await createService().listForUser('user-1');

            expect(findManyWorkflows).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', status: 'ACTIVE' } }));
            expect(schedules).toEqual([
                {
                    workflowId: 'w1',
                    workflowName: 'Nightly sync',
                    cronExpression: '0 2 * * *',
                    timezone: 'UTC',
                    registered: true,
                    nextRunAt: new Date(nextRun),
                },
                {
                    workflowId: 'w2',
                    workflowName: 'Hourly ping',
                    cronExpression: '0 * * * *',
                    timezone: 'UTC',
                    registered: false,
                    nextRunAt: null,
                },
            ]);
        });
    });

    describe('reconcile', () => {
        it('registers active workflows, removes stale schedules and leaves unrelated schedulers alone', async () => {
            findManyWorkflows.mockResolvedValue([
                { id: 'w1', cronExpression: '0 2 * * *', timezone: 'UTC' },
                { id: 'w2', cronExpression: 'legacy-invalid', timezone: 'UTC' },
            ]);
            queue.getJobSchedulers.mockResolvedValue([
                schedulerJson('workflow-w1'),
                schedulerJson('workflow-deleted'),
                schedulerJson('some-other-scheduler'),
            ]);
            queue.upsertJobScheduler.mockImplementation(async (id) => {
                if (id === 'workflow-w2') {
                    throw new Error('Invalid cron expression');
                }
                return {} as Job<WorkflowJobData>;
            });

            const result = await createService().reconcile();

            expect(result).toEqual({ registered: 1, removed: 1, failed: 1 });
            expect(queue.removeJobScheduler).toHaveBeenCalledTimes(1);
            expect(queue.removeJobScheduler).toHaveBeenCalledWith('workflow-deleted');
        });
    });

    describe('onApplicationBootstrap', () => {
        it('does nothing when boot-time sync is disabled', () => {
            const service = createService(false);
            const reconcile = jest.spyOn(service, 'reconcile');

            service.onApplicationBootstrap();

            expect(reconcile).not.toHaveBeenCalled();
        });

        it('reconciles in the background without failing startup when Redis is down', async () => {
            const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
            const service = createService(true);
            jest.spyOn(service, 'reconcile').mockRejectedValue(new Error('connect ECONNREFUSED'));

            expect(() => service.onApplicationBootstrap()).not.toThrow();
            await flushPromises();

            expect(logError).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
        });
    });
});
