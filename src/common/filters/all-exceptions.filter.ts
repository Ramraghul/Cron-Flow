import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { redactUrl } from '../utils/redact.util';

interface NormalisedError {
    status: number;
    message: string | string[];
}

/** Errors raised by Express middleware such as body-parser (created with `http-errors`). */
interface ExpressHttpError extends Error {
    status: number;
    expose: boolean;
    type?: string;
}

function isExpressHttpError(error: unknown): error is ExpressHttpError {
    const candidate = error as Partial<ExpressHttpError> | null;
    return error instanceof Error && typeof candidate?.status === 'number' && candidate.expose === true;
}

/** Prisma errors that represent client mistakes rather than server faults. */
const PRISMA_ERRORS: Record<string, NormalisedError> = {
    P2002: { status: HttpStatus.CONFLICT, message: 'A resource with the same unique value already exists' },
    P2025: { status: HttpStatus.NOT_FOUND, message: 'Resource not found' },
};

/**
 * Converts every error into the {@link ErrorResponseDto} envelope.
 * 5xx errors are logged with their stack trace; internal details are never sent to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const request = context.getRequest<Request & { id?: unknown }>();
        const response = context.getResponse<Response>();
        const { status, message } = this.normalise(exception);

        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                `${request.method} ${redactUrl(request.originalUrl)} failed: ${exception instanceof Error ? exception.message : String(exception)}`,
                exception instanceof Error ? exception.stack : undefined,
            );
        }

        const body: ErrorResponseDto = {
            statusCode: status,
            error: STATUS_CODES[status] ?? 'Error',
            message,
            path: request.originalUrl,
            method: request.method,
            timestamp: new Date().toISOString(),
            requestId: request.id === undefined ? undefined : String(request.id),
        };

        response.status(status).json(body);
    }

    private normalise(exception: unknown): NormalisedError {
        if (exception instanceof HttpException) {
            const payload = exception.getResponse();
            const message =
                typeof payload === 'string'
                    ? payload
                    : ((payload as { message?: string | string[] }).message ?? exception.message);
            return { status: exception.getStatus(), message };
        }

        if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code in PRISMA_ERRORS) {
            return PRISMA_ERRORS[exception.code];
        }

        // Nest already maps malformed JSON (SyntaxError) to 400; other body-parser failures,
        // such as 413 Payload Too Large, arrive here as http-errors with a safe message.
        if (isExpressHttpError(exception)) {
            return { status: exception.status, message: exception.message };
        }

        return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
    }
}
