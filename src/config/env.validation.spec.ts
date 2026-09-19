import { NodeEnv, PRODUCTION_MIN_JWT_SECRET_LENGTH, validateEnv } from './env.validation';

const REQUIRED_VARIABLES = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/cronflow',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'development-secret',
};

describe('validateEnv', () => {
    it('applies defaults when only the required variables are set', () => {
        const env = validateEnv(REQUIRED_VARIABLES);

        expect(env).toMatchObject({
            NODE_ENV: NodeEnv.Development,
            PORT: 3000,
            JWT_EXPIRES_IN: '1d',
            BCRYPT_SALT_ROUNDS: 12,
            CORS_ORIGINS: '*',
            THROTTLE_TTL: 60_000,
            THROTTLE_LIMIT: 100,
            WORKER_ENABLED: true,
            WORKER_CONCURRENCY: 5,
            SCHEDULER_SYNC_ON_BOOT: true,
            HTTP_STEP_ALLOW_PRIVATE_NETWORKS: false,
        });
    });

    it('converts numeric and boolean strings to their real types', () => {
        const env = validateEnv({
            ...REQUIRED_VARIABLES,
            PORT: '8080',
            WORKER_CONCURRENCY: '10',
            WORKER_ENABLED: 'false',
            SWAGGER_ENABLED: '0',
            HTTP_STEP_ALLOW_PRIVATE_NETWORKS: 'yes',
        });

        expect(env.PORT).toBe(8080);
        expect(env.WORKER_CONCURRENCY).toBe(10);
        expect(env.WORKER_ENABLED).toBe(false);
        expect(env.SWAGGER_ENABLED).toBe(false);
        expect(env.HTTP_STEP_ALLOW_PRIVATE_NETWORKS).toBe(true);
    });

    it('reports every missing required variable in a single error', () => {
        const validateEmpty = () => validateEnv({});

        expect(validateEmpty).toThrow(/Invalid environment configuration/);
        expect(validateEmpty).toThrow(/DATABASE_URL must be a postgresql:\/\/ connection string/);
        expect(validateEmpty).toThrow(/REDIS_URL must be a redis:\/\/ or rediss:\/\/ connection string/);
        expect(validateEmpty).toThrow(/JWT_SECRET is required/);
    });

    it.each([
        ['PORT', 'not-a-number'],
        ['PORT', '70000'],
        ['NODE_ENV', 'staging'],
        ['JWT_EXPIRES_IN', '7 days'],
        ['BCRYPT_SALT_ROUNDS', '3'],
        ['WORKER_ENABLED', 'maybe'],
        ['LOG_LEVEL', 'verbose'],
        ['DATABASE_URL', 'mysql://localhost/cronflow'],
    ])('rejects %s=%s', (name, value) => {
        expect(() => validateEnv({ ...REQUIRED_VARIABLES, [name]: value })).toThrow(name);
    });

    it('requires a long JWT secret in production only', () => {
        const withShortSecret = { ...REQUIRED_VARIABLES, JWT_SECRET: 'too-short' };

        expect(() => validateEnv({ ...withShortSecret, NODE_ENV: 'production' })).toThrow(
            `JWT_SECRET must be at least ${PRODUCTION_MIN_JWT_SECRET_LENGTH} characters in production`,
        );
        expect(() => validateEnv({ ...withShortSecret, NODE_ENV: 'development' })).not.toThrow();
    });
});
