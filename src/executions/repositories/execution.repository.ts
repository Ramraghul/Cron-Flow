import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ExecutionRepository {
    constructor(private readonly prisma: PrismaService) {}

    async createExecution(workflowId: string, triggerType: 'MANUAL' | 'CRON' | 'WEBHOOK' = 'MANUAL') {
        return this.prisma.execution.create({ data: { workflowId, triggerType } });
    }

    async getExecutionById(executionId: string) {
        return this.prisma.execution.findUnique({
            where: { id: executionId },
            include: {
                workflow: { select: { name: true, cronExpression: true } },
                steps: { orderBy: { createdAt: 'asc' } },
            },
        });
    }

    async listByWorkflow(workflowId: string, limit = 20, offset = 0) {
        const [executions, total] = await Promise.all([
            this.prisma.execution.findMany({
                where: { workflowId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                include: { steps: { select: { status: true, stepOrder: true } as any } },
            }),
            this.prisma.execution.count({ where: { workflowId } }),
        ]);
        return { executions, total, limit, offset };
    }

    async updateExecutionStatus(executionId: string, status: any) {
        return this.prisma.execution.update({
            where: { id: executionId },
            data: {
                status,
                completedAt: status === 'SUCCESS' || status === 'FAILED' ? new Date() : undefined,
            },
        });
    }

    async createExecutionStep(data: { executionId: string; workflowStepId: string }) {
        return this.prisma.executionStep.create({ data });
    }

    async updateExecutionStep(executionStepId: string, data: any) {
        return this.prisma.executionStep.update({ where: { id: executionStepId }, data });
    }
}
