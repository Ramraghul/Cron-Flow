export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rejects with a {@link TimeoutError} if `promise` does not settle within `timeoutMs`.
 * The timer is always cleared so it never keeps the process alive.
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message = `Operation timed out after ${timeoutMs}ms`,
): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
}
