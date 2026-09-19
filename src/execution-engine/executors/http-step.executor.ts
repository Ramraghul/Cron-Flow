import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepType, WorkflowStep } from '@prisma/client';
import { APP_VERSION } from '../../app.constants';
import { TimeoutError } from '../../common/utils/async.util';
import { errorMessage } from '../../common/utils/error.util';
import { assertPublicUrl } from '../../common/utils/network.util';
import { RetryError, retryWithBackoff } from '../../common/utils/retry.util';
import { AppConfig } from '../../config/configuration';
import { HttpMethod, HttpStepConfig } from '../../workflows/step-config';
import { parseHttpStepConfig } from './step-config.parser';
import { StepExecutionError, StepExecutionResult, StepExecutor } from './step-executor.interface';

/** Statuses worth retrying: timeouts, rate limiting and transient upstream failures. */
export const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([408, 425, 429, 500, 502, 503, 504]);
export const RETRY_BASE_DELAY_MS = 1_000;

const METHODS_WITH_BODY: ReadonlySet<HttpMethod> = new Set([HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE]);
const ERROR_BODY_PREVIEW_CHARS = 200;
const USER_AGENT = `CronFlow/${APP_VERSION}`;

/** A non-2xx response. */
export class HttpStatusError extends Error {
    constructor(
        readonly status: number,
        statusText: string,
        bodyPreview: string,
    ) {
        super(`HTTP ${status} ${statusText}${bodyPreview ? ` — ${bodyPreview}` : ''}`.trim());
        this.name = 'HttpStatusError';
    }
}

/** A failure that retrying cannot fix. */
export class PermanentHttpError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PermanentHttpError';
    }
}

export function isRetryableHttpError(error: unknown): boolean {
    if (error instanceof HttpStatusError) {
        return RETRYABLE_HTTP_STATUSES.has(error.status);
    }
    if (error instanceof PermanentHttpError) {
        return false;
    }
    // fetch() rejects with a TypeError for network failures (DNS, refused, reset).
    return error instanceof TypeError || error instanceof TimeoutError;
}

@Injectable()
export class HttpStepExecutor implements StepExecutor {
    readonly type = StepType.HTTP;
    private readonly logger = new Logger(HttpStepExecutor.name);
    private readonly allowPrivateNetworks: boolean;

    constructor(config: ConfigService<AppConfig, true>) {
        this.allowPrivateNetworks = config.get('httpStep', { infer: true }).allowPrivateNetworks;
    }

    async execute(step: WorkflowStep): Promise<StepExecutionResult> {
        const request = parseHttpStepConfig(step.config);

        if (!this.allowPrivateNetworks) {
            try {
                await assertPublicUrl(new URL(request.url));
            } catch (error) {
                throw new StepExecutionError(errorMessage(error), 0, { cause: error });
            }
        }

        try {
            const { value: status, attempts } = await retryWithBackoff(() => this.send(request, step.timeout), {
                retries: step.retryCount,
                baseDelayMs: RETRY_BASE_DELAY_MS,
                shouldRetry: isRetryableHttpError,
                onRetry: (error, attempt, delayMs) =>
                    this.logger.warn(
                        `Step ${step.id}: attempt ${attempt} failed (${errorMessage(error)}); retrying in ${delayMs}ms`,
                    ),
            });
            return { attempts, logs: `${request.method} ${request.url} → ${status} after ${attempts} attempt(s)` };
        } catch (error) {
            const attempts = error instanceof RetryError ? error.attempts : 1;
            const cause = error instanceof RetryError ? error.cause : error;
            throw new StepExecutionError(
                `${request.method} ${request.url} failed after ${attempts} attempt(s): ${errorMessage(cause)}`,
                attempts,
                { cause },
            );
        }
    }

    /** Performs one attempt and resolves with the status code of a 2xx response. */
    private async send(request: HttpStepConfig, timeoutMs: number): Promise<number> {
        const sendsBody = request.body !== undefined && METHODS_WITH_BODY.has(request.method);

        let response: Response;
        try {
            response = await fetch(request.url, {
                method: request.method,
                headers: {
                    'user-agent': USER_AGENT,
                    ...(sendsBody && { 'content-type': 'application/json' }),
                    ...request.headers,
                },
                body: sendsBody ? JSON.stringify(request.body) : undefined,
                // A redirect could bounce the request to an internal address after the SSRF
                // check passed, so redirects are only followed when private networks are allowed.
                redirect: this.allowPrivateNetworks ? 'follow' : 'manual',
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (error) {
            // AbortSignal.timeout() rejects with a DOMException. Match on the name rather than
            // `instanceof Error`, which is not reliable for DOMException across realms.
            const name = (error as { name?: unknown } | null)?.name;
            if (name === 'TimeoutError' || name === 'AbortError') {
                throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
            }
            throw error;
        }

        if (response.status >= 300 && response.status < 400) {
            await response.body?.cancel();
            throw new PermanentHttpError(
                `Redirect ${response.status} to ${response.headers.get('location') ?? 'an unknown location'} was not followed`,
            );
        }

        if (!response.ok) {
            const bodyPreview = (await response.text().catch(() => '')).slice(0, ERROR_BODY_PREVIEW_CHARS);
            throw new HttpStatusError(response.status, response.statusText, bodyPreview);
        }

        await response.body?.cancel();
        return response.status;
    }
}
