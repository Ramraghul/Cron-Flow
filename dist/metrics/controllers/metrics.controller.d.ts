import { MetricsService } from '../services/metrics.service';
export declare class MetricsController {
    private readonly service;
    constructor(service: MetricsService);
    health(): Promise<{
        status: string;
        db: string;
        timestamp: string;
    }>;
    global(): Promise<{
        timestamp: string;
        users: {
            total: number;
        };
        workflows: {
            total: number;
            active: number;
            paused: number;
        };
        executions: {
            total: number;
            byStatus: Record<string, number>;
            byTrigger: Record<string, number>;
            successRate: string;
            avgDurationMs: number;
        };
        recentExecutions: {
            workflow: {
                name: string;
            };
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.ExecutionStatus;
            triggerType: import(".prisma/client").$Enums.TriggerType;
            startedAt: Date | null;
            completedAt: Date | null;
        }[];
    }>;
    workflow(id: string, req: any): Promise<{
        workflowId: string;
        name: string;
        status: import(".prisma/client").$Enums.WorkflowStatus;
        cronExpression: string;
        executions: {
            total: number;
            byStatus: Record<string, number>;
            last30Days: number;
        };
    } | null>;
}
//# sourceMappingURL=metrics.controller.d.ts.map