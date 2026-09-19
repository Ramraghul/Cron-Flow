import { Injectable } from '@nestjs/common';
import { StepType, WorkflowStep } from '@prisma/client';
import { sleep } from '../../common/utils/async.util';
import { parseDelayStepConfig } from './step-config.parser';
import { StepExecutionResult, StepExecutor } from './step-executor.interface';

@Injectable()
export class DelayStepExecutor implements StepExecutor {
    readonly type = StepType.DELAY;

    async execute(step: WorkflowStep): Promise<StepExecutionResult> {
        const { duration } = parseDelayStepConfig(step.config);
        await sleep(duration);
        return { attempts: 1, logs: `Waited ${duration}ms` };
    }
}
