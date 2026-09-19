import { parseExpression } from 'cron-parser';

/** Only standard 5-field expressions are accepted — this rules out per-second schedules. */
export const CRON_FIELD_COUNT = 5;

export function isValidCronExpression(expression: unknown): expression is string {
    if (typeof expression !== 'string') {
        return false;
    }

    const fields = expression.trim().split(/\s+/);
    if (fields.length !== CRON_FIELD_COUNT) {
        return false;
    }

    try {
        parseExpression(expression.trim());
        return true;
    } catch {
        return false;
    }
}

/** Next time `expression` fires after `from`, evaluated in `timezone`; `null` if it cannot be computed. */
export function getNextRunDate(expression: string, timezone: string, from: Date = new Date()): Date | null {
    try {
        return parseExpression(expression, { currentDate: from, tz: timezone }).next().toDate();
    } catch {
        return null;
    }
}
