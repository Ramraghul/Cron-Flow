import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../app.setup';
import { CreateWorkflowDto } from './create-workflow.dto';
import { UpdateWorkflowDto } from './update-workflow.dto';
import { DelayStepConfigDto, HttpStepConfigDto, WorkflowStepDto } from './workflow-step.dto';

/** Runs payloads through the same ValidationPipe configuration the application uses. */
const pipe = createValidationPipe();

async function validate(metatype: ArgumentMetadata['metatype'], payload: unknown): Promise<string[]> {
    try {
        await pipe.transform(payload, { type: 'body', metatype, data: '' });
        return [];
    } catch (error) {
        if (error instanceof BadRequestException) {
            return (error.getResponse() as { message: string[] }).message;
        }
        throw error;
    }
}

function validPayload(): Record<string, unknown> & { steps: Array<Record<string, unknown>> } {
    return {
        name: '  Nightly sync  ',
        cronExpression: '0 2 * * *',
        timezone: 'Europe/London',
        steps: [
            {
                stepOrder: 1,
                type: 'HTTP',
                config: { url: 'https://example.com/hook', method: 'POST', headers: { 'X-Token': 'abc' }, body: { a: 1 } },
                retryCount: 2,
                timeout: 5000,
            },
            { stepOrder: 2, type: 'DELAY', config: { duration: 1000 } },
        ],
    };
}

describe('CreateWorkflowDto validation', () => {
    it('accepts a valid payload and builds typed, trimmed DTO instances', async () => {
        const dto = (await pipe.transform(validPayload(), {
            type: 'body',
            metatype: CreateWorkflowDto,
            data: '',
        })) as CreateWorkflowDto;

        expect(dto).toBeInstanceOf(CreateWorkflowDto);
        expect(dto.name).toBe('Nightly sync');
        expect(dto.steps[0]).toBeInstanceOf(WorkflowStepDto);
        expect(dto.steps[0].config).toBeInstanceOf(HttpStepConfigDto);
        expect(dto.steps[1].config).toBeInstanceOf(DelayStepConfigDto);
    });

    it.each([
        ['0 2 * *', 'too few fields'],
        ['*/5 * * * * *', 'seconds field'],
        ['61 * * * *', 'out-of-range minute'],
    ])('rejects cron expression "%s" (%s)', async (cronExpression) => {
        const errors = await validate(CreateWorkflowDto, { ...validPayload(), cronExpression });

        expect(errors).toContain(
            'cronExpression must be a valid 5-field cron expression (minute hour day-of-month month day-of-week)',
        );
    });

    it('rejects an unknown timezone', async () => {
        const errors = await validate(CreateWorkflowDto, { ...validPayload(), timezone: 'Mars/Olympus_Mons' });

        expect(errors).toContain('timezone must be a valid IANA timezone, e.g. Europe/London');
    });

    it('requires a non-empty name', async () => {
        const errors = await validate(CreateWorkflowDto, { ...validPayload(), name: '   ' });

        expect(errors).toContain('name should not be empty');
    });

    it('requires at least one step', async () => {
        const errors = await validate(CreateWorkflowDto, { ...validPayload(), steps: [] });

        expect(errors).toContain('steps must contain at least 1 step');
    });

    it('rejects duplicate stepOrder values', async () => {
        const payload = validPayload();
        payload.steps[1].stepOrder = 1;

        const errors = await validate(CreateWorkflowDto, payload);

        expect(errors).toContain('steps must not contain duplicate stepOrder values');
    });

    it('reports array-level and nested step errors together', async () => {
        const payload = validPayload();
        payload.steps[1].stepOrder = 1;
        payload.steps[0].config = { url: 'ftp://example.com' };

        const errors = await validate(CreateWorkflowDto, payload);

        expect(errors).toEqual(
            expect.arrayContaining([
                'steps must not contain duplicate stepOrder values',
                'steps.0.config.url must be an absolute http(s) URL',
            ]),
        );
    });

    it.each(['ftp://example.com/file', 'example.com/hook', 'not a url'])('rejects HTTP step url "%s"', async (url) => {
        const payload = validPayload();
        payload.steps[0].config = { url };

        const errors = await validate(CreateWorkflowDto, payload);

        expect(errors).toContain('steps.0.config.url must be an absolute http(s) URL');
    });

    it('validates config against the rules for the step type', async () => {
        const payload = validPayload();
        payload.steps[1].config = { url: 'https://example.com' };

        const errors = await validate(CreateWorkflowDto, payload);

        expect(errors).toEqual(
            expect.arrayContaining([
                'steps.1.config.property url should not exist',
                expect.stringMatching(/^steps\.1\.config\.duration must be/),
            ]),
        );
    });

    it('rejects a DELAY duration above the limit', async () => {
        const payload = validPayload();
        payload.steps[1].config = { duration: 10 * 60 * 1000 };

        const errors = await validate(CreateWorkflowDto, payload);

        expect(errors).toContain('steps.1.config.duration must not be greater than 300000');
    });

    it('rejects non-string header values, unknown methods and out-of-range retry settings', async () => {
        const payload = validPayload();
        payload.steps[0] = {
            ...payload.steps[0],
            config: { url: 'https://example.com', method: 'TRACE', headers: { 'X-Retries': 3 } },
            retryCount: 11,
            timeout: 10,
        };

        const errors = await validate(CreateWorkflowDto, payload);

        expect(errors).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/^steps\.0\.config\.method must be one of the following values/),
                'steps.0.config.headers must be an object whose values are all strings',
                'steps.0.retryCount must not be greater than 10',
                'steps.0.timeout must not be less than 1000',
            ]),
        );
    });

    it('rejects a config that is not an object', async () => {
        const payload = validPayload();
        payload.steps[0].config = 'https://example.com';

        const errors = await validate(CreateWorkflowDto, payload);

        expect(errors).toContain('steps.0.config must be an object');
    });

    it('rejects properties that are not part of the contract', async () => {
        const errors = await validate(CreateWorkflowDto, { ...validPayload(), userId: 'someone-else' });

        expect(errors).toContain('property userId should not exist');
    });
});

describe('UpdateWorkflowDto validation', () => {
    it('accepts a partial payload', async () => {
        await expect(validate(UpdateWorkflowDto, { name: 'Renamed' })).resolves.toEqual([]);
    });

    it('still validates the fields that are provided', async () => {
        const errors = await validate(UpdateWorkflowDto, { cronExpression: 'whenever', steps: [] });

        expect(errors).toEqual(
            expect.arrayContaining([
                expect.stringMatching(/^cronExpression must be a valid 5-field cron expression/),
                'steps must contain at least 1 step',
            ]),
        );
    });
});
