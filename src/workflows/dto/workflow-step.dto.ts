import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { StepType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDefined, IsEnum, IsInt, IsObject, IsOptional, IsUrl, Max, Min, ValidateNested } from 'class-validator';
import { IsStringRecord } from '../../common/validators/custom-validators';
import { HttpMethod, STEP_DEFAULTS, STEP_LIMITS } from '../step-config';

export class HttpStepConfigDto {
    @ApiProperty({ example: 'https://httpbin.org/post', description: 'Absolute http(s) URL to call' })
    @IsUrl(
        { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
        { message: 'url must be an absolute http(s) URL' },
    )
    url!: string;

    @ApiPropertyOptional({ enum: HttpMethod, default: HttpMethod.GET })
    @IsOptional()
    @IsEnum(HttpMethod)
    method?: HttpMethod;

    @ApiPropertyOptional({
        type: 'object',
        additionalProperties: { type: 'string' },
        example: { Authorization: 'Bearer <token>' },
        description: 'Request headers',
    })
    @IsOptional()
    @IsStringRecord()
    headers?: Record<string, string>;

    @ApiPropertyOptional({
        description: 'JSON body, sent with POST, PUT, PATCH and DELETE requests',
        example: { event: 'nightly-sync' },
    })
    @IsOptional()
    body?: unknown;
}

export class DelayStepConfigDto {
    @ApiProperty({
        example: 2000,
        minimum: 1,
        maximum: STEP_LIMITS.maxDelayMs,
        description: 'How long to pause, in milliseconds',
    })
    @IsInt()
    @Min(1)
    @Max(STEP_LIMITS.maxDelayMs)
    duration!: number;
}

export class WorkflowStepDto {
    @ApiProperty({
        example: 1,
        minimum: 1,
        maximum: STEP_LIMITS.maxStepOrder,
        description: 'Execution order. Must be unique within the workflow.',
    })
    @IsInt()
    @Min(1)
    @Max(STEP_LIMITS.maxStepOrder)
    stepOrder!: number;

    @ApiProperty({ enum: StepType, example: StepType.HTTP })
    @IsEnum(StepType)
    type!: StepType;

    @ApiProperty({
        description: 'Shape depends on `type` — HTTP: `{ url, method?, headers?, body? }` · DELAY: `{ duration }`',
        oneOf: [{ $ref: getSchemaPath(HttpStepConfigDto) }, { $ref: getSchemaPath(DelayStepConfigDto) }],
    })
    @IsDefined()
    @IsObject()
    @ValidateNested()
    // Pick the config class from the sibling `type` field, so each step type gets its own rules.
    @Type((options) => (options?.object.type === StepType.DELAY ? DelayStepConfigDto : HttpStepConfigDto))
    config!: HttpStepConfigDto | DelayStepConfigDto;

    @ApiPropertyOptional({
        minimum: 0,
        maximum: STEP_LIMITS.maxRetries,
        default: STEP_DEFAULTS.retryCount,
        description: 'HTTP steps: retries after a transient failure (exponential backoff starting at 1s)',
    })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(STEP_LIMITS.maxRetries)
    retryCount?: number;

    @ApiPropertyOptional({
        minimum: STEP_LIMITS.minTimeoutMs,
        maximum: STEP_LIMITS.maxTimeoutMs,
        default: STEP_DEFAULTS.timeoutMs,
        description: 'HTTP steps: per-attempt timeout in milliseconds',
    })
    @IsOptional()
    @IsInt()
    @Min(STEP_LIMITS.minTimeoutMs)
    @Max(STEP_LIMITS.maxTimeoutMs)
    timeout?: number;
}
