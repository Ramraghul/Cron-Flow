import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WorkflowRepository {
    constructor(private readonly prisma: PrismaService) {}

    async createWorkflow(data: any) {
        return this.prisma.workflow.create({
            data,
            include: { steps: true },
        });
    }

    async getUserWorkflows(userId: string) {
        return this.prisma.workflow.findMany({
            where: { userId },
            include: { steps: true, _count: { select: { executions: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getWorkflowById(workflowId: string, userId: string) {
        return this.prisma.workflow.findFirst({
            where: { id: workflowId, userId },
            include: { steps: true },
        });
    }

    async updateStatus(workflowId: string, userId: string, status: 'ACTIVE' | 'PAUSED') {
        return this.prisma.workflow.update({
            where: { id: workflowId },
            data: { status },
        });
    }

    async deleteWorkflow(workflowId: string, userId: string) {
        // Delete in order to respect foreign key constraints
        // 1. Delete ExecutionStep records
        await this.prisma.executionStep.deleteMany({
            where: {
                execution: {
                    workflow: { id: workflowId, userId },
                },
            },
        });

        // 2. Delete Execution records
        await this.prisma.execution.deleteMany({
            where: {
                workflow: { id: workflowId, userId },
            },
        });

        // 3. Delete WorkflowStep records
        await this.prisma.workflowStep.deleteMany({
            where: { workflow: { id: workflowId, userId } },
        });

        // 4. Delete Workflow
        return this.prisma.workflow.delete({
            where: { id: workflowId },
        });
    }
}
