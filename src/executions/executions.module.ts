import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueuesModule } from '../queues/queues.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ExecutionsController } from './controllers/executions.controller';
import { WorkflowExecutionsController } from './controllers/workflow-executions.controller';
import { ExecutionsRepository } from './repositories/executions.repository';
import { ExecutionsService } from './services/executions.service';

@Module({
    imports: [AuthModule, QueuesModule, WorkflowsModule],
    controllers: [WorkflowExecutionsController, ExecutionsController],
    providers: [ExecutionsService, ExecutionsRepository],
    exports: [ExecutionsService],
})
export class ExecutionsModule {}
