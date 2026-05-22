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
exports.WorkflowRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let WorkflowRepository = class WorkflowRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createWorkflow(data) {
        return this.prisma.workflow.create({
            data,
            include: { steps: true },
        });
    }
    async getUserWorkflows(userId) {
        return this.prisma.workflow.findMany({
            where: { userId },
            include: { steps: true, _count: { select: { executions: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getWorkflowById(workflowId, userId) {
        return this.prisma.workflow.findFirst({
            where: { id: workflowId, userId },
            include: { steps: true },
        });
    }
    async updateStatus(workflowId, userId, status) {
        return this.prisma.workflow.update({
            where: { id: workflowId },
            data: { status },
        });
    }
    async deleteWorkflow(workflowId, userId) {
        // Delete in order to respect foreign key constraints
        // 1. Delete ExecutionStep records
        await this.prisma.executionStep.deleteMany({
            where: {
                execution: {
                    workflow: { id: workflowId, userId },
                },
            },
        });
        // 2. Delete Execution records
        await this.prisma.execution.deleteMany({
            where: {
                workflow: { id: workflowId, userId },
            },
        });
        // 3. Delete WorkflowStep records
        await this.prisma.workflowStep.deleteMany({
            where: { workflow: { id: workflowId, userId } },
        });
        // 4. Delete Workflow
        return this.prisma.workflow.delete({
            where: { id: workflowId },
        });
    }
};
exports.WorkflowRepository = WorkflowRepository;
exports.WorkflowRepository = WorkflowRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkflowRepository);
//# sourceMappingURL=workflow.repository.js.map