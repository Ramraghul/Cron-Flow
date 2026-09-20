import { NodeEnv } from '../../config/env.validation';
import { createConfigMock, createMock } from '../../../test/utils/mocks';
import { HealthService } from '../../health/health.service';
import { ReadinessResponseDto } from '../../health/dto/health-response.dto';
import { ServiceInfoService } from './service-info.service';

const BASE_URL = 'https://cron-flow.example.com';

function readiness(redisUp: boolean): ReadinessResponseDto {
    return {
        status: redisUp ? 'ok' : 'error',
        checks: {
            database: { status: 'up', latencyMs: 3 },
            redis: { status: redisUp ? 'up' : 'down', latencyMs: 2 },
        },
        timestamp: '2026-09-14T10:00:00.000Z',
    };
}

describe('ServiceInfoService', () => {
    let healthService: jest.Mocked<HealthService>;
    let service: ServiceInfoService;

    beforeEach(() => {
        healthService = createMock<HealthService>(['checkReadiness']);
        service = new ServiceInfoService(
            createConfigMock({ env: NodeEnv.Production, worker: { enabled: true, concurrency: 5 } }),
            healthService,
        );
    });

    it('reports the service, its dependencies and links built from the request origin', async () => {
        healthService.checkReadiness.mockResolvedValue(readiness(true));

        const info = await service.getInfo(BASE_URL);

        expect(info).toMatchObject({
            service: 'CronFlow API',
            status: 'ok',
            response: 'Up and Running',
            environment: 'production',
            dependencies: { database: { status: 'up' }, redis: { status: 'up' } },
            links: {
                swaggerUi: `${BASE_URL}/docs`,
                openapi: `${BASE_URL}/docs-json`,
                liveness: `${BASE_URL}/health/live`,
                readiness: `${BASE_URL}/health/ready`,
            },
        });
        expect(info.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(info.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('reports "degraded" when a dependency is down', async () => {
        healthService.checkReadiness.mockResolvedValue(readiness(false));

        const info = await service.getInfo(BASE_URL);

        expect(info.status).toBe('degraded');
        expect(info.response).toBe('Running, but PostgreSQL or Redis is unreachable');
        expect(info.dependencies.redis.status).toBe('down');
    });
});
