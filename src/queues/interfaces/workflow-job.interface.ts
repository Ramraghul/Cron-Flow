import { TriggerType } from '@prisma/client';

/** Payload of a job on the workflow queue. */
export interface WorkflowJobData {
    workflowId: string;
    triggerType: TriggerType;
    /**
     * Set for MANUAL and WEBHOOK triggers, whose execution row is created by the API so the
     * caller gets an id immediately. Absent for CRON jobs — the worker creates that row.
     */
    executionId?: string;
}

export type QueuedExecutionJob = WorkflowJobData & { executionId: string };
