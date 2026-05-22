export async function retryOperation<T>(
    operation: () => Promise<T>,
    retries: number,
    delay: number,
): Promise<T> {
    let currentAttempt = 0;

    while (currentAttempt <= retries) {
        try {
            return await operation();
        } catch (error) {
            currentAttempt++;

            if (currentAttempt > retries) {
                throw error;
            }

            console.log(
                `Retry attempt ${currentAttempt}`,
            );

            await new Promise((resolve) =>
                setTimeout(
                    resolve,
                    delay * currentAttempt,
                ),
            );
        }
    }

    throw new Error('Retry failed');
}