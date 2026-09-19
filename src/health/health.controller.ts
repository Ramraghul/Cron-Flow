import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { LivenessResponseDto, ReadinessResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

/** Served at /health/* (no API prefix) so load balancers and orchestrators have a stable path. */
@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get('live')
    @ApiOperation({
        summary: 'Liveness probe',
        description: 'Returns 200 while the process is up. Does not check dependencies — use it to decide when to restart.',
    })
    @ApiOkResponse({ type: LivenessResponseDto })
    live(): LivenessResponseDto {
        return { status: 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() };
    }

    @Get('ready')
    @ApiOperation({
        summary: 'Readiness probe',
        description: 'Checks PostgreSQL and Redis. Returns 503 if either is unreachable — use it to decide whether to route traffic.',
    })
    @ApiOkResponse({ type: ReadinessResponseDto })
    @ApiServiceUnavailableResponse({ type: ReadinessResponseDto, description: 'A dependency is down' })
    async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponseDto> {
        const readiness = await this.healthService.checkReadiness();
        if (readiness.status !== 'ok') {
            response.status(HttpStatus.SERVICE_UNAVAILABLE);
        }
        return readiness;
    }
}
