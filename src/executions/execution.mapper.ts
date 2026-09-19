import { Execution, ExecutionStep } from '@prisma/client';
import { API_PREFIX } from '../app.constants';
import {
    ExecutionAcceptedDto,
    ExecutionDetailsDto,
    ExecutionStepResponseDto,
    ExecutionSummaryDto,
} from './dto/execution-response.dto';
import { ExecutionWithDetails } from './repositories/executions.repository';

export function durationMs(startedAt: Date | null, completedAt: Date | null): number | null {
    return startedAt && completedAt ? completedAt.getTime() - startedAt.getTime() : null;
}

export function toExecutionSummary(execution: Execution): ExecutionSummaryDto {
    return {
        id: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        triggerType: execution.triggerType,
        errorMessage: execution.errorMessage,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        durationMs: durationMs(execution.startedAt, execution.completedAt),
        createdAt: execution.createdAt,
    };
}

export function toExecutionStepResponse(step: ExecutionStep): ExecutionStepResponseDto {
    return {
        id: step.id,
        stepOrder: step.stepOrder,
        type: step.type,
        status: step.status,
        attempts: step.attempts,
        logs: step.logs,
        errorMessage: step.errorMessage,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        durationMs: durationMs(step.startedAt, step.completedAt),
    };
}

export function toExecutionDetails(execution: ExecutionWithDetails): ExecutionDetailsDto {
    return {
        ...toExecutionSummary(execution),
        workflowName: execution.workflow.name,
        triggerPayload: (execution.triggerPayload as Record<string, unknown> | null) ?? null,
        steps: execution.steps.map(toExecutionStepResponse),
    };
}

export function toExecutionAccepted(execution: Execution): ExecutionAcceptedDto {
    return {
        executionId: execution.id,
        workflowId: execution.workflowId,
        status: execution.status,
        triggerType: execution.triggerType,
        statusUrl: `/${API_PREFIX}/executions/${execution.id}`,
        createdAt: execution.createdAt,
    };
}
