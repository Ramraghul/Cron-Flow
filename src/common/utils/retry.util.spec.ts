import { RetryError, retryWithBackoff } from './retry.util';

describe('retryWithBackoff', () => {
    let wait: jest.Mock<Promise<void>, [number]>;

    beforeEach(() => {
        wait = jest.fn<Promise<void>, [number]>().mockResolvedValue(undefined);
    });

    it('returns the value after a single attempt when the operation succeeds', async () => {
        const result = await retryWithBackoff(async () => 'ok', { retries: 3, baseDelayMs: 100, wait });

        expect(result).toEqual({ value: 'ok', attempts: 1 });
        expect(wait).not.toHaveBeenCalled();
    });

    it('retries with exponentially growing delays until the operation succeeds', async () => {
        const operation = jest
            .fn<Promise<string>, [number]>()
            .mockRejectedValueOnce(new Error('first failure'))
            .mockRejectedValueOnce(new Error('second failure'))
            .mockResolvedValue('ok');

        const result = await retryWithBackoff(operation, { retries: 3, baseDelayMs: 100, wait });

        expect(result).toEqual({ value: 'ok', attempts: 3 });
        expect(operation.mock.calls).toEqual([[1], [2], [3]]);
        expect(wait.mock.calls).toEqual([[100], [200]]);
    });

    it('caps each delay at maxDelayMs', async () => {
        const operation = () => Promise.reject(new Error('down'));

        await expect(
            retryWithBackoff(operation, { retries: 3, baseDelayMs: 1000, maxDelayMs: 1500, wait }),
        ).rejects.toBeInstanceOf(RetryError);
        expect(wait.mock.calls).toEqual([[1000], [1500], [1500]]);
    });

    it('throws a RetryError carrying the attempt count and last cause once retries are exhausted', async () => {
        const lastFailure = new Error('still down');

        await expect(
            retryWithBackoff(() => Promise.reject(lastFailure), { retries: 2, baseDelayMs: 10, wait }),
        ).rejects.toMatchObject({ name: 'RetryError', message: 'still down', attempts: 3, cause: lastFailure });
    });

    it('stops immediately when shouldRetry rejects the error', async () => {
        const operation = jest.fn<Promise<never>, [number]>().mockRejectedValue(new Error('404 Not Found'));

        await expect(
            retryWithBackoff(operation, { retries: 5, baseDelayMs: 10, wait, shouldRetry: () => false }),
        ).rejects.toMatchObject({ attempts: 1 });
        expect(operation).toHaveBeenCalledTimes(1);
        expect(wait).not.toHaveBeenCalled();
    });

    it('reports each retry through onRetry', async () => {
        const onRetry = jest.fn();
        const failure = new Error('flaky');
        const operation = jest.fn<Promise<string>, [number]>().mockRejectedValueOnce(failure).mockResolvedValue('ok');

        await retryWithBackoff(operation, { retries: 1, baseDelayMs: 250, wait, onRetry });

        expect(onRetry).toHaveBeenCalledWith(failure, 1, 250);
    });
});
