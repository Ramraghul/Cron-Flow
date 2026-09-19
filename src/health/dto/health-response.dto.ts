import { ApiProperty } from '@nestjs/swagger';

export class LivenessResponseDto {
    @ApiProperty({ enum: ['ok'], example: 'ok' })
    status!: 'ok';

    @ApiProperty({ example: 3600 })
    uptimeSeconds!: number;

    @ApiProperty({ format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    timestamp!: string;
}

export class DependencyCheckDto {
    @ApiProperty({ enum: ['up', 'down'], example: 'up' })
    status!: 'up' | 'down';

    @ApiProperty({ example: 3 })
    latencyMs!: number;
}

export class ReadinessChecksDto {
    @ApiProperty({ type: DependencyCheckDto })
    database!: DependencyCheckDto;

    @ApiProperty({ type: DependencyCheckDto })
    redis!: DependencyCheckDto;
}

export class ReadinessResponseDto {
    @ApiProperty({ enum: ['ok', 'error'], example: 'ok' })
    status!: 'ok' | 'error';

    @ApiProperty({ type: ReadinessChecksDto })
    checks!: ReadinessChecksDto;

    @ApiProperty({ format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    timestamp!: string;
}
