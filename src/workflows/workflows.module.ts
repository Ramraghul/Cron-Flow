import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { WorkflowsController } from './controllers/workflows.controller';
import { WorkflowsRepository } from './repositories/workflows.repository';
import { WorkflowsService } from './services/workflows.service';

@Module({
    imports: [AuthModule, SchedulerModule],
    controllers: [WorkflowsController],
    providers: [WorkflowsService, WorkflowsRepository],
    exports: [WorkflowsRepository],
})
export class WorkflowsModule {}
