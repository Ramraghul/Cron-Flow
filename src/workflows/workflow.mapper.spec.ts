import { StepType, WorkflowStatus } from '@prisma/client';
import { buildWorkflow } from '../../test/utils/factories';
import { HttpMethod } from './step-config';
import { generateWebhookToken, toStepInput, toWorkflowResponse } from './workflow.mapper';

describe('workflow mapper', () => {
    describe('toStepInput', () => {
        it('defaults the HTTP method to GET and omits absent optional fields', () => {
            const input = toStepInput({ stepOrder: 1, type: StepType.HTTP, config: { url: 'https://example.com' } });

            expect(input.config).toEqual({ url: 'https://example.com', method: HttpMethod.GET });
        });

        it('keeps headers and a JSON body when provided', () => {
            const input = toStepInput({
                stepOrder: 2,
                type: StepType.HTTP,
                config: { url: 'https://example.com', method: HttpMethod.PUT, headers: { 'X-Id': '1' }, body: { ok: true } },
                retryCount: 0,
                timeout: 2000,
            });

            expect(input).toEqual({
                stepOrder: 2,
                type: StepType.HTTP,
                config: { url: 'https://example.com', method: 'PUT', headers: { 'X-Id': '1' }, body: { ok: true } },
                retryCount: 0,
                timeout: 2000,
            });
        });

        it('stores only the duration for DELAY steps', () => {
            const input = toStepInput({ stepOrder: 1, type: StepType.DELAY, config: { duration: 1500 } });

            expect(input.config).toEqual({ duration: 1500 });
        });
    });

    describe('toWorkflowResponse', () => {
        it('computes the next run for an active workflow', () => {
            const response = toWorkflowResponse(buildWorkflow({ cronExpression: '*/5 * * * *' }));

            expect(response.nextRunAt).toBeInstanceOf(Date);
            expect(response.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
        });

        it('reports no next run while paused', () => {
            expect(toWorkflowResponse(buildWorkflow({ status: WorkflowStatus.PAUSED })).nextRunAt).toBeNull();
        });

        it('never exposes the owner id', () => {
            expect(toWorkflowResponse(buildWorkflow())).not.toHaveProperty('userId');
        });
    });

    describe('generateWebhookToken', () => {
        it('produces unique 32-character URL-safe tokens', () => {
            const tokens = new Set(Array.from({ length: 50 }, generateWebhookToken));

            expect(tokens.size).toBe(50);
            for (const token of tokens) {
                expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
            }
        });
    });
});
