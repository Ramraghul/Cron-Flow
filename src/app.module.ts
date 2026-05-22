import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import appConfig from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { WorkflowModule } from './workflows/workflow.module';
import { QueuesModule } from './queues/queues.module';
import { ExecutionsModule } from './executions/executions.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
    imports: [
        // Config
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }),

        // Structured logging
        LoggerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                pinoHttp: {
                    level: configService.get('log.level'),
                    transport:
                        process.env.NODE_ENV !== 'production'
                            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
                            : undefined,
                    serializers: {
                        req(req: any) {
                            return {
                                method: req.method,
                                url: req.url,
                                id: req.id,
                            };
                        },
                    },
                },
            }),
        }),

        // Rate limiting
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ([
                {
                    ttl: configService.get<number>('throttle.ttl') || 60000,
                    limit: configService.get<number>('throttle.limit') || 100,
                },
            ]),
        }),

        // Cron scheduler engine
        ScheduleModule.forRoot(),

        // Feature modules
        DatabaseModule,
        AuthModule,
        WorkflowModule,
        QueuesModule,
        ExecutionsModule,
        ApiKeysModule,
        SchedulerModule,
        WebhooksModule,
        MetricsModule,
    ],
    providers: [
        // Apply rate limiting globally
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule { }
