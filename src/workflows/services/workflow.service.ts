import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { WorkflowRepository } from '../repositories/workflow.repository';

@Injectable()
export class WorkflowService {
    // SchedulerService injected lazily to avoid circular dep
    private schedulerService: any;

    constructor(
        private readonly workflowRepository: WorkflowRepository,
    ) {}

    setSchedulerService(svc: any) {
        this.schedulerService = svc;
    }

    async createWorkflow(userId: string, dto: CreateWorkflowDto) {
        const workflow = await this.workflowRepository.createWorkflow({
            name: dto.name,
            description: dto.description,
            cronExpression: dto.cronExpression,
            userId,
            steps: {
                create: dto.steps.map((step) => ({
                    stepOrder: step.stepOrder,
                    type: step.type,
                    config: step.config,
                })),
            },
        });

        // Register in scheduler (starts automatically)
        this.schedulerService?.register(workflow.id, workflow.cronExpression);

        return { message: 'Workflow created successfully', workflow };
    }

    async getUserWorkflows(userId: string) {
        return this.workflowRepository.getUserWorkflows(userId);
    }

    async getWorkflowById(workflowId: string, userId: string) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow) throw new NotFoundException('Workflow not found');
        return workflow;
    }

    async pauseWorkflow(workflowId: string, userId: string) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow) throw new NotFoundException('Workflow not found');

        const updated = await this.workflowRepository.updateStatus(workflowId, userId, 'PAUSED');
        this.schedulerService?.unregister(workflowId);

        return { message: 'Workflow paused', workflow: updated };
    }

    async resumeWorkflow(workflowId: string, userId: string) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow) throw new NotFoundException('Workflow not found');

        const updated = await this.workflowRepository.updateStatus(workflowId, userId, 'ACTIVE');
        this.schedulerService?.register(workflowId, workflow.cronExpression);

        return { message: 'Workflow resumed', workflow: updated };
    }

    async deleteWorkflow(workflowId: string, userId: string) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow) throw new NotFoundException('Workflow not found');

        this.schedulerService?.unregister(workflowId);
        await this.workflowRepository.deleteWorkflow(workflowId, userId);

        return { message: 'Workflow deleted successfully' };
    }
}
