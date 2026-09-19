import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExecutionStatus, TriggerType, WorkflowStatus } from '@prisma/client';
import { buildWorkflow, FIXED_DATE } from '../../../test/utils/factories';
import { createMock } from '../../../test/utils/mocks';
import { ExecutionAcceptedDto } from '../../executions/dto/execution-response.dto';
import { ExecutionsService } from '../../executions/services/executions.service';
import { WorkflowsRepository } from '../../workflows/repositories/workflows.repository';
import { WebhooksService } from './webhooks.service';

const TOKEN = 'k3Jd9sQ2mVx7LpA0bR4tYw8eZc1uN6hG';

const accepted: ExecutionAcceptedDto = {
    executionId: 'execution-1',
    workflowId: 'workflow-1',
    status: ExecutionStatus.PENDING,
    triggerType: TriggerType.WEBHOOK,
    statusUrl: '/api/v1/executions/execution-1',
    createdAt: FIXED_DATE,
};

describe('WebhooksService', () => {
    let service: WebhooksService;
    let workflowsRepository: jest.Mocked<WorkflowsRepository>;
    let executionsService: jest.Mocked<ExecutionsService>;

    beforeEach(() => {
        workflowsRepository = createMock<WorkflowsRepository>(['findByWebhookToken']);
        executionsService = createMock<ExecutionsService>(['createAndEnqueue']);
        executionsService.createAndEnqueue.mockResolvedValue(accepted);
        service = new WebhooksService(workflowsRepository, executionsService);
    });

    it('queues a WEBHOOK execution and stores the request body as its payload', async () => {
        workflowsRepository.findByWebhookToken.mockResolvedValue(buildWorkflow());

        await expect(service.trigger(TOKEN, { event: 'deploy.finished' })).resolves.toBe(accepted);

        expect(workflowsRepository.findByWebhookToken).toHaveBeenCalledWith(TOKEN);
        expect(executionsService.createAndEnqueue).toHaveBeenCalledWith('workflow-1', TriggerType.WEBHOOK, {
            event: 'deploy.finished',
        });
    });

    it.each([[undefined], [{}], [[1, 2, 3]], ['plain text'], [42]])(
        'does not store a payload that is not a non-empty JSON object (%j)',
        async (payload) => {
            workflowsRepository.findByWebhookToken.mockResolvedValue(buildWorkflow());

            await service.trigger(TOKEN, payload);

            expect(executionsService.createAndEnqueue).toHaveBeenCalledWith('workflow-1', TriggerType.WEBHOOK, undefined);
        },
    );

    it('throws 404 for an unknown token', async () => {
        workflowsRepository.findByWebhookToken.mockResolvedValue(null);

        await expect(service.trigger('unknown', {})).rejects.toThrow(new NotFoundException('Webhook not found'));
        expect(executionsService.createAndEnqueue).not.toHaveBeenCalled();
    });

    it('throws 409 when the workflow is paused', async () => {
        workflowsRepository.findByWebhookToken.mockResolvedValue(buildWorkflow({ status: WorkflowStatus.PAUSED }));

        await expect(service.trigger(TOKEN, {})).rejects.toBeInstanceOf(ConflictException);
        expect(executionsService.createAndEnqueue).not.toHaveBeenCalled();
    });
});
