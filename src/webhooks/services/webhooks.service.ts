import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TriggerType, WorkflowStatus } from '@prisma/client';
import { DemoAccountsService } from '../../common/services/demo-accounts.service';
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
        private readonly demoAccounts: DemoAccountsService,
    ) {}

    async trigger(webhookToken: string, payload: unknown): Promise<ExecutionAcceptedDto> {
        const workflow = await this.workflowsRepository.findByWebhookToken(webhookToken);
        if (!workflow) {
            throw new NotFoundException('Webhook not found');
        }
        // A demo workflow's webhook URL is on show in the dashboard, so it must not start runs either.
        this.demoAccounts.assertMayWrite(workflow.user.email, 'POST');
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
