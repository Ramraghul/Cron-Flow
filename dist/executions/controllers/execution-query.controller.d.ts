import { ExecutionService } from '../services/execution.service';
export declare class ExecutionQueryController {
    private readonly executionService;
    constructor(executionService: ExecutionService);
    list(workflowId: string, req: any, limit?: string, offset?: string): Promise<{
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
}
//# sourceMappingURL=execution-query.controller.d.ts.map