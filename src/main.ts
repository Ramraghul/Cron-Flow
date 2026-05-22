import './queues/processors/workflow.processor';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });

    // Structured logging via Pino
    app.useLogger(app.get(Logger));

    const configService = app.get(ConfigService);

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // Global exception filter
    app.useGlobalFilters(new AllExceptionsFilter());

    // CORS
    app.enableCors();

    // ─── Swagger
    const swaggerConfig = new DocumentBuilder()
        .setTitle('CronFlow API')
        .setDescription(
            'CronFlow v2 — Workflow Automation Platform.\n\n' +
            'Authenticate via **JWT Bearer token** (from `/auth/login`) ' +
            'or an **API key** (`x-api-key` header).',
        )
        .setVersion('2.0.0')
        .addBearerAuth(
            { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            'JWT',
        )
        .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'ApiKey')
        .addTag('Auth', 'Register and login')
        .addTag('Workflows', 'Create, manage, pause, and resume workflows')
        .addTag('Executions', 'Trigger and inspect execution history')
        .addTag('Scheduler', 'Cron-based scheduler engine status')
        .addTag('Webhooks', 'Trigger workflows via webhook URL')
        .addTag('API Keys', 'Generate and revoke API keys')
        .addTag('Metrics', 'Platform-wide metrics and health')
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
        swaggerOptions: {
            persistAuthorization: true,
            tagsSorter: 'alpha',
        },
        customSiteTitle: 'CronFlow API Docs',
    });
    // ─────────────────────────────────────────────────────────────────────────

    const port = configService.get<number>('port') || 3000;
    await app.listen(port);

    console.log(`CronFlow v2 running on: http://localhost:${port}`);
    console.log(`Swagger docs:           http://localhost:${port}/docs`);
    console.log(`Metrics:                http://localhost:${port}/metrics`);
}

bootstrap().catch((error) => {
    console.error('Failed to bootstrap application:', error);
    process.exit(1);
});
