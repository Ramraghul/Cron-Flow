import { Injectable, Logger } from '@nestjs/common';
import { withTimeout } from '../common/utils/async.util';
import { errorMessage } from '../common/utils/error.util';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queues/services/queue.service';
import { DependencyCheckDto, ReadinessResponseDto } from './dto/health-response.dto';

export const PROBE_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
    private readonly logger = new Logger(HealthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly queueService: QueueService,
    ) {}

    async checkReadiness(): Promise<ReadinessResponseDto> {
        const [database, redis] = await Promise.all([
            this.probe('database', () => this.prisma.ping()),
            this.probe('redis', () => this.queueService.ping()),
        ]);

        return {
            status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'error',
            checks: { database, redis },
            timestamp: new Date().toISOString(),
        };
    }

    private async probe(name: string, check: () => Promise<void>): Promise<DependencyCheckDto> {
        const startedAt = performance.now();
        const elapsedMs = () => Math.round(performance.now() - startedAt);

        try {
            await withTimeout(check(), PROBE_TIMEOUT_MS, `timed out after ${PROBE_TIMEOUT_MS}ms`);
            return { status: 'up', latencyMs: elapsedMs() };
        } catch (error) {
            // Details go to the logs only: this endpoint is public and errors can reveal internal hosts.
            this.logger.warn(`Readiness probe "${name}" failed: ${errorMessage(error)}`);
            return { status: 'down', latencyMs: elapsedMs() };
        }
    }
}
