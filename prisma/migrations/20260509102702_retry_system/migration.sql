-- AlterTable
ALTER TABLE "ExecutionStep" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorMessage" TEXT;
