import { PrismaService } from '../../database/prisma.service';
export declare class ExecutionRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createExecution(workflowId: string, triggerType?: 'MANUAL' | 'CRON' | 'WEBHOOK'): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ExecutionStatus;
        workflowId: string;
        triggerType: import(".prisma/client").$Enums.TriggerType;
        startedAt: Date | null;
        completedAt: Date | null;
    }>;
    getExecutionById(executionId: string): Promise<({
        workflow: {
            name: string;
            cronExpression: string;
        };
        steps: {
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.ExecutionStatus;
            startedAt: Date | null;
            completedAt: Date | null;
            attempts: number;
            executionId: string;
            workflowStepId: string;
            logs: string | null;
            errorMessage: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ExecutionStatus;
        workflowId: string;
        triggerType: import(".prisma/client").$Enums.TriggerType;
        startedAt: Date | null;
        completedAt: Date | null;
    }) | null>;
    listByWorkflow(workflowId: string, limit?: number, offset?: number): Promise<{
        executions: ({
            steps: {
                [x: string]: never;
                [x: number]: never;
                [x: symbol]: never;
            }[];
        } & {
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.ExecutionStatus;
            workflowId: string;
            triggerType: import(".prisma/client").$Enums.TriggerType;
            startedAt: Date | null;
            completedAt: Date | null;
        })[];
        total: number;
        limit: number;
        offset: number;
    }>;
    updateExecutionStatus(executionId: string, status: any): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ExecutionStatus;
        workflowId: string;
        triggerType: import(".prisma/client").$Enums.TriggerType;
        startedAt: Date | null;
        completedAt: Date | null;
    }>;
    createExecutionStep(data: {
        executionId: string;
        workflowStepId: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ExecutionStatus;
        startedAt: Date | null;
        completedAt: Date | null;
        attempts: number;
        executionId: string;
        workflowStepId: string;
        logs: string | null;
        errorMessage: string | null;
    }>;
    updateExecutionStep(executionStepId: string, data: any): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.ExecutionStatus;
        startedAt: Date | null;
        completedAt: Date | null;
        attempts: number;
        executionId: string;
        workflowStepId: string;
        logs: string | null;
        errorMessage: string | null;
    }>;
}
//# sourceMappingURL=execution.repository.d.ts.map