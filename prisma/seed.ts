import { PrismaClient, StepType, WorkflowStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

/**
 * Local-development seed: a demo account with one sample workflow.
 * Idempotent — safe to run repeatedly. Never run against production.
 */

const DEMO_EMAIL = 'demo@cronflow.dev';
const DEMO_PASSWORD = 'demo-password-123';
const SAMPLE_WORKFLOW_NAME = 'Sample: httpbin round trip';
const BCRYPT_SALT_ROUNDS = 12;

const prisma = new PrismaClient();

async function seed(): Promise<void> {
    const user = await prisma.user.upsert({
        where: { email: DEMO_EMAIL },
        update: {},
        create: { email: DEMO_EMAIL, password: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS) },
    });

    const existing = await prisma.workflow.findFirst({ where: { userId: user.id, name: SAMPLE_WORKFLOW_NAME } });
    if (!existing) {
        await prisma.workflow.create({
            data: {
                userId: user.id,
                name: SAMPLE_WORKFLOW_NAME,
                description: 'GET, wait one second, then POST. Paused so it only runs when you trigger or resume it.',
                cronExpression: '*/15 * * * *',
                timezone: 'UTC',
                // Seeded workflows bypass the API, so they start PAUSED: resuming through the API registers the schedule.
                status: WorkflowStatus.PAUSED,
                webhookToken: randomBytes(24).toString('base64url'),
                steps: {
                    create: [
                        { stepOrder: 1, type: StepType.HTTP, config: { url: 'https://httpbin.org/get', method: 'GET' } },
                        { stepOrder: 2, type: StepType.DELAY, config: { duration: 1000 } },
                        {
                            stepOrder: 3,
                            type: StepType.HTTP,
                            config: { url: 'https://httpbin.org/post', method: 'POST', body: { source: 'cronflow-seed' } },
                        },
                    ],
                },
            },
        });
    }

    console.log(`Seed complete. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

seed()
    .catch((error: unknown) => {
        console.error('Seeding failed:', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
