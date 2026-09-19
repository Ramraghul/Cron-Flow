import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExecutionStatus, StepType, TriggerType } from '@prisma/client';
import { buildExecution, buildExecutionStep, buildExecutionWithDetails } from '../../../test/utils/factories';
import { createMock } from '../../../test/utils/mocks';
import { QueueService } from '../../queues/services/queue.service';
import { WorkflowsRepository } from '../../workflows/repositories/workflows.repository';
import { ListExecutionsQueryDto } from '../dto/list-executions-query.dto';
import { ExecutionsRepository } from '../repositories/executions.repository';
import { ExecutionsService, QUEUE_UNAVAILABLE_REASON } from './executions.service';

const USER_ID = 'user-1';
const WORKFLOW_ID = 'workflow-1';

describe('ExecutionsService', () => {
    let service: ExecutionsService;
    let repository: jest.Mocked<ExecutionsRepository>;
    let workflowsRepository: jest.Mocked<WorkflowsRepository>;
    let queueService: jest.Mocked<QueueService>;

    beforeEach(async () => {
        repository = createMock<ExecutionsRepository>(['create', 'complete', 'findDetailsForUser', 'listForWorkflow']);
        workflowsRepository = createMock<WorkflowsRepository>(['existsForUser']);
        queueService = createMock<QueueService>(['enqueueExecution']);

        const moduleRef = await Test.createTestingModule({
            providers: [
                ExecutionsService,
                { provide: ExecutionsRepository, useValue: repository },
                { provide: WorkflowsRepository, useValue: workflowsRepository },
                { provide: QueueService, useValue: queueService },
            ],
        }).compile();

        service = moduleRef.get(ExecutionsService);
    });

    describe('triggerManually', () => {
        it('records a PENDING execution, queues it by id and returns where to poll', async () => {
            workflowsRepository.existsForUser.mockResolvedValue(true);
            repository.create.mockResolvedValue(buildExecution());
            queueService.enqueueExecution.mockResolvedValue();

            const accepted = await service.triggerManually(USER_ID, WORKFLOW_ID);

            expect(repository.create).toHaveBeenCalledWith({
                workflowId: WORKFLOW_ID,
                triggerType: TriggerType.MANUAL,
                triggerPayload: undefined,
            });
            expect(queueService.enqueueExecution).toHaveBeenCalledWith({
                executionId: 'execution-1',
                workflowId: WORKFLOW_ID,
                triggerType: TriggerType.MANUAL,
            });
            expect(accepted).toEqual({
                executionId: 'execution-1',
                workflowId: WORKFLOW_ID,
                status: ExecutionStatus.PENDING,
                triggerType: TriggerType.MANUAL,
                statusUrl: '/api/v1/executions/execution-1',
                createdAt: expect.any(Date),
            });
        });

        it('throws 404 and creates nothing when the user does not own the workflow', async () => {
            workflowsRepository.existsForUser.mockResolvedValue(false);

            await expect(service.triggerManually(USER_ID, WORKFLOW_ID)).rejects.toBeInstanceOf(NotFoundException);
            expect(repository.create).not.toHaveBeenCalled();
        });
    });

    describe('createAndEnqueue', () => {
        it('stores the webhook payload on the execution', async () => {
            repository.create.mockResolvedValue(buildExecution({ triggerType: TriggerType.WEBHOOK }));
            queueService.enqueueExecution.mockResolvedValue();

            await service.createAndEnqueue(WORKFLOW_ID, TriggerType.WEBHOOK, { ref: 'main' });

            expect(repository.create).toHaveBeenCalledWith({
                workflowId: WORKFLOW_ID,
                triggerType: TriggerType.WEBHOOK,
                triggerPayload: { ref: 'main' },
            });
        });

        it('marks the execution FAILED instead of leaving it PENDING when the queue is down', async () => {
            repository.create.mockResolvedValue(buildExecution());
            repository.complete.mockResolvedValue();
            queueService.enqueueExecution.mockRejectedValue(new ServiceUnavailableException());

            await expect(service.createAndEnqueue(WORKFLOW_ID, TriggerType.MANUAL)).rejects.toBeInstanceOf(
                ServiceUnavailableException,
            );
            expect(repository.complete).toHaveBeenCalledWith('execution-1', ExecutionStatus.FAILED, QUEUE_UNAVAILABLE_REASON);
        });

        it('still reports the queue error if the execution cannot be marked failed', async () => {
            repository.create.mockResolvedValue(buildExecution());
            repository.complete.mockRejectedValue(new Error('database gone'));
            queueService.enqueueExecution.mockRejectedValue(new ServiceUnavailableException());

            await expect(service.createAndEnqueue(WORKFLOW_ID, TriggerType.MANUAL)).rejects.toBeInstanceOf(
                ServiceUnavailableException,
            );
        });
    });

    describe('findOne', () => {
        it('returns the execution with step details and computed durations', async () => {
            repository.findDetailsForUser.mockResolvedValue(
                buildExecutionWithDetails(
                    {
                        status: ExecutionStatus.SUCCESS,
                        startedAt: new Date('2026-09-14T10:00:00.000Z'),
                        completedAt: new Date('2026-09-14T10:00:02.500Z'),
                    },
                    [
                        buildExecutionStep({
                            status: ExecutionStatus.SUCCESS,
                            type: StepType.HTTP,
                            attempts: 2,
                            logs: 'POST https://example.com/hook → 200 after 2 attempt(s)',
                            startedAt: new Date('2026-09-14T10:00:00.100Z'),
                            completedAt: new Date('2026-09-14T10:00:01.100Z'),
                        }),
                    ],
                ),
            );

            const details = await service.findOne(USER_ID, 'execution-1');

            expect(repository.findDetailsForUser).toHaveBeenCalledWith('execution-1', USER_ID);
            expect(details).toMatchObject({
                id: 'execution-1',
                workflowName: 'Nightly sync',
                status: ExecutionStatus.SUCCESS,
                durationMs: 2500,
                triggerPayload: null,
                steps: [{ stepOrder: 1, attempts: 2, durationMs: 1000 }],
            });
        });

        it('throws 404 when the execution is missing or belongs to another user', async () => {
            repository.findDetailsForUser.mockResolvedValue(null);

            await expect(service.findOne(USER_ID, 'execution-1')).rejects.toThrow(
                new NotFoundException('Execution execution-1 not found'),
            );
        });
    });

    describe('listForWorkflow', () => {
        it('applies filters and returns paginated summaries', async () => {
            workflowsRepository.existsForUser.mockResolvedValue(true);
            repository.listForWorkflow.mockResolvedValue({
                items: [buildExecution({ status: ExecutionStatus.FAILED, errorMessage: 'Step 1 (HTTP) failed' })],
                totalItems: 1,
            });
            const query = Object.assign(new ListExecutionsQueryDto(), { status: ExecutionStatus.FAILED, limit: 10 });

            const result = await service.listForWorkflow(USER_ID, WORKFLOW_ID, query);

            expect(repository.listForWorkflow).toHaveBeenCalledWith({
                workflowId: WORKFLOW_ID,
                status: ExecutionStatus.FAILED,
                triggerType: undefined,
                page: 1,
                limit: 10,
            });
            expect(result.data).toEqual([expect.objectContaining({ status: 'FAILED', errorMessage: 'Step 1 (HTTP) failed' })]);
            expect(result.meta).toMatchObject({ page: 1, limit: 10, totalItems: 1, totalPages: 1 });
        });

        it('throws 404 for a workflow the user does not own', async () => {
            workflowsRepository.existsForUser.mockResolvedValue(false);

            await expect(
                service.listForWorkflow(USER_ID, WORKFLOW_ID, new ListExecutionsQueryDto()),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(repository.listForWorkflow).not.toHaveBeenCalled();
        });
    });
});
