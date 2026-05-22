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
exports.ExecutionRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let ExecutionRepository = class ExecutionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createExecution(workflowId, triggerType = 'MANUAL') {
        return this.prisma.execution.create({ data: { workflowId, triggerType } });
    }
    async getExecutionById(executionId) {
        return this.prisma.execution.findUnique({
            where: { id: executionId },
            include: {
                workflow: { select: { name: true, cronExpression: true } },
                steps: { orderBy: { createdAt: 'asc' } },
            },
        });
    }
    async listByWorkflow(workflowId, limit = 20, offset = 0) {
        const [executions, total] = await Promise.all([
            this.prisma.execution.findMany({
                where: { workflowId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                include: { steps: { select: { status: true, stepOrder: true } } },
            }),
            this.prisma.execution.count({ where: { workflowId } }),
        ]);
        return { executions, total, limit, offset };
    }
    async updateExecutionStatus(executionId, status) {
        return this.prisma.execution.update({
            where: { id: executionId },
            data: {
                status,
                completedAt: status === 'SUCCESS' || status === 'FAILED' ? new Date() : undefined,
            },
        });
    }
    async createExecutionStep(data) {
        return this.prisma.executionStep.create({ data });
    }
    async updateExecutionStep(executionStepId, data) {
        return this.prisma.executionStep.update({ where: { id: executionStepId }, data });
    }
};
exports.ExecutionRepository = ExecutionRepository;
exports.ExecutionRepository = ExecutionRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExecutionRepository);
//# sourceMappingURL=execution.repository.js.map