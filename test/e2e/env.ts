/**
 * Infrastructure used by the end-to-end suite. Defaults match docker-compose.yml:
 * the `cronflow_test` database (created by docker/postgres/init) and Redis logical DB 1,
 * so tests never touch development data.
 */
export const E2E_DATABASE_URL =
    process.env.E2E_DATABASE_URL ?? 'postgresql://cronflow:cronflow@localhost:5432/cronflow_test?schema=public';

export const E2E_REDIS_URL = process.env.E2E_REDIS_URL ?? 'redis://localhost:6379/1';
