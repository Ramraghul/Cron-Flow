import { Prisma } from '@prisma/client';
import { isStringRecord } from '../../common/validators/custom-validators';
import { DelayStepConfig, HttpMethod, HttpStepConfig, STEP_LIMITS } from '../../workflows/step-config';
import { StepExecutionError } from './step-executor.interface';

/**
 * Stored step configs are re-validated before running: rows may predate the current API
 * validation rules or have been edited directly in the database.
 */

const HTTP_METHODS = new Set<string>(Object.values(HttpMethod));
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(stepType: string, reason: string): StepExecutionError {
    return new StepExecutionError(`Invalid ${stepType} step config: ${reason}`, 0);
}

export function parseHttpStepConfig(config: Prisma.JsonValue): HttpStepConfig {
    if (!isJsonObject(config) || typeof config.url !== 'string') {
        throw invalid('HTTP', '"url" is required');
    }

    let url: URL;
    try {
        url = new URL(config.url);
    } catch {
        throw invalid('HTTP', `"${config.url}" is not a valid URL`);
    }
    if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
        throw invalid('HTTP', 'only http and https URLs are supported');
    }

    const method = typeof config.method === 'string' ? config.method.toUpperCase() : HttpMethod.GET;
    if (!HTTP_METHODS.has(method)) {
        throw invalid('HTTP', `unsupported method "${method}"`);
    }

    return {
        url: config.url,
        method: method as HttpMethod,
        headers: isStringRecord(config.headers) ? config.headers : undefined,
        body: config.body,
    };
}

export function parseDelayStepConfig(config: Prisma.JsonValue): DelayStepConfig {
    const duration = isJsonObject(config) ? config.duration : undefined;
    if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > STEP_LIMITS.maxDelayMs) {
        throw invalid('DELAY', `"duration" must be an integer between 1 and ${STEP_LIMITS.maxDelayMs} milliseconds`);
    }
    return { duration };
}
