import { PrismaService } from '../../database/prisma.service';
export declare class WorkflowRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createWorkflow(data: any): Promise<{
        steps: {
            type: import(".prisma/client").$Enums.StepType;
            id: string;
            createdAt: Date;
            stepOrder: number;
            config: import("@prisma/client/runtime/library").JsonValue;
            workflowId: string;
            retryCount: number;
            timeout: number;
        }[];
    } & {
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        cronExpression: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        webhookToken: string;
        userId: string;
    }>;
    getUserWorkflows(userId: string): Promise<({
        steps: {
            type: import(".prisma/client").$Enums.StepType;
            id: string;
            createdAt: Date;
            stepOrder: number;
            config: import("@prisma/client/runtime/library").JsonValue;
            workflowId: string;
            retryCount: number;
            timeout: number;
        }[];
        _count: {
            executions: number;
        };
    } & {
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        cronExpression: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        webhookToken: string;
        userId: string;
    })[]>;
    getWorkflowById(workflowId: string, userId: string): Promise<({
        steps: {
            type: import(".prisma/client").$Enums.StepType;
            id: string;
            createdAt: Date;
            stepOrder: number;
            config: import("@prisma/client/runtime/library").JsonValue;
            workflowId: string;
            retryCount: number;
            timeout: number;
        }[];
    } & {
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        cronExpression: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        webhookToken: string;
        userId: string;
    }) | null>;
    updateStatus(workflowId: string, userId: string, status: 'ACTIVE' | 'PAUSED'): Promise<{
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        cronExpression: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        webhookToken: string;
        userId: string;
    }>;
    deleteWorkflow(workflowId: string, userId: string): Promise<{
        description: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        cronExpression: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        webhookToken: string;
        userId: string;
    }>;
}
//# sourceMappingURL=workflow.repository.d.ts.map