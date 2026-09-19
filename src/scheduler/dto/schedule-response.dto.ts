import { ApiProperty } from '@nestjs/swagger';

export class ScheduleDto {
    @ApiProperty({ example: 'cm0x8b1f40001abcdlkj2h3g4' })
    workflowId!: string;

    @ApiProperty({ example: 'Nightly data sync' })
    workflowName!: string;

    @ApiProperty({ example: '0 2 * * *' })
    cronExpression!: string;

    @ApiProperty({ example: 'UTC' })
    timezone!: string;

    @ApiProperty({
        example: true,
        description: 'Whether Redis holds a schedule for this workflow. False indicates drift, repaired on the next API start.',
    })
    registered!: boolean;

    @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-09-15T02:00:00.000Z' })
    nextRunAt!: Date | null;
}

export class ScheduleListResponseDto {
    @ApiProperty({ type: [ScheduleDto] })
    data!: ScheduleDto[];
}
