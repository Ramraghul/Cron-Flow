import { Injectable } from '@nestjs/common';
import {
    Execution,
    ExecutionStatus,
    ExecutionStep,
    Prisma,
    TriggerType,
    WorkflowStep,
} from '@prisma/client';
import { paginationOffset } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';

const withDetails = {
    steps: { orderBy: { stepOrder: 'asc' } },
    workflow: { select: { name: true } },
} satisfies Prisma.ExecutionInclude;

const withWorkflowSteps = {
    workflow: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
} satisfies Prisma.ExecutionInclude;

export type ExecutionWithDetails = Prisma.ExecutionGetPayload<{ include: typeof withDetails }>;
export type ExecutionForRun = Prisma.ExecutionGetPayload<{ include: typeof withWorkflowSteps }>;
export type WorkflowForRun = ExecutionForRun['workflow'];

export type FinalExecutionStatus = typeof ExecutionStatus.SUCCESS | typeof ExecutionStatus.FAILED;

export interface ExecutionListFilter {
    workflowId: string;
    status?: ExecutionStatus;
    triggerType?: TriggerType;
    page: number;
    limit: number;
}

/** Data access for executions — used by the API (create/read) and the execution engine (run/update). */
@Injectable()
export class ExecutionsRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: {
        workflowId: string;
        triggerType: TriggerType;
        triggerPayload?: Prisma.InputJsonValue;
    }): Promise<Execution> {
        return this.prisma.execution.create({ data });
    }

    findDetailsForUser(executionId: string, userId: string): Promise<ExecutionWithDetails | null> {
        return this.prisma.execution.findFirst({
            where: { id: executionId, workflow: { userId } },
            include: withDetails,
        });
    }

    async listForWorkflow(filter: ExecutionListFilter): Promise<{ items: Execution[]; totalItems: number }> {
        const where: Prisma.ExecutionWhereInput = {
            workflowId: filter.workflowId,
            status: filter.status,
            triggerType: filter.triggerType,
        };

        const [items, totalItems] = await this.prisma.$transaction([
            this.prisma.execution.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: paginationOffset(filter.page, filter.limit),
                take: filter.limit,
            }),
            this.prisma.execution.count({ where }),
        ]);

        return { items, totalItems };
    }

    findForRun(executionId: string): Promise<ExecutionForRun | null> {
        return this.prisma.execution.findUnique({ where: { id: executionId }, include: withWorkflowSteps });
    }

    findWorkflowForRun(workflowId: string): Promise<WorkflowForRun | null> {
        return this.prisma.workflow.findUnique({
            where: { id: workflowId },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        });
    }

    createForRun(workflowId: string, triggerType: TriggerType): Promise<ExecutionForRun> {
        return this.prisma.execution.create({ data: { workflowId, triggerType }, include: withWorkflowSteps });
    }

    /** Marks the execution RUNNING and creates a PENDING snapshot row for every step, atomically. */
    startExecution(executionId: string, steps: WorkflowStep[]): Promise<ExecutionStep[]> {
        return this.prisma.$transaction(async (tx) => {
            await tx.execution.update({
                where: { id: executionId },
                data: { status: ExecutionStatus.RUNNING, startedAt: new Date() },
            });
            return tx.executionStep.createManyAndReturn({
                data: steps.map((step) => ({
                    executionId,
                    workflowStepId: step.id,
                    stepOrder: step.stepOrder,
                    type: step.type,
                })),
            });
        });
    }

    async updateStep(executionStepId: string, data: Prisma.ExecutionStepUpdateInput): Promise<void> {
        await this.prisma.executionStep.update({ where: { id: executionStepId }, data });
    }

    async skipPendingSteps(executionId: string): Promise<void> {
        await this.prisma.executionStep.updateMany({
            where: { executionId, status: ExecutionStatus.PENDING },
            data: { status: ExecutionStatus.SKIPPED },
        });
    }

    async complete(executionId: string, status: FinalExecutionStatus, errorMessage?: string): Promise<void> {
        await this.prisma.execution.update({
            where: { id: executionId },
            data: { status, completedAt: new Date(), errorMessage: errorMessage ?? null },
        });
    }

    /** Fails an execution that cannot continue: its running step fails and remaining steps are skipped. */
    async failInterrupted(executionId: string, reason: string): Promise<void> {
        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.executionStep.updateMany({
                where: { executionId, status: ExecutionStatus.RUNNING },
                data: { status: ExecutionStatus.FAILED, errorMessage: reason, completedAt: now },
            }),
            this.prisma.executionStep.updateMany({
                where: { executionId, status: ExecutionStatus.PENDING },
                data: { status: ExecutionStatus.SKIPPED },
            }),
            this.prisma.execution.update({
                where: { id: executionId },
                data: { status: ExecutionStatus.FAILED, completedAt: now, errorMessage: reason },
            }),
        ]);
    }
}
