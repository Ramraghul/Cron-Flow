import {
    ConflictException,
    ExecutionContext,
    INestApplication,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { authenticatedUser, buildWorkflow } from '../../../test/utils/factories';
import { createMock } from '../../../test/utils/mocks';
import { createValidationPipe } from '../../app.setup';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { WorkflowsService } from '../services/workflows.service';
import { toWorkflowResponse } from '../workflow.mapper';
import { WorkflowsController } from './workflows.controller';

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

/** Stands in for JWT/API-key authentication: any Authorization header authenticates as `authenticatedUser`. */
const fakeAuthGuard = {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        if (!req.headers.authorization) {
            throw new UnauthorizedException('Missing or invalid bearer token');
        }
        req.user = authenticatedUser;
        return true;
    },
};

const validBody = {
    name: 'Nightly sync',
    cronExpression: '0 2 * * *',
    steps: [{ stepOrder: 1, type: 'HTTP', config: { url: 'https://example.com/hook' } }],
};

/**
 * Exercises the controller over real HTTP with the production validation pipe and error filter.
 * The service is mocked, so these tests pin down the HTTP contract: routes, status codes and payloads.
 */
describe('WorkflowsController (HTTP)', () => {
    let app: INestApplication<App>;
    let workflowsService: jest.Mocked<WorkflowsService>;

    beforeEach(async () => {
        workflowsService = createMock<WorkflowsService>(['create', 'list', 'findOne', 'update', 'pause', 'resume', 'remove']);

        const moduleRef = await Test.createTestingModule({
            controllers: [WorkflowsController],
            providers: [{ provide: WorkflowsService, useValue: workflowsService }],
        })
            .overrideGuard(JwtOrApiKeyGuard)
            .useValue(fakeAuthGuard)
            .compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(createValidationPipe());
        app.useGlobalFilters(new AllExceptionsFilter());
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    describe('POST /workflows', () => {
        it('returns 201 with the created workflow', async () => {
            workflowsService.create.mockResolvedValue(toWorkflowResponse(buildWorkflow()));

            const response = await request(app.getHttpServer()).post('/workflows').set(AUTH_HEADER).send(validBody).expect(201);

            expect(response.body).toMatchObject({
                id: 'workflow-1',
                status: 'ACTIVE',
                webhookToken: 'webhook-token',
                createdAt: '2026-09-14T10:00:00.000Z',
            });
            expect(workflowsService.create).toHaveBeenCalledWith(authenticatedUser.id, expect.any(CreateWorkflowDto));
        });

        it('returns 400 with every validation error and never calls the service', async () => {
            const response = await request(app.getHttpServer())
                .post('/workflows')
                .set(AUTH_HEADER)
                .send({ name: '', cronExpression: 'every minute', steps: [] })
                .expect(400);

            expect(response.body).toMatchObject({ statusCode: 400, error: 'Bad Request', path: '/workflows', method: 'POST' });
            expect(response.body.message).toEqual(
                expect.arrayContaining([
                    'name should not be empty',
                    expect.stringMatching(/^cronExpression must be a valid 5-field cron expression/),
                    'steps must contain at least 1 step',
                ]),
            );
            expect(workflowsService.create).not.toHaveBeenCalled();
        });

        it('returns 400 in the standard envelope for malformed JSON', async () => {
            const response = await request(app.getHttpServer())
                .post('/workflows')
                .set({ ...AUTH_HEADER, 'Content-Type': 'application/json' })
                .send('{"name": "broken",')
                .expect(400);

            expect(response.body).toMatchObject({ statusCode: 400, error: 'Bad Request', message: expect.stringContaining('JSON') });
            expect(workflowsService.create).not.toHaveBeenCalled();
        });

        it('returns 401 without credentials', async () => {
            const response = await request(app.getHttpServer()).post('/workflows').send(validBody).expect(401);

            expect(response.body).toMatchObject({ statusCode: 401, message: 'Missing or invalid bearer token' });
        });
    });

    describe('GET /workflows', () => {
        it('converts query parameters and applies defaults', async () => {
            workflowsService.list.mockResolvedValue({
                data: [],
                meta: { page: 2, limit: 5, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: true },
            });

            await request(app.getHttpServer()).get('/workflows?status=PAUSED&page=2&limit=5').set(AUTH_HEADER).expect(200);

            expect(workflowsService.list).toHaveBeenCalledWith(
                authenticatedUser.id,
                expect.objectContaining({ status: 'PAUSED', page: 2, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
            );
        });

        it.each([
            ['limit=500', 'limit must not be greater than 100'],
            ['page=0', 'page must not be less than 1'],
            ['status=DELETED', 'status must be one of the following values: ACTIVE, PAUSED'],
            ['sortBy=password', 'sortBy must be one of the following values: createdAt, updatedAt, name'],
        ])('returns 400 for %s', async (query, expectedMessage) => {
            const response = await request(app.getHttpServer()).get(`/workflows?${query}`).set(AUTH_HEADER).expect(400);

            expect(response.body.message).toContain(expectedMessage);
        });
    });

    describe('GET /workflows/:id', () => {
        it('returns 404 in the standard error envelope when the service cannot find the workflow', async () => {
            workflowsService.findOne.mockRejectedValue(new NotFoundException('Workflow missing not found'));

            const response = await request(app.getHttpServer()).get('/workflows/missing').set(AUTH_HEADER).expect(404);

            expect(response.body).toMatchObject({ statusCode: 404, error: 'Not Found', message: 'Workflow missing not found' });
            expect(workflowsService.findOne).toHaveBeenCalledWith(authenticatedUser.id, 'missing');
        });
    });

    describe('PATCH /workflows/:id', () => {
        it('passes a validated partial update to the service', async () => {
            workflowsService.update.mockResolvedValue(toWorkflowResponse(buildWorkflow({ name: 'Renamed' })));

            const response = await request(app.getHttpServer())
                .patch('/workflows/workflow-1')
                .set(AUTH_HEADER)
                .send({ name: 'Renamed' })
                .expect(200);

            expect(response.body.name).toBe('Renamed');
            expect(workflowsService.update).toHaveBeenCalledWith(authenticatedUser.id, 'workflow-1', expect.any(UpdateWorkflowDto));
        });
    });

    describe('PATCH /workflows/:id/pause and /resume', () => {
        it('returns 200 with the paused workflow', async () => {
            workflowsService.pause.mockResolvedValue(toWorkflowResponse(buildWorkflow({ status: 'PAUSED' })));

            const response = await request(app.getHttpServer()).patch('/workflows/workflow-1/pause').set(AUTH_HEADER).expect(200);

            expect(response.body).toMatchObject({ status: 'PAUSED', nextRunAt: null });
        });

        it('returns 409 when the transition is not allowed', async () => {
            workflowsService.resume.mockRejectedValue(new ConflictException('Workflow is already active'));

            const response = await request(app.getHttpServer()).patch('/workflows/workflow-1/resume').set(AUTH_HEADER).expect(409);

            expect(response.body).toMatchObject({ statusCode: 409, message: 'Workflow is already active' });
        });
    });

    describe('DELETE /workflows/:id', () => {
        it('returns 204 with an empty body', async () => {
            workflowsService.remove.mockResolvedValue();

            const response = await request(app.getHttpServer()).delete('/workflows/workflow-1').set(AUTH_HEADER).expect(204);

            expect(response.body).toEqual({});
            expect(workflowsService.remove).toHaveBeenCalledWith(authenticatedUser.id, 'workflow-1');
        });
    });
});
