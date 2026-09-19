import { Injectable } from '@nestjs/common';
import { Prisma, StepType, Workflow, WorkflowStatus } from '@prisma/client';
import { paginationOffset, SortOrder } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowSortField } from '../dto/list-workflows-query.dto';

const withOrderedSteps = { steps: { orderBy: { stepOrder: 'asc' } } } satisfies Prisma.WorkflowInclude;
const withCounts = { _count: { select: { steps: true, executions: true } } } satisfies Prisma.WorkflowInclude;

export type WorkflowWithSteps = Prisma.WorkflowGetPayload<{ include: typeof withOrderedSteps }>;
export type WorkflowWithCounts = Prisma.WorkflowGetPayload<{ include: typeof withCounts }>;

export interface NewWorkflowStep {
    stepOrder: number;
    type: StepType;
    config: Prisma.InputJsonObject;
    retryCount?: number;
    timeout?: number;
}

export interface NewWorkflow {
    name: string;
    description?: string;
    cronExpression: string;
    timezone?: string;
    webhookToken: string;
    steps: NewWorkflowStep[];
}

export type WorkflowChanges = Partial<Pick<Workflow, 'name' | 'description' | 'cronExpression' | 'timezone'>>;

export interface WorkflowListFilter {
    userId: string;
    status?: WorkflowStatus;
    search?: string;
    page: number;
    limit: number;
    sortBy: WorkflowSortField;
    sortOrder: SortOrder;
}

const ORDER_BY: Record<WorkflowSortField, (order: SortOrder) => Prisma.WorkflowOrderByWithRelationInput> = {
    createdAt: (order) => ({ createdAt: order }),
    updatedAt: (order) => ({ updatedAt: order }),
    name: (order) => ({ name: order }),
};

@Injectable()
export class WorkflowsRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(userId: string, workflow: NewWorkflow): Promise<WorkflowWithSteps> {
        const { steps, ...fields } = workflow;
        return this.prisma.workflow.create({
            data: { ...fields, userId, steps: { create: steps } },
            include: withOrderedSteps,
        });
    }

    async findManyForUser(filter: WorkflowListFilter): Promise<{ items: WorkflowWithCounts[]; totalItems: number }> {
        const where: Prisma.WorkflowWhereInput = {
            userId: filter.userId,
            status: filter.status,
            ...(filter.search && {
                OR: [
                    { name: { contains: filter.search, mode: 'insensitive' } },
                    { description: { contains: filter.search, mode: 'insensitive' } },
                ],
            }),
        };

        const [items, totalItems] = await this.prisma.$transaction([
            this.prisma.workflow.findMany({
                where,
                include: withCounts,
                // The id tiebreaker keeps page boundaries stable when sort values are equal.
                orderBy: [ORDER_BY[filter.sortBy](filter.sortOrder), { id: 'asc' }],
                skip: paginationOffset(filter.page, filter.limit),
                take: filter.limit,
            }),
            this.prisma.workflow.count({ where }),
        ]);

        return { items, totalItems };
    }

    findOneForUser(workflowId: string, userId: string): Promise<WorkflowWithSteps | null> {
        return this.prisma.workflow.findFirst({ where: { id: workflowId, userId }, include: withOrderedSteps });
    }

    async existsForUser(workflowId: string, userId: string): Promise<boolean> {
        const count = await this.prisma.workflow.count({ where: { id: workflowId, userId } });
        return count > 0;
    }

    findByWebhookToken(webhookToken: string): Promise<Workflow | null> {
        return this.prisma.workflow.findUnique({ where: { webhookToken } });
    }

    /** Applies field changes and, when `steps` is given, replaces the step list in the same transaction. */
    update(workflowId: string, changes: WorkflowChanges, steps?: NewWorkflowStep[]): Promise<WorkflowWithSteps> {
        return this.prisma.$transaction(async (tx) => {
            if (steps) {
                await tx.workflowStep.deleteMany({ where: { workflowId } });
            }
            return tx.workflow.update({
                where: { id: workflowId },
                data: { ...changes, ...(steps && { steps: { create: steps } }) },
                include: withOrderedSteps,
            });
        });
    }

    updateStatus(workflowId: string, status: WorkflowStatus): Promise<WorkflowWithSteps> {
        return this.prisma.workflow.update({ where: { id: workflowId }, data: { status }, include: withOrderedSteps });
    }

    /** Steps, executions and execution steps are removed by ON DELETE CASCADE. */
    async delete(workflowId: string): Promise<void> {
        await this.prisma.workflow.delete({ where: { id: workflowId } });
    }
}
