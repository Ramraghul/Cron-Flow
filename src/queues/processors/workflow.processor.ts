import { Worker } from 'bullmq';

import IORedis from 'ioredis';

import { PrismaClient } from '@prisma/client';

import { retryOperation } from '../../common/utils/retry.util';

import { promiseTimeout } from '../../common/utils/promise-timeout.util';

const prisma = new PrismaClient();

const connection = new IORedis(
    process.env.REDIS_URL!,
    {
        maxRetriesPerRequest: null,
    },
);

export const workflowWorker = new Worker(
    'workflow-queue',

    async (job) => {
        console.log(
            `Processing workflow job: ${job.id}`,
        );

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

            const workflow =
                await prisma.workflow.findUnique({
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
                throw new Error(
                    'Workflow not found',
                );
            }

            for (const step of workflow.steps) {
                console.log(
                    `Executing step ${step.stepOrder}`,
                );

                const executionStep =
                    await prisma.executionStep.create({
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
                        const duration =
                            (step.config as any)
                                .duration || 1000;

                        await new Promise((resolve) =>
                            setTimeout(
                                resolve,
                                duration,
                            ),
                        );
                    }

                    if (step.type === 'HTTP') {
                        const config = step.config as any;

                        await retryOperation(
                            async () => {
                                const response =
                                    await promiseTimeout(
                                        fetch(config.url, {
                                            method:
                                                config.method || 'GET',
                                        }),

                                        step.timeout,
                                    );

                                if (!response.ok) {
                                    throw new Error(
                                        `HTTP request failed: ${response.status}`,
                                    );
                                }
                            },

                            step.retryCount,

                            2000,
                        );
                    }

                    await prisma.executionStep.update({
                        where: {
                            id: executionStep.id,
                        },

                        data: {
                            status: 'SUCCESS',

                            logs: `Step ${step.stepOrder} executed successfully`,

                            completedAt:
                                new Date(),

                            attempts: step.retryCount,
                        },
                    });
                } catch (stepError: any) {
                    await prisma.executionStep.update({
                        where: {
                            id: executionStep.id,
                        },

                        data: {
                            status: 'FAILED',

                            logs:
                                stepError.message,

                            completedAt:
                                new Date(),

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

            console.log(
                `Workflow execution completed`,
            );
        } catch (error) {
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
    },

    {
        connection,
    },
);