import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MetricsService {
    constructor(private readonly prisma: PrismaService) {}

    async getGlobalMetrics() {
        const [
            totalUsers,
            totalWorkflows,
            activeWorkflows,
            pausedWorkflows,
            totalExecutions,
            executionsByStatus,
            executionsByTrigger,
            recentExecutions,
            avgDuration,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.workflow.count(),
            this.prisma.workflow.count({ where: { status: 'ACTIVE' } }),
            this.prisma.workflow.count({ where: { status: 'PAUSED' } }),
            this.prisma.execution.count(),
            this.prisma.execution.groupBy({
                by: ['status'],
                _count: { status: true },
            }),
            this.prisma.execution.groupBy({
                by: ['triggerType'],
                _count: { triggerType: true },
            }),
            this.prisma.execution.findMany({
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    triggerType: true,
                    startedAt: true,
                    completedAt: true,
                    createdAt: true,
                    workflow: {
                        select: { name: true },
                    },
                },
            }),
            // Average execution duration (completed ones)
            this.prisma.$queryRaw<[{ avg_ms: number }]>`
                SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) * 1000) AS avg_ms
                FROM "Execution"
                WHERE "completedAt" IS NOT NULL AND "startedAt" IS NOT NULL
            `,
        ]);

        const byStatus: Record<string, number> = {};
        executionsByStatus.forEach((r) => { byStatus[r.status] = r._count.status; });

        const byTrigger: Record<string, number> = {};
        executionsByTrigger.forEach((r) => { byTrigger[r.triggerType] = r._count.triggerType; });

        const successRate = totalExecutions > 0
            ? (((byStatus['SUCCESS'] || 0) / totalExecutions) * 100).toFixed(1)
            : '0.0';

        return {
            timestamp: new Date().toISOString(),
            users: { total: totalUsers },
            workflows: {
                total: totalWorkflows,
                active: activeWorkflows,
                paused: pausedWorkflows,
            },
            executions: {
                total: totalExecutions,
                byStatus,
                byTrigger,
                successRate: `${successRate}%`,
                avgDurationMs: Math.round(avgDuration[0]?.avg_ms ?? 0),
            },
            recentExecutions,
        };
    }

    async getWorkflowMetrics(workflowId: string, userId: string) {
        const workflow = await this.prisma.workflow.findFirst({
            where: { id: workflowId, userId },
        });
        if (!workflow) return null;

        const [total, byStatus, last30d] = await Promise.all([
            this.prisma.execution.count({ where: { workflowId } }),
            this.prisma.execution.groupBy({
                by: ['status'],
                where: { workflowId },
                _count: { status: true },
            }),
            this.prisma.execution.count({
                where: {
                    workflowId,
                    createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                },
            }),
        ]);

        const statusMap: Record<string, number> = {};
        byStatus.forEach((r) => { statusMap[r.status] = r._count.status; });

        return {
            workflowId,
            name: workflow.name,
            status: workflow.status,
            cronExpression: workflow.cronExpression,
            executions: { total, byStatus: statusMap, last30Days: last30d },
        };
    }

    async health() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
        } catch {
            return { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() };
        }
    }
}
