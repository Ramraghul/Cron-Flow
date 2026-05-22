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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../auth/guards/jwt-auth.guard");
const execution_service_1 = require("../services/execution.service");
let ExecutionController = class ExecutionController {
    constructor(executionService) {
        this.executionService = executionService;
    }
    trigger(workflowId, req) {
        return this.executionService.triggerWorkflow(workflowId, req.user.id);
    }
    getExecution(executionId, req) {
        return this.executionService.getExecutionHistory(executionId, req.user.id);
    }
};
exports.ExecutionController = ExecutionController;
__decorate([
    (0, common_1.Post)(':workflowId/trigger'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger a workflow execution' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Execution queued' }),
    __param(0, (0, common_1.Param)('workflowId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ExecutionController.prototype, "trigger", null);
__decorate([
    (0, common_1.Get)(':executionId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get execution details including step logs' }),
    __param(0, (0, common_1.Param)('executionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ExecutionController.prototype, "getExecution", null);
exports.ExecutionController = ExecutionController = __decorate([
    (0, swagger_1.ApiTags)('Executions'),
    (0, swagger_1.ApiBearerAuth)('JWT'),
    (0, swagger_1.ApiSecurity)('ApiKey'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('executions'),
    __metadata("design:paramtypes", [execution_service_1.ExecutionService])
], ExecutionController);
//# sourceMappingURL=execution.controller.js.map