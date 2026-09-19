import { sleep } from './async.util';

export interface RetryOptions {
    /** Retries allowed after the first attempt (0 = try once). */
    retries: number;
    /** Delay before the first retry; doubles on each subsequent retry. */
    baseDelayMs: number;
    /** Upper bound for any single delay. */
    maxDelayMs?: number;
    /** Return `false` to stop immediately, e.g. for errors that retrying cannot fix. */
    shouldRetry?: (error: unknown, attempt: number) => boolean;
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
    /** Injectable for tests. */
    wait?: (ms: number) => Promise<void>;
}

export interface RetryResult<T> {
    value: T;
    /** Total attempts made, including the successful one. */
    attempts: number;
}

/** Thrown when an operation fails permanently. `cause` holds the last underlying error. */
export class RetryError extends Error {
    constructor(
        message: string,
        readonly attempts: number,
        options: { cause: unknown },
    ) {
        super(message, options);
        this.name = 'RetryError';
    }
}

const DEFAULT_MAX_DELAY_MS = 30_000;

/** Runs `operation`, retrying failures with exponential backoff (base, 2×base, 4×base…). */
export async function retryWithBackoff<T>(
    operation: (attempt: number) => Promise<T>,
    options: RetryOptions,
): Promise<RetryResult<T>> {
    const { retries, baseDelayMs, maxDelayMs = DEFAULT_MAX_DELAY_MS, shouldRetry = () => true, onRetry, wait = sleep } = options;

    for (let attempt = 1; ; attempt++) {
        try {
            return { value: await operation(attempt), attempts: attempt };
        } catch (error) {
            if (attempt > retries || !shouldRetry(error, attempt)) {
                const reason = error instanceof Error ? error.message : String(error);
                throw new RetryError(reason, attempt, { cause: error });
            }

            const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
            onRetry?.(error, attempt, delayMs);
            await wait(delayMs);
        }
    }
}
