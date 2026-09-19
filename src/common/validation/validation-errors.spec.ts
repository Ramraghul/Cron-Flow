import { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './validation-errors';

function validationError(
    property: string,
    constraints?: Record<string, string>,
    children: ValidationError[] = [],
): ValidationError {
    return Object.assign(new ValidationError(), { property, constraints, children });
}

describe('flattenValidationErrors', () => {
    it('returns top-level messages unchanged', () => {
        const errors = [validationError('name', { isNotEmpty: 'name should not be empty' })];

        expect(flattenValidationErrors(errors)).toEqual(['name should not be empty']);
    });

    it('prefixes nested messages with their dotted property path', () => {
        const errors = [
            validationError('steps', undefined, [
                validationError('0', undefined, [
                    validationError('config', undefined, [
                        validationError('url', { isUrl: 'url must be an absolute http(s) URL' }),
                    ]),
                ]),
            ]),
        ];

        expect(flattenValidationErrors(errors)).toEqual(['steps.0.config.url must be an absolute http(s) URL']);
    });

    it('keeps a property’s own messages alongside errors in its children', () => {
        const errors = [
            validationError('steps', { arrayUnique: 'steps must not contain duplicate stepOrder values' }, [
                validationError('1', undefined, [validationError('stepOrder', { min: 'stepOrder must not be less than 1' })]),
            ]),
        ];

        expect(flattenValidationErrors(errors)).toEqual([
            'steps must not contain duplicate stepOrder values',
            'steps.1.stepOrder must not be less than 1',
        ]);
    });
});
