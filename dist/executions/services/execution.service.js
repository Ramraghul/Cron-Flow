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
exports.ExecutionService = void 0;
const common_1 = require("@nestjs/common");
const workflow_repository_1 = require("../../workflows/repositories/workflow.repository");
const execution_repository_1 = require("../repositories/execution.repository");
const queue_service_1 = require("../../queues/services/queue.service");
let ExecutionService = class ExecutionService {
    constructor(workflowRepository, executionRepository, queueService) {
        this.workflowRepository = workflowRepository;
        this.executionRepository = executionRepository;
        this.queueService = queueService;
    }
    async triggerWorkflow(workflowId, userId) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow)
            throw new common_1.NotFoundException('Workflow not found');
        const execution = await this.executionRepository.createExecution(workflow.id, 'MANUAL');
        await this.queueService.addWorkflowJob({
            executionId: execution.id,
            workflowId: workflow.id,
        });
        return { message: 'Workflow execution started', executionId: execution.id };
    }
    async getExecutionHistory(executionId, userId) {
        const execution = await this.executionRepository.getExecutionById(executionId);
        if (!execution)
            throw new common_1.NotFoundException('Execution not found');
        const workflow = await this.workflowRepository.getWorkflowById(execution.workflowId, userId);
        if (!workflow)
            throw new common_1.NotFoundException('Workflow not found or unauthorized');
        return execution;
    }
    async listExecutions(workflowId, userId, limit, offset) {
        const workflow = await this.workflowRepository.getWorkflowById(workflowId, userId);
        if (!workflow)
            throw new common_1.NotFoundException('Workflow not found');
        return this.executionRepository.listByWorkflow(workflowId, limit, offset);
    }
};
exports.ExecutionService = ExecutionService;
exports.ExecutionService = ExecutionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workflow_repository_1.WorkflowRepository,
        execution_repository_1.ExecutionRepository,
        queue_service_1.QueueService])
], ExecutionService);
//# sourceMappingURL=execution.service.js.map