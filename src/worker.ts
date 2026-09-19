import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/** Standalone worker process: consumes workflow jobs without serving HTTP. */
async function bootstrap(): Promise<void> {
    // This process exists only to run jobs, so the worker is always enabled here.
    process.env.WORKER_ENABLED = 'true';

    const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true, abortOnError: false });
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.enableShutdownHooks();

    logger.log('CronFlow worker started', 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
    console.error('CronFlow worker failed to start:', error);
    process.exit(1);
});
