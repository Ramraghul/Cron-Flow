"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let MetricsService = class MetricsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getGlobalMetrics() {
        const [totalUsers, totalWorkflows, activeWorkflows, pausedWorkflows, totalExecutions, executionsByStatus, executionsByTrigger, recentExecutions, avgDuration,] = await Promise.all([
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
            this.prisma.$queryRaw `
                SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) * 1000) AS avg_ms
                FROM "Execution"
                WHERE "completedAt" IS NOT NULL AND "startedAt" IS NOT NULL
            `,
        ]);
        const byStatus = {};
        executionsByStatus.forEach((r) => { byStatus[r.status] = r._count.status; });
        const byTrigger = {};
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
    async getWorkflowMetrics(workflowId, userId) {
        const workflow = await this.prisma.workflow.findFirst({
            where: { id: workflowId, userId },
        });
        if (!workflow)
            return null;
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
        const statusMap = {};
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
            await this.prisma.$queryRaw `SELECT 1`;
            return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
        }
        catch {
            return { status: 'error', db: 'disconnected', timestamp: new Date().toISOString() };
        }
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map