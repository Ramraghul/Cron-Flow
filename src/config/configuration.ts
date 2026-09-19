import { EnvironmentVariables, LogLevel, NodeEnv, validateEnv } from './env.validation';

/** Strongly-typed application configuration. Inject with `ConfigService<AppConfig, true>`. */
export interface AppConfig {
    env: NodeEnv;
    isProduction: boolean;
    http: {
        port: number;
        corsOrigins: '*' | string[];
        trustProxyHops: number;
        swaggerEnabled: boolean;
    };
    database: { url: string };
    redis: { url: string };
    auth: {
        jwtSecret: string;
        jwtExpiresInSeconds: number;
        bcryptSaltRounds: number;
    };
    throttle: { ttlMs: number; limit: number };
    log: { level: LogLevel };
    worker: { enabled: boolean; concurrency: number };
    scheduler: { syncOnBoot: boolean };
    httpStep: { allowPrivateNetworks: boolean };
}

const SECONDS_PER_UNIT: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/** Converts a duration such as `15m` or `7d` into seconds. */
export function durationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
        throw new Error(`Invalid duration "${duration}" — expected <number><s|m|h|d>`);
    }
    return Number(match[1]) * SECONDS_PER_UNIT[match[2]];
}

/** Parses `CORS_ORIGINS` — either `*` or a comma-separated list of origins. */
export function parseCorsOrigins(raw: string): '*' | string[] {
    const origins = raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return origins.length === 0 || origins.includes('*') ? '*' : origins;
}

export function buildConfig(env: EnvironmentVariables): AppConfig {
    return {
        env: env.NODE_ENV,
        isProduction: env.NODE_ENV === NodeEnv.Production,
        http: {
            port: env.PORT,
            corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
            trustProxyHops: env.TRUST_PROXY_HOPS,
            swaggerEnabled: env.SWAGGER_ENABLED,
        },
        database: { url: env.DATABASE_URL },
        redis: { url: env.REDIS_URL },
        auth: {
            jwtSecret: env.JWT_SECRET,
            jwtExpiresInSeconds: durationToSeconds(env.JWT_EXPIRES_IN),
            bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
        },
        throttle: { ttlMs: env.THROTTLE_TTL, limit: env.THROTTLE_LIMIT },
        log: { level: env.LOG_LEVEL },
        worker: { enabled: env.WORKER_ENABLED, concurrency: env.WORKER_CONCURRENCY },
        scheduler: { syncOnBoot: env.SCHEDULER_SYNC_ON_BOOT },
        httpStep: { allowPrivateNetworks: env.HTTP_STEP_ALLOW_PRIVATE_NETWORKS },
    };
}

/** Config factory for `ConfigModule.forRoot({ load: [configuration] })`. */
export default (): AppConfig => buildConfig(validateEnv(process.env));
