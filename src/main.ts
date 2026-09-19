import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { API_PREFIX, DOCS_PATH } from './app.constants';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig } from './config/configuration';
import { shouldLoadSwaggerUiFromCdn } from './swagger/swagger';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bufferLogs: true,
        // Surface startup errors (e.g. invalid env) to the catch below instead of aborting the process.
        abortOnError: false,
    });
    const logger = app.get(Logger);
    app.useLogger(logger);
    configureApp(app);

    const { port, swaggerEnabled } = app.get<ConfigService<AppConfig, true>>(ConfigService).get('http', { infer: true });
    await app.listen(port, '0.0.0.0');

    logger.log(`CronFlow API listening on port ${port} — routes under /${API_PREFIX}`, 'Bootstrap');
    if (swaggerEnabled) {
        const assetSource = shouldLoadSwaggerUiFromCdn() ? 'CDN' : 'local files';
        logger.log(`Swagger UI served at /${DOCS_PATH} (UI assets from ${assetSource})`, 'Bootstrap');
    }
}

bootstrap().catch((error: unknown) => {
    // The structured logger may not exist yet (e.g. configuration failed validation), so use stderr.
    console.error('CronFlow API failed to start:', error);
    process.exit(1);
});
