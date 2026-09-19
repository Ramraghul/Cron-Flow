/** URL prefix for all versioned API routes. Health probes and API docs are served without it. */
export const API_PREFIX = 'api/v1';

/** Swagger UI path. The raw OpenAPI document is served at `/${DOCS_PATH}-json`. */
export const DOCS_PATH = 'docs';

/** Surfaced in the OpenAPI document — keep in sync with `version` in package.json. */
export const APP_VERSION = '3.0.0';

/** Header clients send to authenticate with an API key instead of a JWT. */
export const API_KEY_HEADER = 'x-api-key';

/** Correlation id header: accepted from clients when well-formed, always echoed on responses. */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Security scheme names referenced by Swagger decorators. */
export const JWT_SECURITY_SCHEME = 'JWT';
export const API_KEY_SECURITY_SCHEME = 'ApiKey';
