import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

enum StepType { HTTP = 'HTTP', DELAY = 'DELAY' }

class WorkflowStepDto {
    @ApiProperty({ example: 1 })
    @IsNumber()
    stepOrder!: number;

    @ApiProperty({ enum: StepType, example: 'HTTP' })
    @IsEnum(StepType)
    type!: StepType;

    @ApiProperty({
        example: { url: 'https://api.example.com/notify', method: 'POST' },
        description: 'For HTTP: { url, method }. For DELAY: { duration (ms) }',
    })
    @IsNotEmpty()
    config!: any;
}

export class CreateWorkflowDto {
    @ApiProperty({ example: 'Daily Report' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ example: 'Sends a daily report at 8am' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: '0 8 * * *', description: 'Standard cron expression (5-field)' })
    @IsString()
    @IsNotEmpty()
    cronExpression!: string;

    @ApiProperty({ type: [WorkflowStepDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => WorkflowStepDto)
    steps!: WorkflowStepDto[];
}
