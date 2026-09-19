import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsTimeZone,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { trimString } from '../../common/transformers/string.transformers';
import { IsCronExpression } from '../../common/validators/custom-validators';
import { STEP_LIMITS } from '../step-config';
import { WorkflowStepDto } from './workflow-step.dto';

export class CreateWorkflowDto {
    @ApiProperty({ example: 'Nightly data sync', maxLength: 120 })
    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string;

    @ApiPropertyOptional({ example: 'Warms the reporting cache, waits, then triggers the export', maxLength: 500 })
    @IsOptional()
    @Transform(trimString)
    @IsString()
    @MaxLength(500)
    description?: string;

    @ApiProperty({
        example: '0 2 * * *',
        description: 'Standard 5-field cron expression: minute hour day-of-month month day-of-week',
    })
    @Transform(trimString)
    @IsCronExpression()
    cronExpression!: string;

    @ApiPropertyOptional({
        example: 'Europe/London',
        default: 'UTC',
        description: 'IANA timezone the cron expression is evaluated in',
    })
    @IsOptional()
    @IsTimeZone({ message: 'timezone must be a valid IANA timezone, e.g. Europe/London' })
    timezone?: string;

    @ApiProperty({ type: [WorkflowStepDto], minItems: 1, maxItems: STEP_LIMITS.maxSteps })
    @IsArray()
    @ArrayMinSize(1, { message: 'steps must contain at least 1 step' })
    @ArrayMaxSize(STEP_LIMITS.maxSteps)
    @ArrayUnique((step: WorkflowStepDto) => step?.stepOrder, {
        message: 'steps must not contain duplicate stepOrder values',
    })
    @ValidateNested({ each: true })
    @Type(() => WorkflowStepDto)
    steps!: WorkflowStepDto[];
}
