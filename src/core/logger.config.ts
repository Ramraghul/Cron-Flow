import { RequestMethod } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Params } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../app.constants';
import { redactUrl } from '../common/utils/redact.util';
import { AppConfig } from '../config/configuration';
import { NodeEnv } from '../config/env.validation';

/** Client-supplied request ids are accepted only if they are short and URL-safe. */
const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;
const HEALTH_PATH_PREFIX = '/health';

export function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);
    return requestId;
}

/**
 * Structured JSON logs in production; single-line pretty logs in development.
 * Every request log carries a request id that is echoed back as `X-Request-Id`.
 */
export function buildLoggerOptions(config: Pick<AppConfig, 'env' | 'log'>): Params {
    return {
        // Named wildcard syntax required by Nest 11 (path-to-regexp v8).
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
        pinoHttp: {
            level: config.log.level,
            transport:
                config.env === NodeEnv.Development
                    ? { target: 'pino-pretty', options: { singleLine: true, colorize: true, ignore: 'pid,hostname' } }
                    : undefined,
            genReqId: resolveRequestId,
            autoLogging: { ignore: (req) => req.url?.startsWith(HEALTH_PATH_PREFIX) ?? false },
            customLogLevel: (_req, res, error) => {
                if (error || res.statusCode >= 500) return 'error';
                if (res.statusCode >= 400) return 'warn';
                return 'info';
            },
            // Log only what is needed to trace a request. Headers are deliberately omitted
            // because they carry credentials (Authorization, x-api-key, cookies).
            serializers: {
                req: (req: { id: unknown; method: string; url: string }) => ({
                    id: req.id,
                    method: req.method,
                    url: redactUrl(req.url),
                }),
                res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
        },
    };
}
