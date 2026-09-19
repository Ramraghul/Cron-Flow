import { ApiProperty } from '@nestjs/swagger';
import { ExecutionStatus, TriggerType, WorkflowStatus } from '@prisma/client';
import { ExecutionSummaryDto } from '../../executions/dto/execution-response.dto';

export class WorkflowCountsDto {
    @ApiProperty({ example: 5 })
    total!: number;

    @ApiProperty({ example: 4 })
    active!: number;

    @ApiProperty({ example: 1 })
    paused!: number;
}

export class ExecutionStatsDto {
    @ApiProperty({ example: 42 })
    total!: number;

    @ApiProperty({
        type: 'object',
        additionalProperties: { type: 'integer' },
        example: { PENDING: 0, RUNNING: 1, SUCCESS: 38, FAILED: 3, SKIPPED: 0 },
    })
    byStatus!: Record<ExecutionStatus, number>;

    @ApiProperty({
        type: 'object',
        additionalProperties: { type: 'integer' },
        example: { MANUAL: 5, CRON: 35, WEBHOOK: 2 },
    })
    byTrigger!: Record<TriggerType, number>;

    @ApiProperty({
        type: Number,
        nullable: true,
        example: 92.7,
        description: 'SUCCESS ÷ (SUCCESS + FAILED) × 100, one decimal place. Null until an execution finishes.',
    })
    successRatePercent!: number | null;

    @ApiProperty({ type: Number, nullable: true, example: 1840, description: 'Mean duration of finished executions' })
    avgDurationMs!: number | null;
}

export class RecentExecutionDto extends ExecutionSummaryDto {
    @ApiProperty({ example: 'Nightly data sync' })
    workflowName!: string;
}

export class MetricsSummaryDto {
    @ApiProperty({ type: String, format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    generatedAt!: Date;

    @ApiProperty({ type: WorkflowCountsDto })
    workflows!: WorkflowCountsDto;

    @ApiProperty({ type: ExecutionStatsDto })
    executions!: ExecutionStatsDto;

    @ApiProperty({ type: [RecentExecutionDto] })
    recentExecutions!: RecentExecutionDto[];
}

export class WorkflowMetricsDto {
    @ApiProperty({ example: 'cm0x8b1f40001abcdlkj2h3g4' })
    workflowId!: string;

    @ApiProperty({ example: 'Nightly data sync' })
    name!: string;

    @ApiProperty({ enum: WorkflowStatus, example: WorkflowStatus.ACTIVE })
    status!: WorkflowStatus;

    @ApiProperty({ example: '0 2 * * *' })
    cronExpression!: string;

    @ApiProperty({ example: 'UTC' })
    timezone!: string;

    @ApiProperty({ type: ExecutionStatsDto })
    executions!: ExecutionStatsDto;

    @ApiProperty({ example: 30 })
    executionsLast30Days!: number;
}
