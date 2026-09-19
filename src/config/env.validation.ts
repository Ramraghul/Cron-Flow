import { plainToInstance, Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

export enum NodeEnv {
    Development = 'development',
    Test = 'test',
    Production = 'production',
}

export enum LogLevel {
    Trace = 'trace',
    Debug = 'debug',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
    Fatal = 'fatal',
    Silent = 'silent',
}

/** Minimum JWT secret length enforced when NODE_ENV=production. */
export const PRODUCTION_MIN_JWT_SECRET_LENGTH = 32;

/**
 * Parses boolean-like env strings. Unrecognised values pass through untouched so
 * that @IsBoolean() rejects them instead of silently coercing them to `false`.
 */
function toBoolean({ value }: { value: unknown }): unknown {
    if (typeof value !== 'string') return value;
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalised)) return true;
    if (['false', '0', 'no'].includes(normalised)) return false;
    return value;
}

/**
 * Every environment variable the application reads, with its default.
 * This is the single source of truth — see `.env.example` for descriptions.
 */
export class EnvironmentVariables {
    @IsEnum(NodeEnv)
    NODE_ENV: NodeEnv = NodeEnv.Development;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(65535)
    PORT = 3000;

    @IsString()
    @Matches(/^postgres(ql)?:\/\/.+/, { message: 'DATABASE_URL must be a postgresql:// connection string' })
    DATABASE_URL!: string;

    @IsString()
    @Matches(/^rediss?:\/\/.+/, { message: 'REDIS_URL must be a redis:// or rediss:// connection string' })
    REDIS_URL!: string;

    @IsString({ message: 'JWT_SECRET is required' })
    @MinLength(1, { message: 'JWT_SECRET is required' })
    JWT_SECRET!: string;

    @Matches(/^\d+[smhd]$/, { message: 'JWT_EXPIRES_IN must look like 900s, 15m, 12h or 7d' })
    JWT_EXPIRES_IN = '1d';

    @Type(() => Number)
    @IsInt()
    @Min(4)
    @Max(15)
    BCRYPT_SALT_ROUNDS = 12;

    @IsString()
    CORS_ORIGINS = '*';

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(10)
    TRUST_PROXY_HOPS = 0;

    @Transform(toBoolean)
    @IsBoolean()
    SWAGGER_ENABLED = true;

    @Type(() => Number)
    @IsInt()
    @Min(1000)
    THROTTLE_TTL = 60_000;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    THROTTLE_LIMIT = 100;

    @IsEnum(LogLevel)
    LOG_LEVEL: LogLevel = LogLevel.Info;

    @Transform(toBoolean)
    @IsBoolean()
    WORKER_ENABLED = true;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    WORKER_CONCURRENCY = 5;

    @Transform(toBoolean)
    @IsBoolean()
    SCHEDULER_SYNC_ON_BOOT = true;

    @Transform(toBoolean)
    @IsBoolean()
    HTTP_STEP_ALLOW_PRIVATE_NETWORKS = false;
}

/**
 * Validates raw environment variables and applies defaults.
 * Throws a single error listing every problem so misconfiguration fails fast at boot.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
    const env = plainToInstance(EnvironmentVariables, config, { exposeDefaultValues: true });
    const problems = validateSync(env, { forbidUnknownValues: false }).flatMap((error) =>
        Object.values(error.constraints ?? {}),
    );

    if (
        env.NODE_ENV === NodeEnv.Production &&
        typeof env.JWT_SECRET === 'string' &&
        env.JWT_SECRET.length < PRODUCTION_MIN_JWT_SECRET_LENGTH
    ) {
        problems.push(`JWT_SECRET must be at least ${PRODUCTION_MIN_JWT_SECRET_LENGTH} characters in production`);
    }

    if (problems.length > 0) {
        throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    }

    return env;
}
