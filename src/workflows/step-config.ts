/**
 * Shapes and limits for workflow steps. Shared by request validation (DTOs) and by the
 * execution engine, which re-validates stored JSON before running it.
 */

export const HttpMethod = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE',
    HEAD: 'HEAD',
} as const;
export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export const STEP_LIMITS = {
    maxSteps: 20,
    maxStepOrder: 1_000,
    maxDelayMs: 5 * 60 * 1000,
    maxRetries: 10,
    minTimeoutMs: 1_000,
    maxTimeoutMs: 5 * 60 * 1000,
} as const;

/** Mirrors the column defaults in prisma/schema.prisma. */
export const STEP_DEFAULTS = {
    retryCount: 3,
    timeoutMs: 30_000,
} as const;

export interface HttpStepConfig {
    url: string;
    method: HttpMethod;
    headers?: Record<string, string>;
    body?: unknown;
}

export interface DelayStepConfig {
    /** Milliseconds */
    duration: number;
}
