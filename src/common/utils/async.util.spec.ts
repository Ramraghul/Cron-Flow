import { TimeoutError, withTimeout } from './async.util';

describe('withTimeout', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves with the value when the promise settles in time', async () => {
        await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
    });

    it('propagates the original rejection', async () => {
        await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
    });

    it('rejects with a TimeoutError when the promise takes too long', async () => {
        jest.useFakeTimers();
        const neverSettles = new Promise<never>(() => undefined);

        const result = withTimeout(neverSettles, 500, 'took too long');
        const assertion = expect(result).rejects.toEqual(new TimeoutError('took too long'));
        jest.advanceTimersByTime(500);

        await assertion;
    });

    it('clears its timer once the promise settles', async () => {
        jest.useFakeTimers();

        await withTimeout(Promise.resolve('done'), 10_000);

        expect(jest.getTimerCount()).toBe(0);
    });
});
