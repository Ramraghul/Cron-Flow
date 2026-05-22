declare const _default: () => {
    port: number;
    database: {
        url: string | undefined;
    };
    jwt: {
        secret: string | undefined;
        expiresIn: string;
    };
    redis: {
        host: string;
        port: number;
        url: string;
    };
    throttle: {
        ttl: number;
        limit: number;
    };
    log: {
        level: string;
    };
};
export default _default;
//# sourceMappingURL=app.config.d.ts.map