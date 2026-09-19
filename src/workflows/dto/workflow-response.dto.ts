import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { StepType, WorkflowStatus } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';
import { DelayStepConfigDto, HttpStepConfigDto } from './workflow-step.dto';

export class WorkflowStepResponseDto {
    @ApiProperty({ example: 'cm0xa1b2c0002abcd3e4f5g6h' })
    id!: string;

    @ApiProperty({ example: 1 })
    stepOrder!: number;

    @ApiProperty({ enum: StepType, example: StepType.HTTP })
    type!: StepType;

    @ApiProperty({
        oneOf: [{ $ref: getSchemaPath(HttpStepConfigDto) }, { $ref: getSchemaPath(DelayStepConfigDto) }],
        example: { url: 'https://httpbin.org/post', method: 'POST' },
    })
    config!: Record<string, unknown>;

    @ApiProperty({ example: 3 })
    retryCount!: number;

    @ApiProperty({ example: 30000, description: 'Per-attempt timeout in milliseconds' })
    timeout!: number;
}

class WorkflowBaseDto {
    @ApiProperty({ example: 'cm0x8b1f40001abcdlkj2h3g4' })
    id!: string;

    @ApiProperty({ example: 'Nightly data sync' })
    name!: string;

    @ApiProperty({ type: String, nullable: true, example: 'Warms the reporting cache, waits, then triggers the export' })
    description!: string | null;

    @ApiProperty({ example: '0 2 * * *' })
    cronExpression!: string;

    @ApiProperty({ example: 'UTC' })
    timezone!: string;

    @ApiProperty({ enum: WorkflowStatus, example: WorkflowStatus.ACTIVE })
    status!: WorkflowStatus;

    @ApiProperty({
        type: String,
        format: 'date-time',
        nullable: true,
        example: '2026-09-15T02:00:00.000Z',
        description: 'Next scheduled run; null while the workflow is paused',
    })
    nextRunAt!: Date | null;

    @ApiProperty({ type: String, format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    createdAt!: Date;

    @ApiProperty({ type: String, format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    updatedAt!: Date;
}

export class WorkflowSummaryDto extends WorkflowBaseDto {
    @ApiProperty({ example: 2 })
    stepCount!: number;

    @ApiProperty({ example: 14 })
    executionCount!: number;
}

export class WorkflowResponseDto extends WorkflowBaseDto {
    @ApiProperty({
        example: 'k3Jd9sQ2mVx7LpA0bR4tYw8eZc1uN6hG',
        description: 'Secret for `POST /api/v1/webhooks/{token}/trigger`. Treat it like a password.',
    })
    webhookToken!: string;

    @ApiProperty({ type: [WorkflowStepResponseDto] })
    steps!: WorkflowStepResponseDto[];
}

export class PaginatedWorkflowsResponseDto {
    @ApiProperty({ type: [WorkflowSummaryDto] })
    data!: WorkflowSummaryDto[];

    @ApiProperty({ type: PaginationMetaDto })
    meta!: PaginationMetaDto;
}
