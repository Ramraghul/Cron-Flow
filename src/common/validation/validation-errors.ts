import { ValidationError } from 'class-validator';

/**
 * Flattens class-validator errors into readable messages with dotted paths, e.g.
 * `steps.0.config.url must be an absolute http(s) URL`.
 *
 * Nest's built-in formatter drops a property's own messages whenever that property also has
 * nested errors (e.g. "duplicate stepOrder values" alongside an invalid step), so clients would
 * only discover the next problem after fixing the first. This keeps every message.
 */
export function flattenValidationErrors(errors: ValidationError[], parentPath = ''): string[] {
    return errors.flatMap((error) => {
        const prefix = parentPath ? `${parentPath}.` : '';
        const ownMessages = Object.values(error.constraints ?? {}).map((message) => `${prefix}${message}`);
        const nestedMessages = flattenValidationErrors(error.children ?? [], `${prefix}${error.property}`);
        return [...ownMessages, ...nestedMessages];
    });
}
