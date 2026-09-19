import { registerDecorator, ValidationOptions } from 'class-validator';
import { CRON_FIELD_COUNT, isValidCronExpression } from '../utils/cron.util';

function createValidator(name: string, isValid: (value: unknown) => boolean, defaultMessage: string) {
    return (validationOptions?: ValidationOptions): PropertyDecorator =>
        (target: object, propertyName: string | symbol) => {
            registerDecorator({
                name,
                target: target.constructor,
                propertyName: propertyName.toString(),
                options: { message: defaultMessage, ...validationOptions },
                validator: { validate: isValid },
            });
        };
}

export function isStringRecord(value: unknown): value is Record<string, string> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every((entry) => typeof entry === 'string')
    );
}

/** Standard 5-field cron expression, e.g. `0 9 * * MON-FRI`. */
export const IsCronExpression = createValidator(
    'isCronExpression',
    isValidCronExpression,
    `$property must be a valid ${CRON_FIELD_COUNT}-field cron expression (minute hour day-of-month month day-of-week)`,
);

/** Plain object whose values are all strings, e.g. HTTP headers. */
export const IsStringRecord = createValidator(
    'isStringRecord',
    isStringRecord,
    '$property must be an object whose values are all strings',
);
