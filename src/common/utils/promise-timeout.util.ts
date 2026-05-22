export async function promiseTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
): Promise<T> {
    return Promise.race([
        promise,

        new Promise<never>((_, reject) =>
            setTimeout(() => {
                reject(
                    new Error(
                        `Operation timed out after ${timeoutMs}ms`,
                    ),
                );
            }, timeoutMs),
        ),
    ]);
}