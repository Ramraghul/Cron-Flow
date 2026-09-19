import { StepType } from '@prisma/client';
import { buildWorkflowStep } from '../../../test/utils/factories';
import { STEP_LIMITS } from '../../workflows/step-config';
import { DelayStepExecutor } from './delay-step.executor';
import { parseDelayStepConfig, parseHttpStepConfig } from './step-config.parser';

describe('parseHttpStepConfig', () => {
    it('defaults the method to GET and normalises its case', () => {
        expect(parseHttpStepConfig({ url: 'https://example.com' })).toEqual({
            url: 'https://example.com',
            method: 'GET',
            headers: undefined,
            body: undefined,
        });
        expect(parseHttpStepConfig({ url: 'https://example.com', method: 'post' }).method).toBe('POST');
    });

    it('drops headers that are not a string map', () => {
        expect(parseHttpStepConfig({ url: 'https://example.com', headers: { retries: 3 } }).headers).toBeUndefined();
    });

    it.each([
        [null, '"url" is required'],
        [['https://example.com'], '"url" is required'],
        [{ url: 'not a url' }, '"not a url" is not a valid URL'],
        [{ url: 'ftp://example.com' }, 'only http and https URLs are supported'],
        [{ url: 'https://example.com', method: 'TRACE' }, 'unsupported method "TRACE"'],
    ])('rejects %j', (config, reason) => {
        expect(() => parseHttpStepConfig(config)).toThrow(`Invalid HTTP step config: ${reason}`);
    });
});

describe('parseDelayStepConfig', () => {
    it('accepts an integer duration within the limit', () => {
        expect(parseDelayStepConfig({ duration: 1500 })).toEqual({ duration: 1500 });
    });

    it.each([[{}], [{ duration: 0 }], [{ duration: 1.5 }], [{ duration: '1000' }], [{ duration: STEP_LIMITS.maxDelayMs + 1 }], [null]])(
        'rejects %j',
        (config) => {
            expect(() => parseDelayStepConfig(config)).toThrow(/^Invalid DELAY step config/);
        },
    );
});

describe('DelayStepExecutor', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('waits for the configured duration', async () => {
        jest.useFakeTimers();
        const step = buildWorkflowStep({ type: StepType.DELAY, config: { duration: 2000 } });
        let settled = false;

        const pending = new DelayStepExecutor().execute(step).then((result) => {
            settled = true;
            return result;
        });

        await jest.advanceTimersByTimeAsync(1999);
        expect(settled).toBe(false);

        await jest.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual({ attempts: 1, logs: 'Waited 2000ms' });
    });
});
