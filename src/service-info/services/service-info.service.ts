import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_VERSION, DOCS_PATH } from '../../app.constants';
import { AppConfig } from '../../config/configuration';
import { HealthService } from '../../health/health.service';
import { ServiceInfoResponseDto } from '../dto/service-info-response.dto';

@Injectable()
export class ServiceInfoService {
    constructor(
        private readonly config: ConfigService<AppConfig, true>,
        private readonly healthService: HealthService,
    ) {}

    /** @param baseUrl origin the request arrived on, e.g. `https://example.com`, without a trailing slash. */
    async getInfo(baseUrl: string): Promise<ServiceInfoResponseDto> {
        const readiness = await this.healthService.checkReadiness();
        const healthy = readiness.status === 'ok';

        return {
            service: 'CronFlow API',
            version: APP_VERSION,
            status: healthy ? 'ok' : 'degraded',
            response: healthy ? 'Up and Running' : 'Running, but PostgreSQL or Redis is unreachable',
            environment: this.config.get('env', { infer: true }),
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: readiness.timestamp,
            dependencies: readiness.checks,
            links: {
                swaggerUi: `${baseUrl}/${DOCS_PATH}`,
                openapi: `${baseUrl}/${DOCS_PATH}-json`,
                liveness: `${baseUrl}/health/live`,
                readiness: `${baseUrl}/health/ready`,
            },
        };
    }
}
