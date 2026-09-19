import { ArgumentsHost, BadRequestException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface FakeRequest {
    method: string;
    originalUrl: string;
    id?: string;
}

function createHost(request: Partial<FakeRequest> = {}) {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const fullRequest: FakeRequest = { method: 'POST', originalUrl: '/api/v1/workflows', id: 'req-123', ...request };
    const host = {
        switchToHttp: () => ({ getRequest: () => fullRequest, getResponse: () => response }),
    } as unknown as ArgumentsHost;

    return {
        host,
        response,
        body: (): ErrorResponseDto => response.json.mock.calls[0][0],
    };
}

describe('AllExceptionsFilter', () => {
    let filter: AllExceptionsFilter;
    let logError: jest.SpyInstance;

    beforeEach(() => {
        filter = new AllExceptionsFilter();
        logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    it('renders an HttpException with its status, message and request context', () => {
        const { host, response, body } = createHost();

        filter.catch(new NotFoundException('Workflow w1 not found'), host);

        expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(body()).toEqual({
            statusCode: 404,
            error: 'Not Found',
            message: 'Workflow w1 not found',
            path: '/api/v1/workflows',
            method: 'POST',
            timestamp: expect.any(String),
            requestId: 'req-123',
        });
        expect(logError).not.toHaveBeenCalled();
    });

    it('keeps every validation message from a BadRequestException', () => {
        const { host, body } = createHost();
        const messages = ['name should not be empty', 'steps must contain at least 1 step'];

        filter.catch(new BadRequestException(messages), host);

        expect(body()).toMatchObject({ statusCode: 400, error: 'Bad Request', message: messages });
    });

    it.each([
        ['P2002', HttpStatus.CONFLICT],
        ['P2025', HttpStatus.NOT_FOUND],
    ])('maps Prisma error %s to HTTP %i', (code, status) => {
        const { host, response } = createHost();
        const error = new Prisma.PrismaClientKnownRequestError('database error', { code, clientVersion: '6.19.3' });

        filter.catch(error, host);

        expect(response.status).toHaveBeenCalledWith(status);
    });

    it('passes through client errors raised by body-parser, such as 413 Payload Too Large', () => {
        const { host, response, body } = createHost();
        const tooLarge = Object.assign(new Error('request entity too large'), {
            status: 413,
            expose: true,
            type: 'entity.too.large',
        });

        filter.catch(tooLarge, host);

        expect(response.status).toHaveBeenCalledWith(413);
        expect(body()).toMatchObject({ statusCode: 413, error: 'Payload Too Large', message: 'request entity too large' });
        expect(logError).not.toHaveBeenCalled();
    });

    it('hides the details of unexpected errors from the client but logs them', () => {
        const { host, response, body } = createHost();

        filter.catch(new Error('connect ECONNREFUSED 10.0.0.12:5432'), host);

        expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(body().message).toBe('Internal server error');
        expect(logError).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'), expect.any(String));
    });

    it('treats unknown Prisma error codes as internal errors', () => {
        const { host, response } = createHost();

        filter.catch(new Prisma.PrismaClientKnownRequestError('deadlock', { code: 'P2034', clientVersion: '6.19.3' }), host);

        expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('redacts webhook tokens when logging server errors', () => {
        const { host } = createHost({ originalUrl: '/api/v1/webhooks/super-secret-token/trigger' });

        filter.catch(new Error('boom'), host);

        const [message] = logError.mock.calls[0];
        expect(message).toContain('/api/v1/webhooks/[REDACTED]/trigger');
        expect(message).not.toContain('super-secret-token');
    });
});
