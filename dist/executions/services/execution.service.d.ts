import { WorkflowRepository } from '../../workflows/repositories/workflow.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { QueueService } from '../../queues/services/queue.service';
export declare class ExecutionService {
    private readonly workflowRepository;
    private readonly executionRepository;
    private readonly queueService;
    constructor(workflowRepository: WorkflowRepository, executionRepository: ExecutionRepository, queueService: QueueService);
    triggerWorkflow(workflowId: string, userId: string): Promise<{
        message: string;
        executionId: string;
    }>;
    getExecutionHistory(executionId: string, userId: string): Promise<{
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
    listExecutions(workflowId: string, userId: string, limit: number, offset: number): Promise<{
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
//# sourceMappingURL=execution.service.d.ts.map