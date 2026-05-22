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
exports.CreateWorkflowDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
var StepType;
(function (StepType) {
    StepType["HTTP"] = "HTTP";
    StepType["DELAY"] = "DELAY";
})(StepType || (StepType = {}));
class WorkflowStepDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], WorkflowStepDto.prototype, "stepOrder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: StepType, example: 'HTTP' }),
    (0, class_validator_1.IsEnum)(StepType),
    __metadata("design:type", String)
], WorkflowStepDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: { url: 'https://api.example.com/notify', method: 'POST' },
        description: 'For HTTP: { url, method }. For DELAY: { duration (ms) }',
    }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Object)
], WorkflowStepDto.prototype, "config", void 0);
class CreateWorkflowDto {
}
exports.CreateWorkflowDto = CreateWorkflowDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Daily Report' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Sends a daily report at 8am' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0 8 * * *', description: 'Standard cron expression (5-field)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "cronExpression", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [WorkflowStepDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => WorkflowStepDto),
    __metadata("design:type", Array)
], CreateWorkflowDto.prototype, "steps", void 0);
//# sourceMappingURL=create-workflow.dto.js.map