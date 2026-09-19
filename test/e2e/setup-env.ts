import { E2E_DATABASE_URL, E2E_REDIS_URL } from './env';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.REDIS_URL = E2E_REDIS_URL;
process.env.JWT_SECRET = 'e2e-jwt-secret-with-at-least-32-characters';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.LOG_LEVEL = 'silent';
process.env.THROTTLE_LIMIT = '1000';
// Run jobs in-process so tests can observe complete executions.
process.env.WORKER_ENABLED = 'true';
process.env.WORKER_CONCURRENCY = '2';
process.env.SCHEDULER_SYNC_ON_BOOT = 'false';
// HTTP steps call a throwaway server on 127.0.0.1 started by the tests.
process.env.HTTP_STEP_ALLOW_PRIVATE_NETWORKS = 'true';
