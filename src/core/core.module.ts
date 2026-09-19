import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import configuration, { AppConfig } from '../config/configuration';
import { DatabaseModule } from '../database/database.module';
import { buildLoggerOptions } from './logger.config';

/**
 * Infrastructure shared by the HTTP API and the standalone worker:
 * validated configuration, structured logging and the database client.
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            load: [configuration],
            // Tests pin their own environment and must never read a developer's .env file.
            ignoreEnvFile: process.env.NODE_ENV === 'test',
        }),
        LoggerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService<AppConfig, true>) =>
                buildLoggerOptions({ env: config.get('env', { infer: true }), log: config.get('log', { infer: true }) }),
        }),
        DatabaseModule,
    ],
})
export class CoreModule {}
