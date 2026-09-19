import { Injectable, Logger } from '@nestjs/common';
import { ExecutionStatus, StepType, TriggerType, WorkflowStatus } from '@prisma/client';
import { errorMessage } from '../../common/utils/error.util';
import {
    ExecutionForRun,
    ExecutionsRepository,
    FinalExecutionStatus,
} from '../../executions/repositories/executions.repository';
import { WorkflowJobData } from '../../queues/interfaces/workflow-job.interface';
import { DelayStepExecutor } from '../executors/delay-step.executor';
import { HttpStepExecutor } from '../executors/http-step.executor';
import { StepExecutionError, StepExecutionResult, StepExecutor } from '../executors/step-executor.interface';

export const INTERRUPTED_EXECUTION_REASON =
    'Execution was interrupted (the worker stopped mid-run) and was not retried, to avoid repeating side effects';

export type RunOutcome =
    | { status: FinalExecutionStatus; executionId: string }
    | { status: 'IGNORED'; executionId: string | null; reason: string };

type Resolution =
    | { kind: 'ready'; execution: ExecutionForRun }
    | { kind: 'ignored'; executionId: string | null; reason: string };

/**
 * Runs one queued job: resolves (or, for cron jobs, creates) the execution, runs its steps in
 * order and records every outcome. A failing step stops the run and marks the remaining steps
 * SKIPPED. Step failures are recorded, not thrown — only infrastructure errors propagate.
 */
@Injectable()
export class WorkflowRunnerService {
    private readonly logger = new Logger(WorkflowRunnerService.name);
    private readonly executors: ReadonlyMap<StepType, StepExecutor>;

    constructor(
        private readonly repository: ExecutionsRepository,
        httpStepExecutor: HttpStepExecutor,
        delayStepExecutor: DelayStepExecutor,
    ) {
        this.executors = new Map<StepType, StepExecutor>(
            [httpStepExecutor, delayStepExecutor].map((executor) => [executor.type, executor]),
        );
    }

    async run(job: WorkflowJobData): Promise<RunOutcome> {
        const resolution = job.executionId
            ? await this.resolveQueuedExecution(job.executionId)
            : await this.createScheduledExecution(job.workflowId);

        if (resolution.kind === 'ignored') {
            this.logger.warn(`Job for workflow ${job.workflowId} ignored: ${resolution.reason}`);
            return { status: 'IGNORED', executionId: resolution.executionId, reason: resolution.reason };
        }

        return this.runSteps(resolution.execution);
    }

    private async resolveQueuedExecution(executionId: string): Promise<Resolution> {
        const execution = await this.repository.findForRun(executionId);
        if (!execution) {
            return { kind: 'ignored', executionId, reason: 'execution no longer exists (its workflow was deleted)' };
        }

        switch (execution.status) {
            case ExecutionStatus.PENDING:
                return { kind: 'ready', execution };
            case ExecutionStatus.RUNNING:
                // BullMQ re-delivers jobs whose worker died mid-run. Earlier steps may already have had
                // side effects (e.g. a POST), so the execution is failed instead of silently re-run.
                await this.repository.failInterrupted(execution.id, INTERRUPTED_EXECUTION_REASON);
                return { kind: 'ignored', executionId, reason: 'execution was interrupted and has been marked FAILED' };
            default:
                return { kind: 'ignored', executionId, reason: `execution has already finished (${execution.status})` };
        }
    }

    private async createScheduledExecution(workflowId: string): Promise<Resolution> {
        const workflow = await this.repository.findWorkflowForRun(workflowId);
        if (!workflow) {
            return { kind: 'ignored', executionId: null, reason: 'workflow no longer exists' };
        }
        if (workflow.status !== WorkflowStatus.ACTIVE) {
            return { kind: 'ignored', executionId: null, reason: 'workflow is paused' };
        }

        const execution = await this.repository.createForRun(workflow.id, TriggerType.CRON);
        return { kind: 'ready', execution };
    }

    private async runSteps(execution: ExecutionForRun): Promise<RunOutcome> {
        const { steps } = execution.workflow;
        const stepRecords = await this.repository.startExecution(execution.id, steps);
        const recordIdByOrder = new Map(stepRecords.map((record) => [record.stepOrder, record.id]));

        this.logger.log(`Execution ${execution.id} started (${execution.triggerType}, ${steps.length} step(s))`);

        for (const step of steps) {
            const recordId = recordIdByOrder.get(step.stepOrder);
            if (!recordId) {
                throw new Error(`Execution ${execution.id} has no record for step ${step.stepOrder}`);
            }

            await this.repository.updateStep(recordId, { status: ExecutionStatus.RUNNING, startedAt: new Date() });

            let result: StepExecutionResult;
            try {
                result = await this.executorFor(step.type).execute(step);
            } catch (error) {
                const reason = errorMessage(error);
                await this.repository.updateStep(recordId, {
                    status: ExecutionStatus.FAILED,
                    attempts: error instanceof StepExecutionError ? error.attempts : 1,
                    errorMessage: reason,
                    completedAt: new Date(),
                });
                await this.repository.skipPendingSteps(execution.id);

                const summary = `Step ${step.stepOrder} (${step.type}) failed: ${reason}`;
                await this.repository.complete(execution.id, ExecutionStatus.FAILED, summary);
                this.logger.warn(`Execution ${execution.id} failed — ${summary}`);
                return { status: ExecutionStatus.FAILED, executionId: execution.id };
            }

            await this.repository.updateStep(recordId, {
                status: ExecutionStatus.SUCCESS,
                attempts: result.attempts,
                logs: result.logs,
                completedAt: new Date(),
            });
        }

        await this.repository.complete(execution.id, ExecutionStatus.SUCCESS);
        this.logger.log(`Execution ${execution.id} succeeded`);
        return { status: ExecutionStatus.SUCCESS, executionId: execution.id };
    }

    private executorFor(type: StepType): StepExecutor {
        const executor = this.executors.get(type);
        if (!executor) {
            throw new StepExecutionError(`No executor is registered for step type ${type}`, 0);
        }
        return executor;
    }
}
