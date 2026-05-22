-- V2 Migration: API Keys, Webhook Tokens, Trigger Types, Performance Indexes

-- Add webhookToken to Workflow
ALTER TABLE "Workflow" ADD COLUMN "webhookToken" TEXT;
UPDATE "Workflow" SET "webhookToken" = gen_random_uuid()::text WHERE "webhookToken" IS NULL;
ALTER TABLE "Workflow" ALTER COLUMN "webhookToken" SET NOT NULL;
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_webhookToken_key" UNIQUE ("webhookToken");

-- Add triggerType enum and column to Execution
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'CRON', 'WEBHOOK');
ALTER TABLE "Execution" ADD COLUMN "triggerType" "TriggerType" NOT NULL DEFAULT 'MANUAL';

-- Create ApiKey table
CREATE TABLE "ApiKey" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "keyHash"    TEXT NOT NULL,
    "keyPrefix"  TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_keyHash_key" UNIQUE ("keyHash");
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Performance indexes
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX "Workflow_userId_status_idx" ON "Workflow"("userId", "status");
CREATE INDEX "Execution_workflowId_status_idx" ON "Execution"("workflowId", "status");
CREATE INDEX "Execution_createdAt_idx" ON "Execution"("createdAt");
