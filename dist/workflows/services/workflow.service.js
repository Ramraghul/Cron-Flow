"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const common_1 = require("@nestjs/common");
const workflow_repository_1 = require("../repositories/workflow.repository");
let WorkflowService = class WorkflowService {
    constructor(workflowRepository) {
        this.workflowRepository = workflowRepository;
    }
    setSchedulerService(svc) {
        this.schedulerService = svc;
    }
    async createWorkflow(userId, dto) {
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
    async getUserWorkflows(userId) {
        return this.workflowRepository.getUserWorkflows(userId);
    }
    async getWorkflowById(workflowId, userId) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow)
            throw new common_1.NotFoundException('Workflow not found');
        return workflow;
    }
    async pauseWorkflow(workflowId, userId) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow)
            throw new common_1.NotFoundException('Workflow not found');
        const updated = await this.workflowRepository.updateStatus(workflowId, userId, 'PAUSED');
        this.schedulerService?.unregister(workflowId);
        return { message: 'Workflow paused', workflow: updated };
    }
    async resumeWorkflow(workflowId, userId) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow)
            throw new common_1.NotFoundException('Workflow not found');
        const updated = await this.workflowRepository.updateStatus(workflowId, userId, 'ACTIVE');
        this.schedulerService?.register(workflowId, workflow.cronExpression);
        return { message: 'Workflow resumed', workflow: updated };
    }
    async deleteWorkflow(workflowId, userId) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow)
            throw new common_1.NotFoundException('Workflow not found');
        this.schedulerService?.unregister(workflowId);
        await this.workflowRepository.deleteWorkflow(workflowId, userId);
        return { message: 'Workflow deleted successfully' };
    }
};
exports.WorkflowService = WorkflowService;
exports.WorkflowService = WorkflowService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workflow_repository_1.WorkflowRepository])
], WorkflowService);
//# sourceMappingURL=workflow.service.js.map