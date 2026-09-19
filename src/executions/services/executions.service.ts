import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExecutionStatus, Prisma, TriggerType } from '@prisma/client';
import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { errorMessage } from '../../common/utils/error.util';
import { QueueService } from '../../queues/services/queue.service';
import { WorkflowsRepository } from '../../workflows/repositories/workflows.repository';
import {
    ExecutionAcceptedDto,
    ExecutionDetailsDto,
    PaginatedExecutionsResponseDto,
} from '../dto/execution-response.dto';
import { ListExecutionsQueryDto } from '../dto/list-executions-query.dto';
import { toExecutionAccepted, toExecutionDetails, toExecutionSummary } from '../execution.mapper';
import { ExecutionsRepository } from '../repositories/executions.repository';

export const QUEUE_UNAVAILABLE_REASON = 'Execution could not be queued because the job queue was unavailable';

@Injectable()
export class ExecutionsService {
    private readonly logger = new Logger(ExecutionsService.name);

    constructor(
        private readonly repository: ExecutionsRepository,
        private readonly workflowsRepository: WorkflowsRepository,
        private readonly queueService: QueueService,
    ) {}

    async triggerManually(userId: string, workflowId: string): Promise<ExecutionAcceptedDto> {
        await this.assertWorkflowOwned(userId, workflowId);
        return this.createAndEnqueue(workflowId, TriggerType.MANUAL);
    }

    /**
     * Records a PENDING execution, then queues it. The row is written first so the caller receives an
     * id immediately; if queueing fails the row is marked FAILED rather than left PENDING forever.
     */
    async createAndEnqueue(
        workflowId: string,
        triggerType: TriggerType,
        triggerPayload?: Prisma.InputJsonValue,
    ): Promise<ExecutionAcceptedDto> {
        const execution = await this.repository.create({ workflowId, triggerType, triggerPayload });

        try {
            await this.queueService.enqueueExecution({ executionId: execution.id, workflowId, triggerType });
        } catch (error) {
            await this.repository
                .complete(execution.id, ExecutionStatus.FAILED, QUEUE_UNAVAILABLE_REASON)
                .catch((markError: unknown) =>
                    this.logger.error(`Could not mark execution ${execution.id} as failed: ${errorMessage(markError)}`),
                );
            throw error;
        }

        this.logger.log(`Execution ${execution.id} queued (${triggerType}) for workflow ${workflowId}`);
        return toExecutionAccepted(execution);
    }

    async findOne(userId: string, executionId: string): Promise<ExecutionDetailsDto> {
        const execution = await this.repository.findDetailsForUser(executionId, userId);
        if (!execution) {
            throw new NotFoundException(`Execution ${executionId} not found`);
        }
        return toExecutionDetails(execution);
    }

    async listForWorkflow(
        userId: string,
        workflowId: string,
        query: ListExecutionsQueryDto,
    ): Promise<PaginatedExecutionsResponseDto> {
        await this.assertWorkflowOwned(userId, workflowId);

        const { items, totalItems } = await this.repository.listForWorkflow({
            workflowId,
            status: query.status,
            triggerType: query.triggerType,
            page: query.page,
            limit: query.limit,
        });

        return {
            data: items.map(toExecutionSummary),
            meta: buildPaginationMeta(query.page, query.limit, totalItems),
        };
    }

    private async assertWorkflowOwned(userId: string, workflowId: string): Promise<void> {
        if (!(await this.workflowsRepository.existsForUser(workflowId, userId))) {
            throw new NotFoundException(`Workflow ${workflowId} not found`);
        }
    }
}
