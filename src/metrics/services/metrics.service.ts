import { Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionStatus, Prisma, TriggerType, WorkflowStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toExecutionSummary } from '../../executions/execution.mapper';
import { ExecutionStatsDto, MetricsSummaryDto, WorkflowMetricsDto } from '../dto/metrics-response.dto';

const RECENT_EXECUTIONS_LIMIT = 10;
const RECENT_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function zeroCounts<TKey extends string>(keys: readonly TKey[]): Record<TKey, number> {
    return Object.fromEntries(keys.map((key) => [key, 0])) as Record<TKey, number>;
}

/** Aggregates are always scoped to the caller's own workflows. */
@Injectable()
export class MetricsService {
    constructor(private readonly prisma: PrismaService) {}

    async getSummary(userId: string): Promise<MetricsSummaryDto> {
        const [workflowGroups, executions, recentExecutions] = await Promise.all([
            this.prisma.workflow.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
            this.getExecutionStats({ workflow: { userId } }, Prisma.sql`w."userId" = ${userId}`),
            this.prisma.execution.findMany({
                where: { workflow: { userId } },
                orderBy: { createdAt: 'desc' },
                take: RECENT_EXECUTIONS_LIMIT,
                include: { workflow: { select: { name: true } } },
            }),
        ]);

        const workflowCounts = zeroCounts(Object.values(WorkflowStatus));
        for (const group of workflowGroups) {
            workflowCounts[group.status] = group._count._all;
        }

        return {
            generatedAt: new Date(),
            workflows: {
                total: workflowCounts.ACTIVE + workflowCounts.PAUSED,
                active: workflowCounts.ACTIVE,
                paused: workflowCounts.PAUSED,
            },
            executions,
            recentExecutions: recentExecutions.map((execution) => ({
                ...toExecutionSummary(execution),
                workflowName: execution.workflow.name,
            })),
        };
    }

    async getWorkflowMetrics(userId: string, workflowId: string): Promise<WorkflowMetricsDto> {
        const workflow = await this.prisma.workflow.findFirst({ where: { id: workflowId, userId } });
        if (!workflow) {
            throw new NotFoundException(`Workflow ${workflowId} not found`);
        }

        const [executions, executionsLast30Days] = await Promise.all([
            this.getExecutionStats({ workflowId }, Prisma.sql`e."workflowId" = ${workflowId}`),
            this.prisma.execution.count({
                where: { workflowId, createdAt: { gte: new Date(Date.now() - RECENT_WINDOW_DAYS * MS_PER_DAY) } },
            }),
        ]);

        return {
            workflowId: workflow.id,
            name: workflow.name,
            status: workflow.status,
            cronExpression: workflow.cronExpression,
            timezone: workflow.timezone,
            executions,
            executionsLast30Days,
        };
    }

    /**
     * @param where Prisma filter for the counts
     * @param durationScope the same filter as SQL, for the duration average Prisma cannot express
     */
    private async getExecutionStats(
        where: Prisma.ExecutionWhereInput,
        durationScope: Prisma.Sql,
    ): Promise<ExecutionStatsDto> {
        const [statusGroups, triggerGroups, durationRows] = await Promise.all([
            this.prisma.execution.groupBy({ by: ['status'], where, _count: { _all: true } }),
            this.prisma.execution.groupBy({ by: ['triggerType'], where, _count: { _all: true } }),
            this.prisma.$queryRaw<{ avg_ms: number | null }[]>`
                SELECT AVG(EXTRACT(EPOCH FROM (e."completedAt" - e."startedAt")) * 1000)::float8 AS avg_ms
                FROM "Execution" e
                JOIN "Workflow" w ON w."id" = e."workflowId"
                WHERE ${durationScope} AND e."startedAt" IS NOT NULL AND e."completedAt" IS NOT NULL`,
        ]);

        const byStatus = zeroCounts(Object.values(ExecutionStatus));
        for (const group of statusGroups) {
            byStatus[group.status] = group._count._all;
        }

        const byTrigger = zeroCounts(Object.values(TriggerType));
        for (const group of triggerGroups) {
            byTrigger[group.triggerType] = group._count._all;
        }

        const finished = byStatus.SUCCESS + byStatus.FAILED;
        const averageMs = durationRows[0]?.avg_ms;

        return {
            total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
            byStatus,
            byTrigger,
            successRatePercent: finished > 0 ? Math.round((byStatus.SUCCESS / finished) * 1000) / 10 : null,
            avgDurationMs: averageMs == null ? null : Math.round(averageMs),
        };
    }
}
