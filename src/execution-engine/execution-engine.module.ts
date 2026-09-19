import { Module } from '@nestjs/common';
import { ExecutionsRepository } from '../executions/repositories/executions.repository';
import { DelayStepExecutor } from './executors/delay-step.executor';
import { HttpStepExecutor } from './executors/http-step.executor';
import { WorkflowRunnerService } from './services/workflow-runner.service';
import { WorkflowProcessor } from './workflow.processor';

/**
 * Background execution of queued workflow jobs. Deliberately independent of the HTTP modules,
 * so the standalone worker process loads only what it needs.
 */
@Module({
    providers: [WorkflowProcessor, WorkflowRunnerService, HttpStepExecutor, DelayStepExecutor, ExecutionsRepository],
})
export class ExecutionEngineModule {}
