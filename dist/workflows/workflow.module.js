"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const database_module_1 = require("../database/database.module");
const workflow_controller_1 = require("./controllers/workflow.controller");
const workflow_service_1 = require("./services/workflow.service");
const workflow_repository_1 = require("./repositories/workflow.repository");
let WorkflowModule = class WorkflowModule {
    constructor(moduleRef, workflowService) {
        this.moduleRef = moduleRef;
        this.workflowService = workflowService;
    }
    async onModuleInit() {
        // Lazy-load SchedulerService to break circular dependency
        try {
            const { SchedulerService } = await Promise.resolve().then(() => __importStar(require('../scheduler/services/scheduler.service')));
            const svc = this.moduleRef.get(SchedulerService, { strict: false });
            this.workflowService.setSchedulerService(svc);
        }
        catch (_) {
            // SchedulerModule not yet initialised — jobs will be loaded on bootstrap
        }
    }
};
exports.WorkflowModule = WorkflowModule;
exports.WorkflowModule = WorkflowModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [workflow_controller_1.WorkflowController],
        providers: [workflow_service_1.WorkflowService, workflow_repository_1.WorkflowRepository],
        exports: [workflow_service_1.WorkflowService, workflow_repository_1.WorkflowRepository],
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        workflow_service_1.WorkflowService])
], WorkflowModule);
//# sourceMappingURL=workflow.module.js.map