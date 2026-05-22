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
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const cron_1 = require("cron");
const prisma_service_1 = require("../../database/prisma.service");
const queue_service_1 = require("../../queues/services/queue.service");
let SchedulerService = SchedulerService_1 = class SchedulerService {
    constructor(prisma, queueService, schedulerRegistry) {
        this.prisma = prisma;
        this.queueService = queueService;
        this.schedulerRegistry = schedulerRegistry;
        this.logger = new common_1.Logger(SchedulerService_1.name);
    }
    async onApplicationBootstrap() {
        await this.loadAndRegisterAll();
    }
    onApplicationShutdown() {
        this.unregisterAll();
    }
    // ── Public API used by WorkflowService ─────────────────────────────────
    register(workflowId, cronExpression) {
        this.unregister(workflowId); // idempotent
        const job = new cron_1.CronJob(cronExpression, () => this.dispatch(workflowId));
        this.schedulerRegistry.addCronJob(workflowId, job);
        job.start();
        this.logger.log(`Registered cron job for workflow ${workflowId}: ${cronExpression}`);
    }
    unregister(workflowId) {
        try {
            this.schedulerRegistry.deleteCronJob(workflowId);
            this.logger.log(`Unregistered cron job for workflow ${workflowId}`);
        }
        catch (_) {
            // Job didn't exist — ignore
        }
    }
    listJobs() {
        const jobs = this.schedulerRegistry.getCronJobs();
        const result = [];
        jobs.forEach((job, name) => {
            result.push({
                workflowId: name,
                nextRun: job.nextDate()?.toJSDate() ?? null,
                running: job.running ?? false,
            });
        });
        return result;
    }
    // ── Private helpers ─────────────────────────────────────────────────────
    async loadAndRegisterAll() {
        const workflows = await this.prisma.workflow.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, cronExpression: true },
        });
        for (const wf of workflows) {
            try {
                this.register(wf.id, wf.cronExpression);
            }
            catch (err) {
                this.logger.warn(`Invalid cron for workflow ${wf.id}: ${err.message}`);
            }
        }
        this.logger.log(`Scheduler loaded ${workflows.length} active workflow(s)`);
    }
    unregisterAll() {
        const jobs = this.schedulerRegistry.getCronJobs();
        jobs.forEach((_, name) => this.unregister(name));
    }
    async dispatch(workflowId) {
        try {
            const execution = await this.prisma.execution.create({
                data: { workflowId, triggerType: 'CRON' },
            });
            await this.queueService.addWorkflowJob({
                executionId: execution.id,
                workflowId,
            });
            this.logger.log(`Cron dispatched execution ${execution.id} for workflow ${workflowId}`);
        }
        catch (err) {
            this.logger.error(`Failed to dispatch cron job for workflow ${workflowId}: ${err.message}`);
        }
    }
};
exports.SchedulerService = SchedulerService;
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        queue_service_1.QueueService,
        schedule_1.SchedulerRegistry])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map