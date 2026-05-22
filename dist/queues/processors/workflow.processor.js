"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowWorker = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const client_1 = require("@prisma/client");
const retry_util_1 = require("../../common/utils/retry.util");
const promise_timeout_util_1 = require("../../common/utils/promise-timeout.util");
const prisma = new client_1.PrismaClient();
const connection = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
exports.workflowWorker = new bullmq_1.Worker('workflow-queue', async (job) => {
    console.log(`Processing workflow job: ${job.id}`);
    const { executionId, workflowId } = job.data;
    try {
        await prisma.execution.update({
            where: {
                id: executionId,
            },
            data: {
                status: 'RUNNING',
                startedAt: new Date(),
            },
        });
        const workflow = await prisma.workflow.findUnique({
            where: {
                id: workflowId,
            },
            include: {
                steps: {
                    orderBy: {
                        stepOrder: 'asc',
                    },
                },
            },
        });
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        for (const step of workflow.steps) {
            console.log(`Executing step ${step.stepOrder}`);
            const executionStep = await prisma.executionStep.create({
                data: {
                    executionId,
                    workflowStepId: step.id,
                    status: 'RUNNING',
                    startedAt: new Date(),
                    attempts: 0,
                },
            });
            try {
                if (step.type === 'DELAY') {
                    const duration = step.config
                        .duration || 1000;
                    await new Promise((resolve) => setTimeout(resolve, duration));
                }
                if (step.type === 'HTTP') {
                    const config = step.config;
                    await (0, retry_util_1.retryOperation)(async () => {
                        const response = await (0, promise_timeout_util_1.promiseTimeout)(fetch(config.url, {
                            method: config.method || 'GET',
                        }), step.timeout);
                        if (!response.ok) {
                            throw new Error(`HTTP request failed: ${response.status}`);
                        }
                    }, step.retryCount, 2000);
                }
                await prisma.executionStep.update({
                    where: {
                        id: executionStep.id,
                    },
                    data: {
                        status: 'SUCCESS',
                        logs: `Step ${step.stepOrder} executed successfully`,
                        completedAt: new Date(),
                        attempts: step.retryCount,
                    },
                });
            }
            catch (stepError) {
                await prisma.executionStep.update({
                    where: {
                        id: executionStep.id,
                    },
                    data: {
                        status: 'FAILED',
                        logs: stepError.message,
                        completedAt: new Date(),
                        errorMessage: stepError.message,
                    },
                });
                throw stepError;
            }
        }
        await prisma.execution.update({
            where: {
                id: executionId,
            },
            data: {
                status: 'SUCCESS',
                completedAt: new Date(),
            },
        });
        console.log(`Workflow execution completed`);
    }
    catch (error) {
        console.error(error);
        await prisma.execution.update({
            where: {
                id: executionId,
            },
            data: {
                status: 'FAILED',
                completedAt: new Date(),
            },
        });
        throw error;
    }
}, {
    connection,
});
//# sourceMappingURL=workflow.processor.js.map