import { getNextRunDate, isValidCronExpression } from './cron.util';

describe('isValidCronExpression', () => {
    it.each(['* * * * *', '0 2 * * *', '*/15 9-17 * * MON-FRI', '0 0 1 1 *', '  30 6 * * 1  '])('accepts "%s"', (expression) => {
        expect(isValidCronExpression(expression)).toBe(true);
    });

    it.each([
        ['', 'empty string'],
        ['* * * *', 'four fields'],
        ['0 * * * * *', 'six fields (per-second schedules are not allowed)'],
        ['60 * * * *', 'minute out of range'],
        ['0 24 * * *', 'hour out of range'],
        ['every day at noon', 'free text'],
    ])('rejects "%s" (%s)', (expression) => {
        expect(isValidCronExpression(expression)).toBe(false);
    });

    it('rejects non-string values', () => {
        expect(isValidCronExpression(42)).toBe(false);
        expect(isValidCronExpression(null)).toBe(false);
        expect(isValidCronExpression(undefined)).toBe(false);
    });
});

describe('getNextRunDate', () => {
    const reference = new Date('2026-09-14T10:00:00.000Z');

    it('returns the next occurrence after the reference time', () => {
        expect(getNextRunDate('0 2 * * *', 'UTC', reference)).toEqual(new Date('2026-09-15T02:00:00.000Z'));
    });

    it('evaluates the expression in the workflow timezone', () => {
        // 09:00 in New York during daylight saving time is 13:00 UTC.
        expect(getNextRunDate('0 9 * * *', 'America/New_York', reference)).toEqual(new Date('2026-09-14T13:00:00.000Z'));
    });

    it('returns null when the next run cannot be computed', () => {
        expect(getNextRunDate('not a cron', 'UTC', reference)).toBeNull();
    });
});
