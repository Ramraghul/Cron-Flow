/**
 * Unit tests: colocated `*.spec.ts` files under src/. No database or Redis required.
 * Files are transpiled without type-checking for speed — `npm run typecheck` covers types.
 */
/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
    },
    setupFiles: ['<rootDir>/../test/setup-env.ts'],
    setupFilesAfterEnv: ['<rootDir>/../test/setup-unit.ts'],
    clearMocks: true,
    restoreMocks: true,
    collectCoverageFrom: [
        '**/*.ts',
        '!**/*.spec.ts',
        '!**/*.module.ts',
        '!**/dto/**',
        '!main.ts',
        '!worker.ts',
        '!scripts/**',
        '!swagger/**',
        '!app.setup.ts',
    ],
    coverageDirectory: '../coverage',
    coverageReporters: ['text-summary', 'text', 'lcov'],
    // Controllers and Prisma repositories are exercised by the e2e suite rather than unit tests.
    coverageThreshold: {
        global: { statements: 78, branches: 55, functions: 65, lines: 78 },
    },
};
