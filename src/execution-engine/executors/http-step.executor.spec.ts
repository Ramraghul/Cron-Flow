import { StepType, WorkflowStep } from '@prisma/client';
import { buildWorkflowStep } from '../../../test/utils/factories';
import { createConfigMock } from '../../../test/utils/mocks';
import { TimeoutError } from '../../common/utils/async.util';
import {
    HttpStatusError,
    HttpStepExecutor,
    isRetryableHttpError,
    PermanentHttpError,
    RETRY_BASE_DELAY_MS,
} from './http-step.executor';
import { StepExecutionError } from './step-executor.interface';

function httpStep(config: Record<string, unknown>, overrides: Partial<WorkflowStep> = {}): WorkflowStep {
    return buildWorkflowStep({ type: StepType.HTTP, config: config as WorkflowStep['config'], retryCount: 0, timeout: 5000, ...overrides });
}

function createExecutor(allowPrivateNetworks: boolean): HttpStepExecutor {
    return new HttpStepExecutor(createConfigMock({ httpStep: { allowPrivateNetworks } }));
}

describe('HttpStepExecutor', () => {
    let fetchMock: jest.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

    beforeEach(() => {
        fetchMock = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('requests', () => {
        it('sends the configured method, headers and JSON body', async () => {
            fetchMock.mockResolvedValue(new Response('ok', { status: 201 }));
            const step = httpStep({
                url: 'https://api.example.com/hook',
                method: 'POST',
                headers: { 'x-token': 'abc' },
                body: { event: 'sync' },
            });

            const result = await createExecutor(true).execute(step);

            expect(result).toEqual({ attempts: 1, logs: 'POST https://api.example.com/hook → 201 after 1 attempt(s)' });
            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/hook',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ event: 'sync' }),
                    headers: expect.objectContaining({
                        'content-type': 'application/json',
                        'x-token': 'abc',
                        'user-agent': expect.stringMatching(/^CronFlow\//),
                    }),
                    signal: expect.any(AbortSignal),
                }),
            );
        });

        it('never sends a body with GET requests', async () => {
            fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

            await createExecutor(true).execute(httpStep({ url: 'https://api.example.com', method: 'GET', body: { ignored: true } }));

            const [, init] = fetchMock.mock.calls[0];
            expect(init?.body).toBeUndefined();
            expect(init?.headers).not.toHaveProperty('content-type');
        });

        it('fails without making a request when the stored config is invalid', async () => {
            await expect(createExecutor(true).execute(httpStep({ method: 'POST' }))).rejects.toMatchObject({
                name: 'StepExecutionError',
                attempts: 0,
                message: 'Invalid HTTP step config: "url" is required',
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('retries', () => {
        it('retries a transient 503 with backoff and reports the attempts', async () => {
            jest.useFakeTimers();
            fetchMock
                .mockResolvedValueOnce(new Response('busy', { status: 503, statusText: 'Service Unavailable' }))
                .mockResolvedValueOnce(new Response('ok', { status: 200 }));

            const pending = createExecutor(true).execute(httpStep({ url: 'https://api.example.com' }, { retryCount: 3 }));
            await jest.advanceTimersByTimeAsync(RETRY_BASE_DELAY_MS);

            await expect(pending).resolves.toMatchObject({ attempts: 2 });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('gives up after retryCount retries with the last error', async () => {
            jest.useFakeTimers();
            fetchMock.mockImplementation(async () => new Response('down', { status: 502, statusText: 'Bad Gateway' }));

            const pending = createExecutor(true).execute(httpStep({ url: 'https://api.example.com' }, { retryCount: 2 }));
            const assertion = expect(pending).rejects.toMatchObject({
                attempts: 3,
                message: 'GET https://api.example.com failed after 3 attempt(s): HTTP 502 Bad Gateway — down',
            });
            await jest.advanceTimersByTimeAsync(RETRY_BASE_DELAY_MS * 3);

            await assertion;
            expect(fetchMock).toHaveBeenCalledTimes(3);
        });

        it('does not retry client errors such as 404', async () => {
            fetchMock.mockResolvedValue(new Response('missing', { status: 404, statusText: 'Not Found' }));

            await expect(
                createExecutor(true).execute(httpStep({ url: 'https://api.example.com' }, { retryCount: 5 })),
            ).rejects.toMatchObject({ attempts: 1, message: expect.stringContaining('HTTP 404 Not Found') });
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('retries network failures', async () => {
            jest.useFakeTimers();
            fetchMock
                .mockRejectedValueOnce(new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') }))
                .mockResolvedValueOnce(new Response('ok', { status: 200 }));

            const pending = createExecutor(true).execute(httpStep({ url: 'https://api.example.com' }, { retryCount: 1 }));
            await jest.advanceTimersByTimeAsync(RETRY_BASE_DELAY_MS);

            await expect(pending).resolves.toMatchObject({ attempts: 2 });
        });

        it('reports an aborted request as a timeout', async () => {
            fetchMock.mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

            await expect(createExecutor(true).execute(httpStep({ url: 'https://api.example.com' }))).rejects.toMatchObject({
                message: 'GET https://api.example.com failed after 1 attempt(s): Request timed out after 5000ms',
            });
        });
    });

    describe('SSRF protection', () => {
        it('refuses private addresses without sending a request', async () => {
            const failure = createExecutor(false).execute(httpStep({ url: 'http://127.0.0.1:8080/admin' }));

            await expect(failure).rejects.toBeInstanceOf(StepExecutionError);
            await expect(failure).rejects.toMatchObject({
                attempts: 0,
                message: expect.stringContaining('non-public address 127.0.0.1'),
            });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('does not follow redirects, which could point at an internal address', async () => {
            fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }));

            await expect(
                createExecutor(false).execute(httpStep({ url: 'https://93.184.216.34/hook' }, { retryCount: 3 })),
            ).rejects.toMatchObject({ attempts: 1, message: expect.stringContaining('Redirect 302 to http://169.254.169.254/') });
            expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ redirect: 'manual' }));
        });

        it('follows redirects when private networks are explicitly allowed', async () => {
            fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

            await createExecutor(true).execute(httpStep({ url: 'http://localhost:4000/hook' }));

            expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/hook', expect.objectContaining({ redirect: 'follow' }));
        });
    });
});

describe('isRetryableHttpError', () => {
    it.each([
        [new HttpStatusError(503, 'Service Unavailable', ''), true],
        [new HttpStatusError(429, 'Too Many Requests', ''), true],
        [new HttpStatusError(408, 'Request Timeout', ''), true],
        [new HttpStatusError(400, 'Bad Request', ''), false],
        [new HttpStatusError(401, 'Unauthorized', ''), false],
        [new TypeError('fetch failed'), true],
        [new TimeoutError('timed out'), true],
        [new PermanentHttpError('redirect not followed'), false],
        [new Error('unknown'), false],
    ])('%s → %s', (error, expected) => {
        expect(isRetryableHttpError(error)).toBe(expected);
    });
});
