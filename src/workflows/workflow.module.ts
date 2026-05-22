import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { WorkflowController } from './controllers/workflow.controller';
import { WorkflowService } from './services/workflow.service';
import { WorkflowRepository } from './repositories/workflow.repository';

@Module({
    imports: [DatabaseModule],
    controllers: [WorkflowController],
    providers: [WorkflowService, WorkflowRepository],
    exports: [WorkflowService, WorkflowRepository],
})
export class WorkflowModule implements OnModuleInit {
    constructor(
        private readonly moduleRef: ModuleRef,
        private readonly workflowService: WorkflowService,
    ) {}

    async onModuleInit() {
        // Lazy-load SchedulerService to break circular dependency
        try {
            const { SchedulerService } = await import('../scheduler/services/scheduler.service');
            const svc = this.moduleRef.get(SchedulerService, { strict: false });
            this.workflowService.setSchedulerService(svc);
        } catch (_) {
            // SchedulerModule not yet initialised — jobs will be loaded on bootstrap
        }
    }
}
