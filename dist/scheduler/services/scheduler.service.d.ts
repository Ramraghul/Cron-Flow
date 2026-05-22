import { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../queues/services/queue.service';
export declare class SchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly prisma;
    private readonly queueService;
    private readonly schedulerRegistry;
    private readonly logger;
    constructor(prisma: PrismaService, queueService: QueueService, schedulerRegistry: SchedulerRegistry);
    onApplicationBootstrap(): Promise<void>;
    onApplicationShutdown(): void;
    register(workflowId: string, cronExpression: string): void;
    unregister(workflowId: string): void;
    listJobs(): Array<{
        workflowId: string;
        nextRun: Date | null;
        running: boolean;
    }>;
    private loadAndRegisterAll;
    private unregisterAll;
    private dispatch;
}
//# sourceMappingURL=scheduler.service.d.ts.map