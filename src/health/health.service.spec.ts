import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queues/services/queue.service';
import { HealthService, PROBE_TIMEOUT_MS } from './health.service';

describe('HealthService', () => {
    let databasePing: jest.Mock<Promise<void>, []>;
    let redisPing: jest.Mock<Promise<void>, []>;
    let service: HealthService;

    beforeEach(() => {
        databasePing = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
        redisPing = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
        service = new HealthService({ ping: databasePing } as unknown as PrismaService, { ping: redisPing } as unknown as QueueService);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('is ready when PostgreSQL and Redis both respond', async () => {
        const readiness = await service.checkReadiness();

        expect(readiness).toEqual({
            status: 'ok',
            checks: {
                database: { status: 'up', latencyMs: expect.any(Number) },
                redis: { status: 'up', latencyMs: expect.any(Number) },
            },
            timestamp: expect.any(String),
        });
    });

    it('is not ready when a dependency fails, without leaking error details', async () => {
        redisPing.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.7:6379'));

        const readiness = await service.checkReadiness();

        expect(readiness.status).toBe('error');
        expect(readiness.checks).toMatchObject({ database: { status: 'up' }, redis: { status: 'down' } });
        expect(JSON.stringify(readiness)).not.toContain('10.0.0.7');
    });

    it('marks a probe that hangs as down after the timeout', async () => {
        jest.useFakeTimers();
        databasePing.mockReturnValue(new Promise<void>(() => undefined));

        const pending = service.checkReadiness();
        await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

        await expect(pending).resolves.toMatchObject({ status: 'error', checks: { database: { status: 'down' } } });
    });
});
