import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StepType, WorkflowStatus } from '@prisma/client';
import { buildWorkflow, buildWorkflowWithCounts } from '../../../test/utils/factories';
import { createMock } from '../../../test/utils/mocks';
import { SchedulerService } from '../../scheduler/services/scheduler.service';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { ListWorkflowsQueryDto } from '../dto/list-workflows-query.dto';
import { WorkflowsRepository } from '../repositories/workflows.repository';
import { HttpMethod } from '../step-config';
import { WorkflowsService } from './workflows.service';

const USER_ID = 'user-1';
const WORKFLOW_ID = 'workflow-1';

function buildCreateDto(overrides: Partial<CreateWorkflowDto> = {}): CreateWorkflowDto {
    return {
        name: 'Nightly sync',
        cronExpression: '0 2 * * *',
        steps: [{ stepOrder: 1, type: StepType.HTTP, config: { url: 'https://example.com/hook', method: HttpMethod.POST } }],
        ...overrides,
    };
}

describe('WorkflowsService', () => {
    let service: WorkflowsService;
    let repository: jest.Mocked<WorkflowsRepository>;
    let scheduler: jest.Mocked<SchedulerService>;

    beforeEach(async () => {
        repository = createMock<WorkflowsRepository>([
            'create',
            'findManyForUser',
            'findOneForUser',
            'update',
            'updateStatus',
            'delete',
        ]);
        scheduler = createMock<SchedulerService>(['upsertSchedule', 'removeSchedule']);

        const moduleRef = await Test.createTestingModule({
            providers: [
                WorkflowsService,
                { provide: WorkflowsRepository, useValue: repository },
                { provide: SchedulerService, useValue: scheduler },
            ],
        }).compile();

        service = moduleRef.get(WorkflowsService);
    });

    describe('create', () => {
        it('persists the workflow with a secure webhook token and registers its schedule', async () => {
            const created = buildWorkflow();
            repository.create.mockResolvedValue(created);
            scheduler.upsertSchedule.mockResolvedValue();

            const result = await service.create(USER_ID, buildCreateDto({ timezone: 'Europe/London' }));

            expect(repository.create).toHaveBeenCalledWith(USER_ID, {
                name: 'Nightly sync',
                description: undefined,
                cronExpression: '0 2 * * *',
                timezone: 'Europe/London',
                webhookToken: expect.stringMatching(/^[\w-]{32}$/),
                steps: [
                    {
                        stepOrder: 1,
                        type: StepType.HTTP,
                        config: { url: 'https://example.com/hook', method: 'POST' },
                        retryCount: undefined,
                        timeout: undefined,
                    },
                ],
            });
            expect(scheduler.upsertSchedule).toHaveBeenCalledWith(created);
            expect(result).toMatchObject({
                id: WORKFLOW_ID,
                status: WorkflowStatus.ACTIVE,
                webhookToken: 'webhook-token',
                steps: [expect.objectContaining({ stepOrder: 1, type: StepType.HTTP })],
            });
            expect(result.nextRunAt).toBeInstanceOf(Date);
        });

        it('generates a different webhook token for every workflow', async () => {
            repository.create.mockResolvedValue(buildWorkflow());
            scheduler.upsertSchedule.mockResolvedValue();

            await service.create(USER_ID, buildCreateDto());
            await service.create(USER_ID, buildCreateDto());

            const [first, second] = repository.create.mock.calls.map(([, workflow]) => workflow.webhookToken);
            expect(first).not.toEqual(second);
        });

        it('rolls the workflow back and rethrows when the schedule cannot be registered', async () => {
            repository.create.mockResolvedValue(buildWorkflow());
            repository.delete.mockResolvedValue();
            scheduler.upsertSchedule.mockRejectedValue(new ServiceUnavailableException());

            await expect(service.create(USER_ID, buildCreateDto())).rejects.toBeInstanceOf(ServiceUnavailableException);
            expect(repository.delete).toHaveBeenCalledWith(WORKFLOW_ID);
        });

        it('still surfaces the scheduler error when the rollback also fails', async () => {
            repository.create.mockResolvedValue(buildWorkflow());
            repository.delete.mockRejectedValue(new Error('database gone'));
            scheduler.upsertSchedule.mockRejectedValue(new ServiceUnavailableException());

            await expect(service.create(USER_ID, buildCreateDto())).rejects.toBeInstanceOf(ServiceUnavailableException);
        });
    });

    describe('list', () => {
        it('passes filters to the repository and returns summaries with pagination metadata', async () => {
            repository.findManyForUser.mockResolvedValue({
                items: [buildWorkflowWithCounts({ _count: { steps: 2, executions: 5 } })],
                totalItems: 45,
            });
            const query = Object.assign(new ListWorkflowsQueryDto(), {
                page: 2,
                limit: 20,
                status: WorkflowStatus.ACTIVE,
                search: 'sync',
            });

            const result = await service.list(USER_ID, query);

            expect(repository.findManyForUser).toHaveBeenCalledWith({
                userId: USER_ID,
                status: WorkflowStatus.ACTIVE,
                search: 'sync',
                page: 2,
                limit: 20,
                sortBy: 'createdAt',
                sortOrder: 'desc',
            });
            expect(result.meta).toEqual({
                page: 2,
                limit: 20,
                totalItems: 45,
                totalPages: 3,
                hasNextPage: true,
                hasPreviousPage: true,
            });
            expect(result.data).toHaveLength(1);
            expect(result.data[0]).toMatchObject({ id: WORKFLOW_ID, stepCount: 2, executionCount: 5 });
            expect(result.data[0]).not.toHaveProperty('webhookToken');
        });

        it('treats a blank search as no search and reports an empty page', async () => {
            repository.findManyForUser.mockResolvedValue({ items: [], totalItems: 0 });

            const result = await service.list(USER_ID, Object.assign(new ListWorkflowsQueryDto(), { search: '' }));

            expect(repository.findManyForUser).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
            expect(result.meta).toMatchObject({ totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
        });
    });

    describe('findOne', () => {
        it('returns the workflow owned by the user', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow());

            await expect(service.findOne(USER_ID, WORKFLOW_ID)).resolves.toMatchObject({ id: WORKFLOW_ID });
            expect(repository.findOneForUser).toHaveBeenCalledWith(WORKFLOW_ID, USER_ID);
        });

        it('throws 404 when the workflow does not exist or belongs to someone else', async () => {
            repository.findOneForUser.mockResolvedValue(null);

            await expect(service.findOne(USER_ID, 'missing')).rejects.toThrow(new NotFoundException('Workflow missing not found'));
        });
    });

    describe('update', () => {
        it('rejects an update with no fields', async () => {
            await expect(service.update(USER_ID, WORKFLOW_ID, {})).rejects.toBeInstanceOf(BadRequestException);
            expect(repository.findOneForUser).not.toHaveBeenCalled();
        });

        it('applies field changes and replaces steps without rescheduling when the schedule is unchanged', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow());
            repository.update.mockResolvedValue(buildWorkflow({ name: 'Renamed' }));

            const result = await service.update(USER_ID, WORKFLOW_ID, {
                name: 'Renamed',
                steps: [{ stepOrder: 1, type: StepType.DELAY, config: { duration: 500 } }],
            });

            expect(repository.update).toHaveBeenCalledWith(WORKFLOW_ID, { name: 'Renamed' }, [
                { stepOrder: 1, type: StepType.DELAY, config: { duration: 500 }, retryCount: undefined, timeout: undefined },
            ]);
            expect(scheduler.upsertSchedule).not.toHaveBeenCalled();
            expect(result.name).toBe('Renamed');
        });

        it('reschedules an active workflow when its cron expression changes', async () => {
            const updated = buildWorkflow({ cronExpression: '*/5 * * * *' });
            repository.findOneForUser.mockResolvedValue(buildWorkflow());
            repository.update.mockResolvedValue(updated);
            scheduler.upsertSchedule.mockResolvedValue();

            await service.update(USER_ID, WORKFLOW_ID, { cronExpression: '*/5 * * * *' });

            expect(repository.update).toHaveBeenCalledWith(WORKFLOW_ID, { cronExpression: '*/5 * * * *' }, undefined);
            expect(scheduler.upsertSchedule).toHaveBeenCalledWith(updated);
        });

        it('does not schedule a paused workflow when its timezone changes', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow({ status: WorkflowStatus.PAUSED }));
            repository.update.mockResolvedValue(buildWorkflow({ status: WorkflowStatus.PAUSED, timezone: 'Asia/Tokyo' }));

            await service.update(USER_ID, WORKFLOW_ID, { timezone: 'Asia/Tokyo' });

            expect(scheduler.upsertSchedule).not.toHaveBeenCalled();
        });

        it('throws 404 for a workflow the user does not own', async () => {
            repository.findOneForUser.mockResolvedValue(null);

            await expect(service.update(USER_ID, WORKFLOW_ID, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
            expect(repository.update).not.toHaveBeenCalled();
        });
    });

    describe('pause', () => {
        it('removes the schedule before marking the workflow paused', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow());
            repository.updateStatus.mockResolvedValue(buildWorkflow({ status: WorkflowStatus.PAUSED }));
            scheduler.removeSchedule.mockResolvedValue();

            const result = await service.pause(USER_ID, WORKFLOW_ID);

            expect(scheduler.removeSchedule).toHaveBeenCalledWith(WORKFLOW_ID);
            expect(repository.updateStatus).toHaveBeenCalledWith(WORKFLOW_ID, WorkflowStatus.PAUSED);
            expect(scheduler.removeSchedule.mock.invocationCallOrder[0]).toBeLessThan(
                repository.updateStatus.mock.invocationCallOrder[0],
            );
            expect(result).toMatchObject({ status: WorkflowStatus.PAUSED, nextRunAt: null });
        });

        it('throws 409 when the workflow is already paused', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow({ status: WorkflowStatus.PAUSED }));

            await expect(service.pause(USER_ID, WORKFLOW_ID)).rejects.toThrow(
                new ConflictException('Workflow is already paused'),
            );
        });

        it('leaves the status unchanged when the schedule cannot be removed', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow());
            scheduler.removeSchedule.mockRejectedValue(new ServiceUnavailableException());

            await expect(service.pause(USER_ID, WORKFLOW_ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
            expect(repository.updateStatus).not.toHaveBeenCalled();
        });
    });

    describe('resume', () => {
        it('marks the workflow active and registers its schedule', async () => {
            const resumed = buildWorkflow();
            repository.findOneForUser.mockResolvedValue(buildWorkflow({ status: WorkflowStatus.PAUSED }));
            repository.updateStatus.mockResolvedValue(resumed);
            scheduler.upsertSchedule.mockResolvedValue();

            const result = await service.resume(USER_ID, WORKFLOW_ID);

            expect(repository.updateStatus).toHaveBeenCalledWith(WORKFLOW_ID, WorkflowStatus.ACTIVE);
            expect(scheduler.upsertSchedule).toHaveBeenCalledWith(resumed);
            expect(result.status).toBe(WorkflowStatus.ACTIVE);
        });

        it('throws 409 when the workflow is already active', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow());

            await expect(service.resume(USER_ID, WORKFLOW_ID)).rejects.toThrow(
                new ConflictException('Workflow is already active'),
            );
        });

        it('reverts to PAUSED when the schedule cannot be registered', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow({ status: WorkflowStatus.PAUSED }));
            repository.updateStatus.mockResolvedValue(buildWorkflow());
            scheduler.upsertSchedule.mockRejectedValue(new ServiceUnavailableException());

            await expect(service.resume(USER_ID, WORKFLOW_ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
            expect(repository.updateStatus.mock.calls).toEqual([
                [WORKFLOW_ID, WorkflowStatus.ACTIVE],
                [WORKFLOW_ID, WorkflowStatus.PAUSED],
            ]);
        });
    });

    describe('remove', () => {
        it('removes the schedule and deletes the workflow', async () => {
            repository.findOneForUser.mockResolvedValue(buildWorkflow());
            scheduler.removeSchedule.mockResolvedValue();
            repository.delete.mockResolvedValue();

            await service.remove(USER_ID, WORKFLOW_ID);

            expect(scheduler.removeSchedule).toHaveBeenCalledWith(WORKFLOW_ID);
            expect(repository.delete).toHaveBeenCalledWith(WORKFLOW_ID);
        });

        it('throws 404 without touching the scheduler when the workflow is not found', async () => {
            repository.findOneForUser.mockResolvedValue(null);

            await expect(service.remove(USER_ID, WORKFLOW_ID)).rejects.toBeInstanceOf(NotFoundException);
            expect(scheduler.removeSchedule).not.toHaveBeenCalled();
            expect(repository.delete).not.toHaveBeenCalled();
        });
    });
});
