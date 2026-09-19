import { ApiProperty } from '@nestjs/swagger';
import { ExecutionStatus, StepType, TriggerType } from '@prisma/client';
import { PaginationMetaDto } from '../../common/dto/pagination.dto';

export class ExecutionStepResponseDto {
    @ApiProperty({ example: 'cm0xc3d4e0003abcd5f6g7h8i' })
    id!: string;

    @ApiProperty({ example: 1 })
    stepOrder!: number;

    @ApiProperty({ enum: StepType, example: StepType.HTTP })
    type!: StepType;

    @ApiProperty({ enum: ExecutionStatus, example: ExecutionStatus.SUCCESS })
    status!: ExecutionStatus;

    @ApiProperty({ example: 1, description: 'Attempts made, including retries' })
    attempts!: number;

    @ApiProperty({ type: String, nullable: true, example: 'POST https://httpbin.org/post → 200 after 1 attempt(s)' })
    logs!: string | null;

    @ApiProperty({ type: String, nullable: true, example: null })
    errorMessage!: string | null;

    @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-09-14T10:00:00.120Z' })
    startedAt!: Date | null;

    @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-09-14T10:00:00.480Z' })
    completedAt!: Date | null;

    @ApiProperty({ type: Number, nullable: true, example: 360 })
    durationMs!: number | null;
}

export class ExecutionSummaryDto {
    @ApiProperty({ example: 'cm0xb2c3d0002abcd4e5f6g7h' })
    id!: string;

    @ApiProperty({ example: 'cm0x8b1f40001abcdlkj2h3g4' })
    workflowId!: string;

    @ApiProperty({ enum: ExecutionStatus, example: ExecutionStatus.SUCCESS })
    status!: ExecutionStatus;

    @ApiProperty({ enum: TriggerType, example: TriggerType.MANUAL })
    triggerType!: TriggerType;

    @ApiProperty({
        type: String,
        nullable: true,
        example: null,
        description: 'Why the execution failed, if it did',
    })
    errorMessage!: string | null;

    @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-09-14T10:00:00.100Z' })
    startedAt!: Date | null;

    @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-09-14T10:00:02.600Z' })
    completedAt!: Date | null;

    @ApiProperty({ type: Number, nullable: true, example: 2500 })
    durationMs!: number | null;

    @ApiProperty({ type: String, format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    createdAt!: Date;
}

export class ExecutionDetailsDto extends ExecutionSummaryDto {
    @ApiProperty({ example: 'Nightly data sync' })
    workflowName!: string;

    @ApiProperty({
        type: 'object',
        additionalProperties: true,
        nullable: true,
        example: { event: 'deploy.finished' },
        description: 'JSON body received by the webhook trigger',
    })
    triggerPayload!: Record<string, unknown> | null;

    @ApiProperty({ type: [ExecutionStepResponseDto] })
    steps!: ExecutionStepResponseDto[];
}

export class PaginatedExecutionsResponseDto {
    @ApiProperty({ type: [ExecutionSummaryDto] })
    data!: ExecutionSummaryDto[];

    @ApiProperty({ type: PaginationMetaDto })
    meta!: PaginationMetaDto;
}

export class ExecutionAcceptedDto {
    @ApiProperty({ example: 'cm0xb2c3d0002abcd4e5f6g7h' })
    executionId!: string;

    @ApiProperty({ example: 'cm0x8b1f40001abcdlkj2h3g4' })
    workflowId!: string;

    @ApiProperty({ enum: ExecutionStatus, example: ExecutionStatus.PENDING })
    status!: ExecutionStatus;

    @ApiProperty({ enum: TriggerType, example: TriggerType.MANUAL })
    triggerType!: TriggerType;

    @ApiProperty({ example: '/api/v1/executions/cm0xb2c3d0002abcd4e5f6g7h', description: 'Poll this to follow progress' })
    statusUrl!: string;

    @ApiProperty({ type: String, format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    createdAt!: Date;
}
