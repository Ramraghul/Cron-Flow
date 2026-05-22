export default () => ({
    port: parseInt(process.env.PORT || '3000', 10),

    database: {
        url: process.env.DATABASE_URL,
    },

    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    throttle: {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),   // 60s window
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10), // 100 requests/window
    },

    log: {
        level: process.env.LOG_LEVEL || 'info',
    },
});
