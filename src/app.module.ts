import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { AppConfig } from './config/configuration';
import { CoreModule } from './core/core.module';
import { ExecutionEngineModule } from './execution-engine/execution-engine.module';
import { ExecutionsModule } from './executions/executions.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ServiceInfoModule } from './service-info/service-info.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
    imports: [
        CoreModule,
        CommonModule,
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService<AppConfig, true>) => {
                const { ttlMs, limit } = config.get('throttle', { infer: true });
                return [{ name: 'default', ttl: ttlMs, limit }];
            },
        }),
        AuthModule,
        WorkflowsModule,
        ExecutionsModule,
        WebhooksModule,
        SchedulerModule,
        MetricsModule,
        HealthModule,
        ServiceInfoModule,
        // Consumes jobs in this process only when WORKER_ENABLED=true.
        ExecutionEngineModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
