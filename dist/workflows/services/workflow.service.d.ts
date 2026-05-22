import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowRepository } from '../repositories/workflow.repository';
export declare class WorkflowService {
    private readonly workflowRepository;
    private schedulerService;
    constructor(workflowRepository: WorkflowRepository);
    setSchedulerService(svc: any): void;
    createWorkflow(userId: string, dto: CreateWorkflowDto): Promise<{
        message: string;
        workflow: {
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
        };
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
    getWorkflowById(workflowId: string, userId: string): Promise<{
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
    pauseWorkflow(workflowId: string, userId: string): Promise<{
        message: string;
        workflow: {
            description: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            cronExpression: string;
            status: import(".prisma/client").$Enums.WorkflowStatus;
            webhookToken: string;
            userId: string;
        };
    }>;
    resumeWorkflow(workflowId: string, userId: string): Promise<{
        message: string;
        workflow: {
            description: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            cronExpression: string;
            status: import(".prisma/client").$Enums.WorkflowStatus;
            webhookToken: string;
            userId: string;
        };
    }>;
    deleteWorkflow(workflowId: string, userId: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=workflow.service.d.ts.map