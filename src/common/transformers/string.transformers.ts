import { TransformFnParams } from 'class-transformer';

/** Trims surrounding whitespace; non-strings pass through for the validators to reject. */
export const trimString = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value);

/** Emails are compared case-insensitively, so store and look them up in one canonical form. */
export const normaliseEmail = ({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toLowerCase() : value;
