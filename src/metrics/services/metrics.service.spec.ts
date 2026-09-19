import { NotFoundException } from '@nestjs/common';
import { ExecutionStatus, Prisma, TriggerType, WorkflowStatus } from '@prisma/client';
import { buildExecution, buildWorkflow } from '../../../test/utils/factories';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from './metrics.service';

type GroupByArgs = { by: string[] };

describe('MetricsService', () => {
    let prisma: {
        workflow: { groupBy: jest.Mock; findFirst: jest.Mock };
        execution: { groupBy: jest.Mock; findMany: jest.Mock; count: jest.Mock };
        $queryRaw: jest.Mock;
    };
    let service: MetricsService;

    function mockExecutionGroups(statuses: Partial<Record<ExecutionStatus, number>>, triggers: Partial<Record<TriggerType, number>>) {
        prisma.execution.groupBy.mockImplementation(async ({ by }: GroupByArgs) =>
            by[0] === 'status'
                ? Object.entries(statuses).map(([status, count]) => ({ status, _count: { _all: count } }))
                : Object.entries(triggers).map(([triggerType, count]) => ({ triggerType, _count: { _all: count } })),
        );
    }

    beforeEach(() => {
        prisma = {
            workflow: { groupBy: jest.fn(), findFirst: jest.fn() },
            execution: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
            $queryRaw: jest.fn(),
        };
        service = new MetricsService(prisma as unknown as PrismaService);
    });

    describe('getSummary', () => {
        it('aggregates only the caller’s data and fills in zero counts', async () => {
            prisma.workflow.groupBy.mockResolvedValue([{ status: WorkflowStatus.ACTIVE, _count: { _all: 3 } }]);
            mockExecutionGroups({ SUCCESS: 9, FAILED: 3, RUNNING: 1 }, { CRON: 10, MANUAL: 3 });
            prisma.$queryRaw.mockResolvedValue([{ avg_ms: 1234.6 }]);
            prisma.execution.findMany.mockResolvedValue([
                {
                    ...buildExecution({
                        status: ExecutionStatus.SUCCESS,
                        startedAt: new Date('2026-09-14T10:00:00.000Z'),
                        completedAt: new Date('2026-09-14T10:00:01.500Z'),
                    }),
                    workflow: { name: 'Nightly sync' },
                },
            ]);

            const summary = await service.getSummary('user-1');

            expect(summary.workflows).toEqual({ total: 3, active: 3, paused: 0 });
            expect(summary.executions).toEqual({
                total: 13,
                byStatus: { PENDING: 0, RUNNING: 1, SUCCESS: 9, FAILED: 3, SKIPPED: 0 },
                byTrigger: { MANUAL: 3, CRON: 10, WEBHOOK: 0 },
                successRatePercent: 75,
                avgDurationMs: 1235,
            });
            expect(summary.recentExecutions).toEqual([
                expect.objectContaining({ id: 'execution-1', workflowName: 'Nightly sync', durationMs: 1500 }),
            ]);

            expect(prisma.workflow.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
            expect(prisma.execution.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({ where: { workflow: { userId: 'user-1' } } }),
            );
            expect(prisma.execution.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { workflow: { userId: 'user-1' } }, take: 10 }),
            );
            const [, durationScope] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, Prisma.Sql];
            expect(durationScope.values).toEqual(['user-1']);
        });

        it('reports null rates until an execution has finished', async () => {
            prisma.workflow.groupBy.mockResolvedValue([]);
            mockExecutionGroups({ PENDING: 2 }, { MANUAL: 2 });
            prisma.$queryRaw.mockResolvedValue([{ avg_ms: null }]);
            prisma.execution.findMany.mockResolvedValue([]);

            const summary = await service.getSummary('user-1');

            expect(summary.executions).toMatchObject({ total: 2, successRatePercent: null, avgDurationMs: null });
        });
    });

    describe('getWorkflowMetrics', () => {
        it('returns execution statistics for one owned workflow', async () => {
            prisma.workflow.findFirst.mockResolvedValue(buildWorkflow());
            mockExecutionGroups({ SUCCESS: 1, FAILED: 1 }, { CRON: 2 });
            prisma.$queryRaw.mockResolvedValue([{ avg_ms: 800 }]);
            prisma.execution.count.mockResolvedValue(2);

            const metrics = await service.getWorkflowMetrics('user-1', 'workflow-1');

            expect(prisma.workflow.findFirst).toHaveBeenCalledWith({ where: { id: 'workflow-1', userId: 'user-1' } });
            expect(metrics).toMatchObject({
                workflowId: 'workflow-1',
                name: 'Nightly sync',
                executionsLast30Days: 2,
                executions: { total: 2, successRatePercent: 50, avgDurationMs: 800 },
            });
            const [{ where }] = prisma.execution.count.mock.calls[0] as [{ where: { createdAt: { gte: Date } } }];
            const windowDays = (Date.now() - where.createdAt.gte.getTime()) / (24 * 60 * 60 * 1000);
            expect(windowDays).toBeCloseTo(30, 1);
        });

        it('throws 404 for a workflow the caller does not own', async () => {
            prisma.workflow.findFirst.mockResolvedValue(null);

            await expect(service.getWorkflowMetrics('user-1', 'workflow-1')).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
