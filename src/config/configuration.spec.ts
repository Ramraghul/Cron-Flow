import { buildConfig, durationToSeconds, parseCorsOrigins } from './configuration';
import { validateEnv } from './env.validation';

describe('durationToSeconds', () => {
    it.each([
        ['900s', 900],
        ['15m', 900],
        ['12h', 43_200],
        ['7d', 604_800],
    ])('converts %s to %i seconds', (duration, expected) => {
        expect(durationToSeconds(duration)).toBe(expected);
    });

    it('rejects unsupported units', () => {
        expect(() => durationToSeconds('2w')).toThrow('Invalid duration "2w"');
    });
});

describe('parseCorsOrigins', () => {
    it.each(['*', '', ' , ', 'https://app.example.com,*'])('treats "%s" as any origin', (raw) => {
        expect(parseCorsOrigins(raw)).toBe('*');
    });

    it('splits and trims a comma-separated list', () => {
        expect(parseCorsOrigins('https://app.example.com, https://admin.example.com ')).toEqual([
            'https://app.example.com',
            'https://admin.example.com',
        ]);
    });
});

describe('buildConfig', () => {
    it('maps validated environment variables into typed sections', () => {
        const config = buildConfig(
            validateEnv({
                NODE_ENV: 'production',
                DATABASE_URL: 'postgresql://user:pass@db:5432/cronflow',
                REDIS_URL: 'rediss://cache:6380',
                JWT_SECRET: 'x'.repeat(32),
                JWT_EXPIRES_IN: '2h',
                CORS_ORIGINS: 'https://app.example.com',
                TRUST_PROXY_HOPS: '1',
                WORKER_ENABLED: 'false',
            }),
        );

        expect(config).toMatchObject({
            isProduction: true,
            http: { port: 3000, corsOrigins: ['https://app.example.com'], trustProxyHops: 1, swaggerEnabled: true },
            redis: { url: 'rediss://cache:6380' },
            auth: { jwtExpiresInSeconds: 7200, bcryptSaltRounds: 12 },
            worker: { enabled: false, concurrency: 5 },
        });
    });
});
