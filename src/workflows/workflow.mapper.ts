import { Prisma, StepType, Workflow, WorkflowStatus, WorkflowStep } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { getNextRunDate } from '../common/utils/cron.util';
import { WorkflowResponseDto, WorkflowStepResponseDto, WorkflowSummaryDto } from './dto/workflow-response.dto';
import { DelayStepConfigDto, HttpStepConfigDto, WorkflowStepDto } from './dto/workflow-step.dto';
import { NewWorkflowStep, WorkflowWithCounts, WorkflowWithSteps } from './repositories/workflows.repository';
import { HttpMethod } from './step-config';

/**
 * 192 bits from a CSPRNG, URL-safe. The schema's cuid() default is unique but not designed
 * to be unguessable, and this token is the only credential a webhook caller presents.
 */
export function generateWebhookToken(): string {
    return randomBytes(24).toString('base64url');
}

/** Converts a validated step DTO into the JSON persisted in `WorkflowStep.config`. */
export function toStepInput(step: WorkflowStepDto): NewWorkflowStep {
    return {
        stepOrder: step.stepOrder,
        type: step.type,
        config: toStepConfigJson(step),
        retryCount: step.retryCount,
        timeout: step.timeout,
    };
}

function toStepConfigJson(step: WorkflowStepDto): Prisma.InputJsonObject {
    if (step.type === StepType.DELAY) {
        const { duration } = step.config as DelayStepConfigDto;
        return { duration };
    }

    const { url, method = HttpMethod.GET, headers, body } = step.config as HttpStepConfigDto;
    return {
        url,
        method,
        ...(headers && { headers }),
        ...(body !== undefined && { body: body as Prisma.InputJsonValue }),
    };
}

export function toWorkflowStepResponse(step: WorkflowStep): WorkflowStepResponseDto {
    return {
        id: step.id,
        stepOrder: step.stepOrder,
        type: step.type,
        config: step.config as Record<string, unknown>,
        retryCount: step.retryCount,
        timeout: step.timeout,
    };
}

function toWorkflowBase(workflow: Workflow) {
    return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        cronExpression: workflow.cronExpression,
        timezone: workflow.timezone,
        status: workflow.status,
        nextRunAt:
            workflow.status === WorkflowStatus.ACTIVE
                ? getNextRunDate(workflow.cronExpression, workflow.timezone)
                : null,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
    };
}

export function toWorkflowResponse(workflow: WorkflowWithSteps): WorkflowResponseDto {
    return {
        ...toWorkflowBase(workflow),
        webhookToken: workflow.webhookToken,
        steps: workflow.steps.map(toWorkflowStepResponse),
    };
}

export function toWorkflowSummary(workflow: WorkflowWithCounts): WorkflowSummaryDto {
    return {
        ...toWorkflowBase(workflow),
        stepCount: workflow._count.steps,
        executionCount: workflow._count.executions,
    };
}
