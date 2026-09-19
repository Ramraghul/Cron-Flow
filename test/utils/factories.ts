import {
    Execution,
    ExecutionStatus,
    ExecutionStep,
    StepType,
    TriggerType,
    User,
    WorkflowStatus,
    WorkflowStep,
} from '@prisma/client';
import { AuthenticatedUser } from '../../src/common/interfaces/authenticated-user.interface';
import { ExecutionForRun, ExecutionWithDetails } from '../../src/executions/repositories/executions.repository';
import { WorkflowWithCounts, WorkflowWithSteps } from '../../src/workflows/repositories/workflows.repository';

/** Test data builders with sensible defaults. Override only what a test cares about. */

export const FIXED_DATE = new Date('2026-09-14T10:00:00.000Z');

export const authenticatedUser: AuthenticatedUser = { id: 'user-1', email: 'ada@example.com', authMethod: 'jwt' };

export function buildUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        email: 'ada@example.com',
        password: '$2b$04$notARealHashButShapedLikeOne',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        ...overrides,
    };
}

export function buildWorkflowStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
    return {
        id: 'step-1',
        workflowId: 'workflow-1',
        stepOrder: 1,
        type: StepType.HTTP,
        config: { url: 'https://example.com/hook', method: 'POST' },
        retryCount: 3,
        timeout: 30_000,
        createdAt: FIXED_DATE,
        ...overrides,
    };
}

export function buildWorkflow(overrides: Partial<WorkflowWithSteps> = {}): WorkflowWithSteps {
    return {
        id: 'workflow-1',
        name: 'Nightly sync',
        description: null,
        cronExpression: '0 2 * * *',
        timezone: 'UTC',
        status: WorkflowStatus.ACTIVE,
        webhookToken: 'webhook-token',
        userId: 'user-1',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        steps: [buildWorkflowStep()],
        ...overrides,
    };
}

export function buildWorkflowWithCounts(overrides: Partial<WorkflowWithCounts> = {}): WorkflowWithCounts {
    const { steps: _steps, ...workflow } = buildWorkflow();
    return { ...workflow, _count: { steps: 1, executions: 0 }, ...overrides };
}

export function buildExecution(overrides: Partial<Execution> = {}): Execution {
    return {
        id: 'execution-1',
        workflowId: 'workflow-1',
        status: ExecutionStatus.PENDING,
        triggerType: TriggerType.MANUAL,
        triggerPayload: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: FIXED_DATE,
        ...overrides,
    };
}

export function buildExecutionStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
    return {
        id: 'execution-step-1',
        executionId: 'execution-1',
        workflowStepId: 'step-1',
        stepOrder: 1,
        type: StepType.HTTP,
        status: ExecutionStatus.PENDING,
        attempts: 0,
        logs: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: FIXED_DATE,
        ...overrides,
    };
}

export function buildExecutionForRun(
    overrides: Partial<Execution> = {},
    steps: WorkflowStep[] = [buildWorkflowStep()],
): ExecutionForRun {
    return { ...buildExecution(overrides), workflow: buildWorkflow({ steps }) };
}

export function buildExecutionWithDetails(
    overrides: Partial<Execution> = {},
    steps: ExecutionStep[] = [buildExecutionStep()],
): ExecutionWithDetails {
    return { ...buildExecution(overrides), workflow: { name: 'Nightly sync' }, steps };
}
