-- CronFlow v3
--   * Execution steps snapshot stepOrder/type so history survives workflow edits
--   * Cascading deletes down the ownership tree (User → Workflow → Execution → ExecutionStep)
--   * Workflow timezone, execution error message + webhook payload, SKIPPED step status
--   * Index clean-up (drop redundant ApiKey.keyHash index, add query-path indexes)
-- Written by hand (rather than generated) so existing rows are back-filled safely.

-- 1. Steps that never ran because an earlier step failed
ALTER TYPE "ExecutionStatus" ADD VALUE 'SKIPPED';

-- 2. Workflow timezone
ALTER TABLE "Workflow" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- 3. Execution failure reason and webhook payload
ALTER TABLE "Execution"
    ADD COLUMN "errorMessage" TEXT,
    ADD COLUMN "triggerPayload" JSONB;

-- 4. Normalise step ordering to 1..n per workflow so the unique constraint below
--    cannot fail on pre-existing duplicate stepOrder values.
WITH ordered AS (
    SELECT "id",
           ROW_NUMBER() OVER (PARTITION BY "workflowId" ORDER BY "stepOrder", "createdAt", "id") AS position
    FROM "WorkflowStep"
)
UPDATE "WorkflowStep" AS ws
SET "stepOrder" = ordered.position
FROM ordered
WHERE ws."id" = ordered."id" AND ws."stepOrder" <> ordered.position;

-- 5. ExecutionStep snapshots (back-filled from the referenced workflow step)
ALTER TABLE "ExecutionStep"
    ADD COLUMN "stepOrder" INTEGER,
    ADD COLUMN "type" "StepType";

UPDATE "ExecutionStep" AS es
SET "stepOrder" = ws."stepOrder",
    "type" = ws."type"
FROM "WorkflowStep" AS ws
WHERE es."workflowStepId" = ws."id";

ALTER TABLE "ExecutionStep"
    ALTER COLUMN "stepOrder" SET NOT NULL,
    ALTER COLUMN "type" SET NOT NULL,
    ALTER COLUMN "workflowStepId" DROP NOT NULL;

-- 6. Foreign keys
ALTER TABLE "Workflow" DROP CONSTRAINT "Workflow_userId_fkey";
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowStep" DROP CONSTRAINT "WorkflowStep_workflowId_fkey";
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Execution" DROP CONSTRAINT "Execution_workflowId_fkey";
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutionStep" DROP CONSTRAINT "ExecutionStep_executionId_fkey";
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutionStep" DROP CONSTRAINT "ExecutionStep_workflowStepId_fkey";
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_workflowStepId_fkey"
    FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Indexes
DROP INDEX IF EXISTS "ApiKey_keyHash_idx";
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE UNIQUE INDEX "WorkflowStep_workflowId_stepOrder_key" ON "WorkflowStep"("workflowId", "stepOrder");
CREATE INDEX "Workflow_userId_createdAt_idx" ON "Workflow"("userId", "createdAt");
CREATE INDEX "Execution_workflowId_createdAt_idx" ON "Execution"("workflowId", "createdAt");
CREATE INDEX "ExecutionStep_executionId_stepOrder_idx" ON "ExecutionStep"("executionId", "stepOrder");
