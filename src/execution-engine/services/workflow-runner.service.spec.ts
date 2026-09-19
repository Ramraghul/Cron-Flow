import { Test } from '@nestjs/testing';
import { ExecutionStatus, StepType, TriggerType, WorkflowStatus, WorkflowStep } from '@prisma/client';
import {
    buildExecutionForRun,
    buildExecutionStep,
    buildWorkflow,
    buildWorkflowStep,
} from '../../../test/utils/factories';
import { createMock } from '../../../test/utils/mocks';
import { ExecutionsRepository } from '../../executions/repositories/executions.repository';
import { DelayStepExecutor } from '../executors/delay-step.executor';
import { HttpStepExecutor } from '../executors/http-step.executor';
import { StepExecutionError, StepExecutionResult } from '../executors/step-executor.interface';
import { INTERRUPTED_EXECUTION_REASON, WorkflowRunnerService } from './workflow-runner.service';

const EXECUTION_ID = 'execution-1';
const WORKFLOW_ID = 'workflow-1';

const httpStep = (stepOrder: number): WorkflowStep => buildWorkflowStep({ id: `step-${stepOrder}`, stepOrder, type: StepType.HTTP });
const delayStep = (stepOrder: number): WorkflowStep =>
    buildWorkflowStep({ id: `step-${stepOrder}`, stepOrder, type: StepType.DELAY, config: { duration: 10 } });

