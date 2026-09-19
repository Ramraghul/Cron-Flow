import { StepType, WorkflowStep } from '@prisma/client';

export interface StepExecutionResult {
    /** Attempts made, including retries. */
    attempts: number;
    /** Human-readable summary stored on the execution step. */
    logs: string;
}

export interface StepExecutor {
    readonly type: StepType;
    execute(step: WorkflowStep): Promise<StepExecutionResult>;
}

/** A step failure. `attempts` is 0 when the step could not start at all (e.g. invalid config). */
export class StepExecutionError extends Error {
    constructor(
        message: string,
        readonly attempts: number,
        options?: { cause?: unknown },
    ) {
        super(message, options);
        this.name = 'StepExecutionError';
    }
}
