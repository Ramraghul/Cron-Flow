import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TriggerType, WorkflowStatus } from '@prisma/client';
import { ExecutionAcceptedDto } from '../../executions/dto/execution-response.dto';
import { ExecutionsService } from '../../executions/services/executions.service';
import { WorkflowsRepository } from '../../workflows/repositories/workflows.repository';

function isNonEmptyObject(value: unknown): value is Prisma.InputJsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
}

@Injectable()
export class WebhooksService {
    constructor(
        private readonly workflowsRepository: WorkflowsRepository,
        private readonly executionsService: ExecutionsService,
    ) {}

    async trigger(webhookToken: string, payload: unknown): Promise<ExecutionAcceptedDto> {
        const workflow = await this.workflowsRepository.findByWebhookToken(webhookToken);
        if (!workflow) {
            throw new NotFoundException('Webhook not found');
        }
        if (workflow.status === WorkflowStatus.PAUSED) {
            throw new ConflictException('Workflow is paused — webhook trigger ignored');
        }

        return this.executionsService.createAndEnqueue(
            workflow.id,
            TriggerType.WEBHOOK,
            isNonEmptyObject(payload) ? payload : undefined,
        );
    }
}