describe('WorkflowRunnerService', () => {
    let runner: WorkflowRunnerService;
    let repository: jest.Mocked<ExecutionsRepository>;
    let httpExecute: jest.Mock<Promise<StepExecutionResult>, [WorkflowStep]>;
    let delayExecute: jest.Mock<Promise<StepExecutionResult>, [WorkflowStep]>;

    beforeEach(async () => {
        repository = createMock<ExecutionsRepository>([
            'findForRun',
            'findWorkflowForRun',
            'createForRun',
            'startExecution',
            'updateStep',
            'skipPendingSteps',
            'complete',
            'failInterrupted',
        ]);
        // One PENDING step record per workflow step, with a predictable id.
        repository.startExecution.mockImplementation(async (executionId, steps) =>
            steps.map((step) => buildExecutionStep({ id: `record-${step.stepOrder}`, executionId, stepOrder: step.stepOrder })),
        );
        httpExecute = jest.fn<Promise<StepExecutionResult>, [WorkflowStep]>();
        delayExecute = jest.fn<Promise<StepExecutionResult>, [WorkflowStep]>();

        const moduleRef = await Test.createTestingModule({
            providers: [
                WorkflowRunnerService,
                { provide: ExecutionsRepository, useValue: repository },
                { provide: HttpStepExecutor, useValue: { type: StepType.HTTP, execute: httpExecute } },
                { provide: DelayStepExecutor, useValue: { type: StepType.DELAY, execute: delayExecute } },
            ],
        }).compile();

        runner = moduleRef.get(WorkflowRunnerService);
    });

    describe('queued executions (manual and webhook)', () => {
        it('runs every step in order, records each result and marks the execution SUCCESS', async () => {
            const steps = [httpStep(1), delayStep(2)];
            repository.findForRun.mockResolvedValue(buildExecutionForRun({}, steps));
            httpExecute.mockResolvedValue({ attempts: 2, logs: 'POST https://example.com/hook → 200 after 2 attempt(s)' });
            delayExecute.mockResolvedValue({ attempts: 1, logs: 'Waited 10ms' });

            const outcome = await runner.run({ executionId: EXECUTION_ID, workflowId: WORKFLOW_ID, triggerType: TriggerType.MANUAL });

            expect(outcome).toEqual({ status: ExecutionStatus.SUCCESS, executionId: EXECUTION_ID });
            expect(repository.startExecution).toHaveBeenCalledWith(EXECUTION_ID, steps);
            expect(httpExecute.mock.invocationCallOrder[0]).toBeLessThan(delayExecute.mock.invocationCallOrder[0]);
            expect(repository.updateStep.mock.calls).toEqual([
                ['record-1', { status: ExecutionStatus.RUNNING, startedAt: expect.any(Date) }],
                [
                    'record-1',
                    {
                        status: ExecutionStatus.SUCCESS,
                        attempts: 2,
                        logs: 'POST https://example.com/hook → 200 after 2 attempt(s)',
                        completedAt: expect.any(Date),
                    },
                ],
                ['record-2', { status: ExecutionStatus.RUNNING, startedAt: expect.any(Date) }],
                ['record-2', { status: ExecutionStatus.SUCCESS, attempts: 1, logs: 'Waited 10ms', completedAt: expect.any(Date) }],
            ]);
            expect(repository.complete).toHaveBeenCalledWith(EXECUTION_ID, ExecutionStatus.SUCCESS);
            expect(repository.skipPendingSteps).not.toHaveBeenCalled();
        });

        it('stops at the first failing step, records why, and skips the remaining steps', async () => {
            repository.findForRun.mockResolvedValue(buildExecutionForRun({}, [delayStep(1), httpStep(2), httpStep(3)]));
            delayExecute.mockResolvedValue({ attempts: 1, logs: 'Waited 10ms' });
            httpExecute.mockRejectedValue(
                new StepExecutionError('POST https://example.com/hook failed after 4 attempt(s): HTTP 503 Service Unavailable', 4),
            );

            const outcome = await runner.run({ executionId: EXECUTION_ID, workflowId: WORKFLOW_ID, triggerType: TriggerType.MANUAL });

            expect(outcome).toEqual({ status: ExecutionStatus.FAILED, executionId: EXECUTION_ID });
            expect(httpExecute).toHaveBeenCalledTimes(1);
            expect(repository.updateStep).toHaveBeenCalledWith('record-2', {
                status: ExecutionStatus.FAILED,
                attempts: 4,
                errorMessage: 'POST https://example.com/hook failed after 4 attempt(s): HTTP 503 Service Unavailable',
                completedAt: expect.any(Date),
            });
            expect(repository.updateStep).not.toHaveBeenCalledWith('record-3', expect.anything());
            expect(repository.skipPendingSteps).toHaveBeenCalledWith(EXECUTION_ID);
            expect(repository.complete).toHaveBeenCalledWith(
                EXECUTION_ID,
                ExecutionStatus.FAILED,
                'Step 2 (HTTP) failed: POST https://example.com/hook failed after 4 attempt(s): HTTP 503 Service Unavailable',
            );
        });

        it('counts an unexpected executor error as a single attempt', async () => {
            repository.findForRun.mockResolvedValue(buildExecutionForRun({}, [httpStep(1)]));
            httpExecute.mockRejectedValue(new Error('unexpected'));

            await runner.run({ executionId: EXECUTION_ID, workflowId: WORKFLOW_ID, triggerType: TriggerType.MANUAL });

            expect(repository.updateStep).toHaveBeenCalledWith('record-1', expect.objectContaining({ attempts: 1, errorMessage: 'unexpected' }));
        });

        it('ignores a job whose execution was deleted with its workflow', async () => {
            repository.findForRun.mockResolvedValue(null);

            const outcome = await runner.run({ executionId: EXECUTION_ID, workflowId: WORKFLOW_ID, triggerType: TriggerType.WEBHOOK });

            expect(outcome).toMatchObject({ status: 'IGNORED', executionId: EXECUTION_ID });
            expect(repository.startExecution).not.toHaveBeenCalled();
        });

        it('ignores an execution that has already finished', async () => {
            repository.findForRun.mockResolvedValue(buildExecutionForRun({ status: ExecutionStatus.SUCCESS }));

            const outcome = await runner.run({ executionId: EXECUTION_ID, workflowId: WORKFLOW_ID, triggerType: TriggerType.MANUAL });

            expect(outcome).toMatchObject({ status: 'IGNORED', reason: 'execution has already finished (SUCCESS)' });
            expect(httpExecute).not.toHaveBeenCalled();
        });

        it('fails an interrupted execution instead of re-running its steps', async () => {
            repository.findForRun.mockResolvedValue(buildExecutionForRun({ status: ExecutionStatus.RUNNING }));
            repository.failInterrupted.mockResolvedValue();

            const outcome = await runner.run({ executionId: EXECUTION_ID, workflowId: WORKFLOW_ID, triggerType: TriggerType.MANUAL });

            expect(outcome.status).toBe('IGNORED');
            expect(repository.failInterrupted).toHaveBeenCalledWith(EXECUTION_ID, INTERRUPTED_EXECUTION_REASON);
            expect(httpExecute).not.toHaveBeenCalled();
        });

        it('lets infrastructure errors propagate to the queue', async () => {
            repository.findForRun.mockResolvedValue(buildExecutionForRun());
            repository.startExecution.mockRejectedValue(new Error('database unreachable'));

            await expect(
                runner.run({ executionId: EXECUTION_ID, workflowId: WORKFLOW_ID, triggerType: TriggerType.MANUAL }),
            ).rejects.toThrow('database unreachable');
        });
    });

    describe('scheduled (cron) jobs', () => {
        it('creates a CRON execution for an active workflow and runs it', async () => {
            repository.findWorkflowForRun.mockResolvedValue(buildWorkflow({ steps: [delayStep(1)] }));
            repository.createForRun.mockResolvedValue(
                buildExecutionForRun({ triggerType: TriggerType.CRON }, [delayStep(1)]),
            );
            delayExecute.mockResolvedValue({ attempts: 1, logs: 'Waited 10ms' });

            const outcome = await runner.run({ workflowId: WORKFLOW_ID, triggerType: TriggerType.CRON });

            expect(repository.createForRun).toHaveBeenCalledWith(WORKFLOW_ID, TriggerType.CRON);
            expect(outcome).toEqual({ status: ExecutionStatus.SUCCESS, executionId: EXECUTION_ID });
        });

        it.each([
            ['paused', buildWorkflow({ status: WorkflowStatus.PAUSED }), 'workflow is paused'],
            ['deleted', null, 'workflow no longer exists'],
        ])('ignores a job for a %s workflow without recording an execution', async (_label, workflow, reason) => {
            repository.findWorkflowForRun.mockResolvedValue(workflow);

            const outcome = await runner.run({ workflowId: WORKFLOW_ID, triggerType: TriggerType.CRON });

            expect(outcome).toEqual({ status: 'IGNORED', executionId: null, reason });
            expect(repository.createForRun).not.toHaveBeenCalled();
        });
    });
});
