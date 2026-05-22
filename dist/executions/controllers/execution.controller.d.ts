import { ExecutionService } from '../services/execution.service';
export declare class ExecutionController {
    private readonly executionService;
    constructor(executionService: ExecutionService);
    trigger(workflowId: string, req: any): Promise<{
        message: string;
        executionId: string;
    }>;
    getExecution(executionId: string, req: any): Promise<{
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
    }>;
}
//# sourceMappingURL=execution.controller.d.ts.map