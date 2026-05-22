"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionsModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../database/database.module");
const queues_module_1 = require("../queues/queues.module");
const workflow_module_1 = require("../workflows/workflow.module");
const execution_controller_1 = require("./controllers/execution.controller");
const execution_query_controller_1 = require("./controllers/execution-query.controller");
const execution_service_1 = require("./services/execution.service");
const execution_repository_1 = require("./repositories/execution.repository");
let ExecutionsModule = class ExecutionsModule {
};
exports.ExecutionsModule = ExecutionsModule;
exports.ExecutionsModule = ExecutionsModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, queues_module_1.QueuesModule, workflow_module_1.WorkflowModule],
        controllers: [execution_controller_1.ExecutionController, execution_query_controller_1.ExecutionQueryController],
        providers: [execution_service_1.ExecutionService, execution_repository_1.ExecutionRepository],
        exports: [execution_service_1.ExecutionService, execution_repository_1.ExecutionRepository],
    })
], ExecutionsModule);
//# sourceMappingURL=executions.module.js.map