import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Envelope returned for every non-2xx response. */
export class ErrorResponseDto {
    @ApiProperty({ example: 400 })
    statusCode!: number;

    @ApiProperty({ example: 'Bad Request', description: 'HTTP reason phrase' })
    error!: string;

    @ApiProperty({
        description: 'A single message, or one message per failed validation rule',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        example: ['cronExpression must be a valid 5-field cron expression (minute hour day-of-month month day-of-week)'],
    })
    message!: string | string[];

    @ApiProperty({ example: '/api/v1/workflows' })
    path!: string;

    @ApiProperty({ example: 'POST' })
    method!: string;

    @ApiProperty({ example: '2026-09-14T10:00:00.000Z', format: 'date-time' })
    timestamp!: string;

    @ApiPropertyOptional({
        example: '5f0e7c1a-3b8e-4d7a-9c2f-1e6b8a4d2c10',
        description: 'Correlates this response with server logs (also sent as the X-Request-Id header)',
    })
    requestId?: string;
}
