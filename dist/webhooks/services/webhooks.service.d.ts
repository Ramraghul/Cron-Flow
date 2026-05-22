import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../queues/services/queue.service';
export declare class WebhooksService {
    private readonly prisma;
    private readonly queueService;
    constructor(prisma: PrismaService, queueService: QueueService);
    triggerByToken(webhookToken: string, payload: Record<string, any>): Promise<{
        message: string;
        workflowId: string;
        executionId?: undefined;
    } | {
        message: string;
        executionId: string;
        workflowId: string;
    }>;
}
//# sourceMappingURL=webhooks.service.d.ts.map