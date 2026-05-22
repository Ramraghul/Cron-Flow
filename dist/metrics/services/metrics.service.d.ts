import { PrismaService } from '../../database/prisma.service';
export declare class MetricsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getGlobalMetrics(): Promise<{
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
    getWorkflowMetrics(workflowId: string, userId: string): Promise<{
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
    health(): Promise<{
        status: string;
        db: string;
        timestamp: string;
    }>;
}
//# sourceMappingURL=metrics.service.d.ts.map