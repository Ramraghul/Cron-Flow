"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./queues/processors/workflow.processor");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const nestjs_pino_1 = require("nestjs-pino");
const app_module_1 = require("./app.module");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true });
    // Structured logging via Pino
    app.useLogger(app.get(nestjs_pino_1.Logger));
    const configService = app.get(config_1.ConfigService);
    // Global validation pipe
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    // Global exception filter
    app.useGlobalFilters(new all_exceptions_filter_1.AllExceptionsFilter());
    // CORS
    app.enableCors();
    // ─── Swagger
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('CronFlow API')
        .setDescription('CronFlow v2 — Workflow Automation Platform.\n\n' +
        'Authenticate via **JWT Bearer token** (from `/auth/login`) ' +
        'or an **API key** (`x-api-key` header).')
        .setVersion('2.0.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
        .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'ApiKey')
        .addTag('Auth', 'Register and login')
        .addTag('Workflows', 'Create, manage, pause, and resume workflows')
        .addTag('Executions', 'Trigger and inspect execution history')
        .addTag('Scheduler', 'Cron-based scheduler engine status')
        .addTag('Webhooks', 'Trigger workflows via webhook URL')
        .addTag('API Keys', 'Generate and revoke API keys')
        .addTag('Metrics', 'Platform-wide metrics and health')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: 'alpha',
        },
        customSiteTitle: 'CronFlow API Docs',
    });
    // ─────────────────────────────────────────────────────────────────────────
    const port = configService.get('port') || 3000;
    await app.listen(port);
    console.log(`CronFlow v2 running on: http://localhost:${port}`);
    console.log(`Swagger docs:           http://localhost:${port}/docs`);
    console.log(`Metrics:                http://localhost:${port}/metrics`);
}
bootstrap().catch((error) => {
    console.error('Failed to bootstrap application:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map