import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../queues/services/queue.service';

@Injectable()
export class WebhooksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly queueService: QueueService,
    ) {}

    async triggerByToken(webhookToken: string, payload: Record<string, any>) {
        const workflow = await this.prisma.workflow.findUnique({
            where: { webhookToken },
        });

        if (!workflow) throw new NotFoundException('Webhook not found');

        if (workflow.status === 'PAUSED') {
            return { message: 'Workflow is paused — trigger ignored', workflowId: workflow.id };
        }

        const execution = await this.prisma.execution.create({
            data: { workflowId: workflow.id, triggerType: 'WEBHOOK' },
        });

        await this.queueService.addWorkflowJob({
            executionId: execution.id,
            workflowId: workflow.id,
            webhookPayload: payload,
        });

        return {
            message: 'Webhook received — execution queued',
            executionId: execution.id,
            workflowId: workflow.id,
        };
    }
}
