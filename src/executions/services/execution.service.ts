import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowRepository } from '../../workflows/repositories/workflow.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { QueueService } from '../../queues/services/queue.service';

@Injectable()
export class ExecutionService {
    constructor(
        private readonly workflowRepository: WorkflowRepository,
        private readonly executionRepository: ExecutionRepository,
        private readonly queueService: QueueService,
    ) {}

    async triggerWorkflow(workflowId: string, userId: string) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow) throw new NotFoundException('Workflow not found');

        const execution = await this.executionRepository.createExecution(workflow.id, 'MANUAL');

        await this.queueService.addWorkflowJob({
            executionId: execution.id,
            workflowId: workflow.id,
        });

        return { message: 'Workflow execution started', executionId: execution.id };
    }

    async getExecutionHistory(executionId: string, userId: string) {
        const execution = await this.executionRepository.getExecutionById(executionId);
        if (!execution) throw new NotFoundException('Execution not found');

        const workflow = await this.workflowRepository.getWorkflowById(execution.workflowId, userId);
        if (!workflow) throw new NotFoundException('Workflow not found or unauthorized');

        return execution;
    }

    async listExecutions(workflowId: string, userId: string, limit: number, offset: number) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow) throw new NotFoundException('Workflow not found');

        return this.executionRepository.listByWorkflow(workflowId, limit, offset);
    }
}
