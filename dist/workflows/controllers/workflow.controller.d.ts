import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
export declare class WorkflowController {
    private readonly workflowService;
    constructor(workflowService: WorkflowService);
    createWorkflow(req: any, dto: CreateWorkflowDto): Promise<{
        message: string;
        workflow: {
            steps: {
                id: string;
                createdAt: Date;
                workflowId: string;
                stepOrder: number;
                type: import(".prisma/client").$Enums.StepType;
                config: import("@prisma/client/runtime/library").JsonValue;
                retryCount: number;
                timeout: number;
            }[];
        } & {
            id: string;
            name: string;
            description: string | null;
            cronExpression: string;
            status: import(".prisma/client").$Enums.WorkflowStatus;
            webhookToken: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
        };
    }>;
    getUserWorkflows(req: any): Promise<({
        steps: {
            id: string;
            createdAt: Date;
            workflowId: string;
            stepOrder: number;
            type: import(".prisma/client").$Enums.StepType;
            config: import("@prisma/client/runtime/library").JsonValue;
            retryCount: number;
            timeout: number;
        }[];
        _count: {
            executions: number;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        cronExpression: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        webhookToken: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    })[]>;
    getWorkflowById(id: string, req: any): Promise<{
        steps: {
            id: string;
            createdAt: Date;
            workflowId: string;
            stepOrder: number;
            type: import(".prisma/client").$Enums.StepType;
            config: import("@prisma/client/runtime/library").JsonValue;
            retryCount: number;
            timeout: number;
        }[];
    } & {
        id: string;
        name: string;
        description: string | null;
        cronExpression: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        webhookToken: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
    }>;
    pauseWorkflow(id: string, req: any): Promise<{
        message: string;
        workflow: {
            id: string;
            name: string;
            description: string | null;
            cronExpression: string;
            status: import(".prisma/client").$Enums.WorkflowStatus;
            webhookToken: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
        };
    }>;
    resumeWorkflow(id: string, req: any): Promise<{
        message: string;
        workflow: {
            id: string;
            name: string;
            description: string | null;
            cronExpression: string;
            status: import(".prisma/client").$Enums.WorkflowStatus;
            webhookToken: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
        };
    }>;
    deleteWorkflow(id: string, req: any): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=workflow.controller.d.ts.map