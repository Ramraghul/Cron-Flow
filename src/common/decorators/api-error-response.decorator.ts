import { HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

const DEFAULT_DESCRIPTIONS: Partial<Record<HttpStatus, string>> = {
    [HttpStatus.BAD_REQUEST]: 'Validation failed — `message` lists every problem',
    [HttpStatus.UNAUTHORIZED]: 'Missing, invalid or expired credentials',
    [HttpStatus.NOT_FOUND]: 'Resource not found, or not owned by the caller',
    [HttpStatus.CONFLICT]: 'Request conflicts with the current state of the resource',
    [HttpStatus.TOO_MANY_REQUESTS]: 'Rate limit exceeded — retry after the window resets',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'A dependency (PostgreSQL or Redis) is temporarily unavailable',
};

/** Documents an error response using the shared {@link ErrorResponseDto} schema. */
export function ApiErrorResponse(status: HttpStatus, description?: string): MethodDecorator & ClassDecorator {
    return ApiResponse({
        status,
        description: description ?? DEFAULT_DESCRIPTIONS[status] ?? 'Error',
        type: ErrorResponseDto,
    });
}
