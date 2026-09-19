/**
 * Runs before every test file (unit and e2e). Pins a hermetic environment so tests
 * never read a developer's `.env` or touch real infrastructure.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/cronflow_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.LOG_LEVEL = 'silent';
process.env.WORKER_ENABLED = 'false';
process.env.SCHEDULER_SYNC_ON_BOOT = 'false';
process.env.SWAGGER_ENABLED = 'true';
process.env.THROTTLE_LIMIT = '1000';
