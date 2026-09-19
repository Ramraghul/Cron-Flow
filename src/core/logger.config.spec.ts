import { IncomingMessage, ServerResponse } from 'node:http';
import { Options } from 'pino-http';
import { redactUrl } from '../common/utils/redact.util';
import { LogLevel, NodeEnv } from '../config/env.validation';
import { buildLoggerOptions, resolveRequestId } from './logger.config';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function requestWithHeaders(headers: Record<string, string>): IncomingMessage {
    return { headers } as unknown as IncomingMessage;
}

function fakeResponse() {
    const setHeader = jest.fn();
    return { response: { setHeader } as unknown as ServerResponse, setHeader };
}

describe('resolveRequestId', () => {
    it('reuses a well-formed id sent by the client and echoes it back', () => {
        const { response, setHeader } = fakeResponse();

        expect(resolveRequestId(requestWithHeaders({ 'x-request-id': 'trace-abc_123' }), response)).toBe('trace-abc_123');
        expect(setHeader).toHaveBeenCalledWith('x-request-id', 'trace-abc_123');
    });

    it.each([
        ['missing', {}],
        ['containing spaces', { 'x-request-id': 'not allowed' }],
        ['too long', { 'x-request-id': 'a'.repeat(65) }],
    ])('generates a UUID when the incoming id is %s', (_label, headers) => {
        const { response, setHeader } = fakeResponse();

        const requestId = resolveRequestId(requestWithHeaders(headers), response);

        expect(requestId).toMatch(UUID_PATTERN);
        expect(setHeader).toHaveBeenCalledWith('x-request-id', requestId);
    });
});

describe('redactUrl', () => {
    it.each([
        ['/api/v1/webhooks/s3cr3t-token/trigger', '/api/v1/webhooks/[REDACTED]/trigger'],
        ['/api/v1/webhooks/s3cr3t-token/trigger?source=github', '/api/v1/webhooks/[REDACTED]/trigger?source=github'],
        ['/api/v1/workflows?page=2', '/api/v1/workflows?page=2'],
        [undefined, ''],
    ])('redacts %s', (url, expected) => {
        expect(redactUrl(url)).toBe(expected);
    });
});

describe('buildLoggerOptions', () => {
    const pinoOptions = (env: NodeEnv) => buildLoggerOptions({ env, log: { level: LogLevel.Info } }).pinoHttp as Options;

    it('pretty-prints only in development and logs JSON everywhere else', () => {
        expect(pinoOptions(NodeEnv.Development).transport).toMatchObject({ target: 'pino-pretty' });
        expect(pinoOptions(NodeEnv.Production).transport).toBeUndefined();
    });

    it.each([
        [200, undefined, 'info'],
        [404, undefined, 'warn'],
        [503, undefined, 'error'],
        [200, new Error('stream failed'), 'error'],
    ])('logs a %i response (error: %s) at level %s', (statusCode, error, level) => {
        const { customLogLevel } = pinoOptions(NodeEnv.Production);

        expect(customLogLevel!({} as IncomingMessage, { statusCode } as ServerResponse, error)).toBe(level);
    });

    it('never logs request headers and redacts webhook tokens from URLs', () => {
        const { serializers } = pinoOptions(NodeEnv.Production);

        const logged = serializers!.req({
            id: 'req-1',
            method: 'POST',
            url: '/api/v1/webhooks/s3cr3t-token/trigger',
            headers: { authorization: 'Bearer eyJhbGciOi', 'x-api-key': 'cf_secret' },
        });

        expect(logged).toEqual({ id: 'req-1', method: 'POST', url: '/api/v1/webhooks/[REDACTED]/trigger' });
    });
});
