/**
 * End-to-end tests: boot the real AppModule against PostgreSQL and Redis.
 * Start them first:  docker compose up -d postgres redis
 * Override targets with E2E_DATABASE_URL / E2E_REDIS_URL (see test/e2e/env.ts).
 */
/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '..',
    testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
    },
    globalSetup: '<rootDir>/test/e2e/global-setup.ts',
    setupFiles: ['<rootDir>/test/e2e/setup-env.ts'],
    testTimeout: 60_000,
};
