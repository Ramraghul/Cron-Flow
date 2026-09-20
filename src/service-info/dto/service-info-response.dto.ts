import { ApiProperty } from '@nestjs/swagger';
import { ReadinessChecksDto } from '../../health/dto/health-response.dto';

export class ServiceLinksDto {
    @ApiProperty({ example: 'https://cron-flow-ramraghuls-projects.vercel.app/docs' })
    swaggerUi!: string;

    @ApiProperty({ example: 'https://cron-flow-ramraghuls-projects.vercel.app/docs-json' })
    openapi!: string;

    @ApiProperty({ example: 'https://cron-flow-ramraghuls-projects.vercel.app/health/live' })
    liveness!: string;

    @ApiProperty({ example: 'https://cron-flow-ramraghuls-projects.vercel.app/health/ready' })
    readiness!: string;
}

export class ServiceInfoResponseDto {
    @ApiProperty({ example: 'CronFlow API' })
    service!: string;

    @ApiProperty({ example: '3.0.0' })
    version!: string;

    @ApiProperty({
        enum: ['ok', 'degraded'],
        example: 'ok',
        description: '`degraded` when PostgreSQL or Redis is unreachable — see `dependencies`.',
    })
    status!: 'ok' | 'degraded';

    @ApiProperty({ example: 'Up and Running', description: 'The status in plain English.' })
    response!: string;

    @ApiProperty({ example: 'production' })
    environment!: string;

    @ApiProperty({ example: 3600, description: 'Seconds this process has been running.' })
    uptimeSeconds!: number;

    @ApiProperty({ format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    timestamp!: string;

    @ApiProperty({ type: ReadinessChecksDto })
    dependencies!: ReadinessChecksDto;

    @ApiProperty({ type: ServiceLinksDto, description: 'Absolute URLs on the host this request arrived on.' })
    links!: ServiceLinksDto;
}
