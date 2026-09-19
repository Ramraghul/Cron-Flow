import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { QueueService } from '../src/queues/services/queue.service';
import { schedulerIdFor } from '../src/scheduler/services/scheduler.service';
import { createE2eApp, E2eContext, resetState } from './e2e/app';
import { HttpTarget, startHttpTarget, waitFor } from './e2e/helpers';

/**
 * Full-stack tests: real HTTP → validation → services → PostgreSQL → BullMQ/Redis → worker → HTTP step.
 * Tests within a describe block build on each other and run in order.
 */

const API = '/api/v1';
const PASSWORD = 'correct-horse-battery-staple';
const DELAY_STEP = { stepOrder: 1, type: 'DELAY', config: { duration: 10 } };

interface ExecutionBody {
    status: string;
    triggerType: string;
    errorMessage: string | null;
    triggerPayload: Record<string, unknown> | null;
    steps: Array<{ stepOrder: number; type: string; status: string; attempts: number }>;
}

describe('CronFlow API (e2e)', () => {
    let context: E2eContext;
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let queueService: QueueService;
    let target: HttpTarget;
    let token: string;

    const api = () => request(app.getHttpServer());
    const auth = (accessToken = token) => ({ Authorization: `Bearer ${accessToken}` });

    async function register(email: string): Promise<string> {
        const response = await api().post(`${API}/auth/register`).send({ email, password: PASSWORD }).expect(201);
        return response.body.accessToken;
    }

    function createWorkflow(body: object) {
        return api().post(`${API}/workflows`).set(auth()).send(body);
    }

    async function runNow(workflowId: string): Promise<ExecutionBody> {
        const accepted = await api().post(`${API}/workflows/${workflowId}/executions`).set(auth()).expect(202);
        return waitForExecution(accepted.body.executionId);
    }

    function waitForExecution(executionId: string): Promise<ExecutionBody> {
        return waitFor(
            async () => (await api().get(`${API}/executions/${executionId}`).set(auth())).body as ExecutionBody,
            (execution) => execution.status === 'SUCCESS' || execution.status === 'FAILED',
        );
    }

    function schedulerFor(workflowId: string) {
        return queueService.queue.getJobScheduler(schedulerIdFor(workflowId));
    }

    beforeAll(async () => {
        target = await startHttpTarget();
        context = await createE2eApp();
        ({ app, prisma, queueService } = context);
        await resetState(context);
    });

    afterAll(async () => {
        await app?.close();
        await target?.close();
    });

    it('is ready when PostgreSQL and Redis are reachable', async () => {
        const response = await api().get('/health/ready').expect(200);

        expect(response.body.checks).toEqual({
            database: { status: 'up', latencyMs: expect.any(Number) },
            redis: { status: 'up', latencyMs: expect.any(Number) },
        });
    });

    describe('authentication', () => {
        it('registers, rejects a duplicate email in any case, and logs in', async () => {
            token = await register('ada@example.com');

            await api().post(`${API}/auth/register`).send({ email: 'ADA@example.com', password: PASSWORD }).expect(409);
            const login = await api().post(`${API}/auth/login`).send({ email: 'ada@example.com', password: PASSWORD }).expect(200);

            expect(login.body).toMatchObject({ tokenType: 'Bearer', user: { email: 'ada@example.com' } });
        });

        it('rejects requests without valid credentials', async () => {
            await api().get(`${API}/workflows`).expect(401);
            await api().get(`${API}/workflows`).set(auth('not-a-jwt')).expect(401);
        });
    });

    describe('workflow lifecycle', () => {
        let workflowId: string;
        let webhookToken: string;

        it('reports every validation problem at once and saves nothing', async () => {
            const response = await createWorkflow({
                name: 'Broken',
                cronExpression: '0 2 * * *',
                steps: [
                    { stepOrder: 1, type: 'HTTP', config: { url: 'ftp://example.com' } },
                    { stepOrder: 1, type: 'DELAY', config: { duration: 100 } },
                ],
            }).expect(400);

            expect(response.body.message).toEqual(
                expect.arrayContaining([
                    'steps must not contain duplicate stepOrder values',
                    'steps.0.config.url must be an absolute http(s) URL',
                ]),
            );
            await expect(prisma.workflow.count()).resolves.toBe(0);
        });

        it('creates a workflow, persists its steps and registers its schedule in Redis', async () => {
            const response = await createWorkflow({
                name: 'Nightly sync',
                cronExpression: '0 2 * * *',
                timezone: 'Europe/London',
                steps: [
                    {
                        stepOrder: 1,
                        type: 'HTTP',
                        config: { url: target.url('/ok'), method: 'POST', headers: { 'x-source': 'e2e' }, body: { report: 'daily' } },
                    },
                    { stepOrder: 2, type: 'DELAY', config: { duration: 50 } },
                ],
            }).expect(201);

            workflowId = response.body.id;
            webhookToken = response.body.webhookToken;

            expect(response.body).toMatchObject({ status: 'ACTIVE', timezone: 'Europe/London', nextRunAt: expect.any(String) });
            await expect(prisma.workflowStep.count({ where: { workflowId } })).resolves.toBe(2);
            await expect(schedulerFor(workflowId)).resolves.toMatchObject({ pattern: '0 2 * * *', tz: 'Europe/London' });
        });

        it('lists workflows with sorting, pagination and search', async () => {
            await createWorkflow({ name: 'Hourly ping', cronExpression: '0 * * * *', steps: [DELAY_STEP] }).expect(201);
            await createWorkflow({
                name: 'Weekly report',
                description: 'Sync summary for the team',
                cronExpression: '0 9 * * MON',
                steps: [DELAY_STEP],
            }).expect(201);

            const firstPage = await api().get(`${API}/workflows?limit=2&sortBy=name&sortOrder=asc`).set(auth()).expect(200);
            expect((firstPage.body.data as Array<{ name: string }>).map((workflow) => workflow.name)).toEqual([
                'Hourly ping',
                'Nightly sync',
            ]);
            expect(firstPage.body.meta).toEqual({
                page: 1,
                limit: 2,
                totalItems: 3,
                totalPages: 2,
                hasNextPage: true,
                hasPreviousPage: false,
            });

            const search = await api().get(`${API}/workflows?search=SYNC`).set(auth()).expect(200);
            expect((search.body.data as Array<{ name: string }>).map((workflow) => workflow.name).sort()).toEqual([
                'Nightly sync',
                'Weekly report',
            ]);
        });

        it('hides workflows from other users', async () => {
            const otherUserToken = await register('grace@example.com');

            await api().get(`${API}/workflows/${workflowId}`).set(auth(otherUserToken)).expect(404);
            const list = await api().get(`${API}/workflows`).set(auth(otherUserToken)).expect(200);
            expect(list.body.meta.totalItems).toBe(0);
        });

        it('runs on demand through the queue and worker, calling the HTTP target', async () => {
            const execution = await runNow(workflowId);

            expect(execution).toMatchObject({
                status: 'SUCCESS',
                triggerType: 'MANUAL',
                steps: [
                    { stepOrder: 1, type: 'HTTP', status: 'SUCCESS', attempts: 1 },
                    { stepOrder: 2, type: 'DELAY', status: 'SUCCESS' },
                ],
            });
            expect(target.requests.find((recorded) => recorded.path === '/ok')).toMatchObject({
                method: 'POST',
                body: JSON.stringify({ report: 'daily' }),
                headers: expect.objectContaining({ 'x-source': 'e2e', 'content-type': 'application/json' }),
            });
        });

        it('runs from a webhook and stores the payload', async () => {
            const accepted = await api().post(`${API}/webhooks/${webhookToken}/trigger`).send({ ref: 'main' }).expect(202);

            const execution = await waitForExecution(accepted.body.executionId);

            expect(execution).toMatchObject({ status: 'SUCCESS', triggerType: 'WEBHOOK', triggerPayload: { ref: 'main' } });
        });

        it('keeps execution history when steps are replaced, and reschedules on a cron change', async () => {
            const updated = await api()
                .patch(`${API}/workflows/${workflowId}`)
                .set(auth())
                .send({ cronExpression: '*/30 * * * *', steps: [DELAY_STEP] })
                .expect(200);
            expect(updated.body.steps).toHaveLength(1);

            const history = await api().get(`${API}/workflows/${workflowId}/executions`).set(auth()).expect(200);
            expect(history.body.meta.totalItems).toBe(2);
            const oldest = await api().get(`${API}/executions/${history.body.data[1].id}`).set(auth()).expect(200);
            expect(oldest.body.steps).toHaveLength(2);

            await expect(schedulerFor(workflowId)).resolves.toMatchObject({ pattern: '*/30 * * * *' });
        });

        it('pauses and resumes, keeping the Redis schedule in sync', async () => {
            await api().patch(`${API}/workflows/${workflowId}/pause`).set(auth()).expect(200);
            expect(await schedulerFor(workflowId)).toBeFalsy();

            await api().patch(`${API}/workflows/${workflowId}/pause`).set(auth()).expect(409);
            await api().post(`${API}/webhooks/${webhookToken}/trigger`).send({}).expect(409);

            await api().patch(`${API}/workflows/${workflowId}/resume`).set(auth()).expect(200);
            expect(await schedulerFor(workflowId)).toBeTruthy();
        });

        it('deletes the workflow together with its history and schedule', async () => {
            await api().delete(`${API}/workflows/${workflowId}`).set(auth()).expect(204);

            await api().get(`${API}/workflows/${workflowId}`).set(auth()).expect(404);
            await expect(prisma.execution.count({ where: { workflowId } })).resolves.toBe(0);
            expect(await schedulerFor(workflowId)).toBeFalsy();
        });
    });

    describe('failure handling', () => {
        it('retries a transient upstream failure and records the attempts', async () => {
            const created = await createWorkflow({
                name: 'Flaky upstream',
                cronExpression: '0 3 * * *',
                steps: [{ stepOrder: 1, type: 'HTTP', config: { url: target.url('/flaky') }, retryCount: 2 }],
            }).expect(201);

            const execution = await runNow(created.body.id);

            expect(execution).toMatchObject({ status: 'SUCCESS', steps: [{ status: 'SUCCESS', attempts: 2 }] });
        });

        it('fails at the broken step and skips the rest', async () => {
            const created = await createWorkflow({
                name: 'Broken upstream',
                cronExpression: '0 4 * * *',
                steps: [
                    { stepOrder: 1, type: 'HTTP', config: { url: target.url('/fail') }, retryCount: 0 },
                    { ...DELAY_STEP, stepOrder: 2 },
                ],
            }).expect(201);

            const execution = await runNow(created.body.id);

            expect(execution).toMatchObject({
                status: 'FAILED',
                errorMessage: expect.stringContaining('HTTP 500'),
                steps: [
                    { status: 'FAILED', attempts: 1 },
                    { status: 'SKIPPED', attempts: 0 },
                ],
            });
        });
    });

    describe('API keys', () => {
        it('authenticates resource routes until revoked, and cannot manage keys itself', async () => {
            const created = await api().post(`${API}/api-keys`).set(auth()).send({ name: 'CI' }).expect(201);
            const apiKey = created.body.key as string;

            await api().get(`${API}/workflows`).set('x-api-key', apiKey).expect(200);
            await api().post(`${API}/api-keys`).set('x-api-key', apiKey).send({ name: 'escalation' }).expect(401);

            await api().delete(`${API}/api-keys/${created.body.id}`).set(auth()).expect(204);
            await api().get(`${API}/workflows`).set('x-api-key', apiKey).expect(401);
        });
    });

    describe('metrics and documentation', () => {
        it('summarises the caller’s executions', async () => {
            const response = await api().get(`${API}/metrics`).set(auth()).expect(200);

            expect(response.body.workflows).toEqual({ total: 4, active: 4, paused: 0 });
            expect(response.body.executions).toMatchObject({
                total: 2,
                byStatus: { SUCCESS: 1, FAILED: 1 },
                successRatePercent: 50,
            });
        });

        it('serves the OpenAPI document', async () => {
            const response = await api().get('/docs-json').expect(200);

            expect(Object.keys(response.body.paths)).toEqual(
                expect.arrayContaining([`${API}/workflows`, `${API}/workflows/{workflowId}/executions`, '/health/ready']),
            );
        });
    });
});
