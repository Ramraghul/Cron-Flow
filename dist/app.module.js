"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const schedule_1 = require("@nestjs/schedule");
const core_1 = require("@nestjs/core");
const nestjs_pino_1 = require("nestjs-pino");
const app_config_1 = __importDefault(require("./config/app.config"));
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./auth/auth.module");
const workflow_module_1 = require("./workflows/workflow.module");
const queues_module_1 = require("./queues/queues.module");
const executions_module_1 = require("./executions/executions.module");
const api_keys_module_1 = require("./api-keys/api-keys.module");
const scheduler_module_1 = require("./scheduler/scheduler.module");
const webhooks_module_1 = require("./webhooks/webhooks.module");
const metrics_module_1 = require("./metrics/metrics.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Config
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [app_config_1.default] }),
            // Structured logging
            nestjs_pino_1.LoggerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    pinoHttp: {
                        level: configService.get('log.level'),
                        transport: process.env.NODE_ENV !== 'production'
                            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
                            : undefined,
                        serializers: {
                            req(req) {
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
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ([
                    {
                        ttl: configService.get('throttle.ttl') || 60000,
                        limit: configService.get('throttle.limit') || 100,
                    },
                ]),
            }),
            // Cron scheduler engine
            schedule_1.ScheduleModule.forRoot(),
            // Feature modules
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            workflow_module_1.WorkflowModule,
            queues_module_1.QueuesModule,
            executions_module_1.ExecutionsModule,
            api_keys_module_1.ApiKeysModule,
            scheduler_module_1.SchedulerModule,
            webhooks_module_1.WebhooksModule,
            metrics_module_1.MetricsModule,
        ],
        providers: [
            // Apply rate limiting globally
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map