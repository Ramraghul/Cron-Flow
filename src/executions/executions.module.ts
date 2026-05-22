import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';
import { WorkflowModule } from '../workflows/workflow.module';
import { ExecutionController } from './controllers/execution.controller';
import { ExecutionQueryController } from './controllers/execution-query.controller';
import { ExecutionService } from './services/execution.service';
import { ExecutionRepository } from './repositories/execution.repository';

@Module({
    imports: [DatabaseModule, QueuesModule, WorkflowModule],
    controllers: [ExecutionController, ExecutionQueryController],
    providers: [ExecutionService, ExecutionRepository],
    exports: [ExecutionService, ExecutionRepository],
})
export class ExecutionsModule {}
