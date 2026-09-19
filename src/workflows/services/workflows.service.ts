import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WorkflowStatus } from '@prisma/client';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { errorMessage } from '../../common/utils/error.util';
import { SchedulerService } from '../../scheduler/services/scheduler.service';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { ListWorkflowsQueryDto } from '../dto/list-workflows-query.dto';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { PaginatedWorkflowsResponseDto, WorkflowResponseDto } from '../dto/workflow-response.dto';
import { WorkflowsRepository, WorkflowWithSteps } from '../repositories/workflows.repository';
import { generateWebhookToken, toStepInput, toWorkflowResponse, toWorkflowSummary } from '../workflow.mapper';

/**
 * Workflow lifecycle. PostgreSQL is the source of truth; the Redis cron schedule is kept in sync
 * on every state change, with compensating writes when Redis is unavailable.
 */
@Injectable()
export class WorkflowsService {
    private readonly logger = new Logger(WorkflowsService.name);

    constructor(
        private readonly repository: WorkflowsRepository,
        private readonly scheduler: SchedulerService,
    ) {}

    async create(userId: string, dto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
        const workflow = await this.repository.create(userId, {
            name: dto.name,
            description: dto.description,
            cronExpression: dto.cronExpression,
            timezone: dto.timezone,
            webhookToken: generateWebhookToken(),
            steps: dto.steps.map(toStepInput),
        });

        try {
            await this.scheduler.upsertSchedule(workflow);
        } catch (error) {
            // Never keep a workflow that reports ACTIVE but will never run on schedule.
            await this.repository
                .delete(workflow.id)
                .catch((cleanupError: unknown) =>
                    this.logger.error(`Could not roll back workflow ${workflow.id}: ${errorMessage(cleanupError)}`),
                );
            throw error;
        }

        this.logger.log(`Workflow ${workflow.id} created by user ${userId}`);
        return toWorkflowResponse(workflow);
    }

    async list(userId: string, query: ListWorkflowsQueryDto): Promise<PaginatedWorkflowsResponseDto> {
        const { items, totalItems } = await this.repository.findManyForUser({
            userId,
            status: query.status,
            search: query.search || undefined,
            page: query.page,
            limit: query.limit,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
        });

        return {
            data: items.map(toWorkflowSummary),
            meta: buildPaginationMeta(query.page, query.limit, totalItems),
        };
    }

    async findOne(userId: string, workflowId: string): Promise<WorkflowResponseDto> {
        return toWorkflowResponse(await this.findOwnedWorkflow(userId, workflowId));
    }

    async update(userId: string, workflowId: string, dto: UpdateWorkflowDto): Promise<WorkflowResponseDto> {
        const { steps, ...changes } = dto;
        if (steps === undefined && Object.values(changes).every((value) => value === undefined)) {
            throw new BadRequestException('Provide at least one field to update');
        }

        const existing = await this.findOwnedWorkflow(userId, workflowId);
        const updated = await this.repository.update(workflowId, changes, steps?.map(toStepInput));

        const scheduleChanged =
            updated.cronExpression !== existing.cronExpression || updated.timezone !== existing.timezone;
        if (scheduleChanged && updated.status === WorkflowStatus.ACTIVE) {
            await this.scheduler.upsertSchedule(updated);
        }

        return toWorkflowResponse(updated);
    }

    async pause(userId: string, workflowId: string): Promise<WorkflowResponseDto> {
        const workflow = await this.findOwnedWorkflow(userId, workflowId);
        if (workflow.status === WorkflowStatus.PAUSED) {
            throw new ConflictException('Workflow is already paused');
        }

        // Remove the schedule first: if Redis is down the request fails before any state changes.
        await this.scheduler.removeSchedule(workflow.id);
        const paused = await this.repository.updateStatus(workflow.id, WorkflowStatus.PAUSED);

        this.logger.log(`Workflow ${workflow.id} paused`);
        return toWorkflowResponse(paused);
    }

    async resume(userId: string, workflowId: string): Promise<WorkflowResponseDto> {
        const workflow = await this.findOwnedWorkflow(userId, workflowId);
        if (workflow.status === WorkflowStatus.ACTIVE) {
            throw new ConflictException('Workflow is already active');
        }

        const resumed = await this.repository.updateStatus(workflow.id, WorkflowStatus.ACTIVE);
        try {
            await this.scheduler.upsertSchedule(resumed);
        } catch (error) {
            await this.repository.updateStatus(workflow.id, WorkflowStatus.PAUSED);
            throw error;
        }

        this.logger.log(`Workflow ${workflow.id} resumed`);
        return toWorkflowResponse(resumed);
    }

    async remove(userId: string, workflowId: string): Promise<void> {
        const workflow = await this.findOwnedWorkflow(userId, workflowId);
        await this.scheduler.removeSchedule(workflow.id);
        await this.repository.delete(workflow.id);
        this.logger.log(`Workflow ${workflow.id} deleted`);
    }

    /** Other users' workflows return 404 rather than 403, so ids cannot be probed for existence. */
    private async findOwnedWorkflow(userId: string, workflowId: string): Promise<WorkflowWithSteps> {
        const workflow = await this.repository.findOneForUser(workflowId, userId);
        if (!workflow) {
            throw new NotFoundException(`Workflow ${workflowId} not found`);
        }
        return workflow;
    }
}
