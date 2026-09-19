import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'cf_';

/**
 * 32 random bytes = 256 bits of entropy. Keys that strong cannot be brute-forced, so a fast
 * SHA-256 digest (indexed, O(1) lookup) is the right storage choice — bcrypt is for low-entropy passwords.
 */
const API_KEY_RANDOM_BYTES = 32;

/** Leading characters kept in clear text so users can tell their keys apart. */
export const API_KEY_DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 8;

/** Header values longer than this cannot be keys we issued and are rejected without hashing. */
export const API_KEY_MAX_LENGTH = 128;

export function generateApiKey(): string {
    return `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('base64url')}`;
}

export function hashApiKey(rawKey: string): string {
    return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export function apiKeyDisplayPrefix(rawKey: string): string {
    return rawKey.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH);
}
