import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { authenticatedUser } from '../../../test/utils/factories';
import { createMock } from '../../../test/utils/mocks';
import { ApiKeysService } from '../../api-keys/services/api-keys.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtOrApiKeyGuard } from './jwt-or-api-key.guard';

function createContext(headers: Record<string, string> = {}) {
    const request: { headers: Record<string, string>; header: (name: string) => string | undefined; user?: unknown } = {
        headers,
        header: (name) => headers[name.toLowerCase()],
    };
    const context = {
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    } as unknown as ExecutionContext;
    return { context, request };
}

describe('JwtOrApiKeyGuard', () => {
    let apiKeysService: jest.Mocked<ApiKeysService>;
    let guard: JwtOrApiKeyGuard;
    let jwtCanActivate: jest.SpyInstance;

    beforeEach(() => {
        apiKeysService = createMock<ApiKeysService>(['authenticate']);
        guard = new JwtOrApiKeyGuard(apiKeysService);
        jwtCanActivate = jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    });

    it('authenticates with a valid API key without consulting the JWT strategy', async () => {
        const apiKeyUser = { ...authenticatedUser, authMethod: 'api-key' as const };
        apiKeysService.authenticate.mockResolvedValue(apiKeyUser);
        const { context, request } = createContext({ 'x-api-key': 'cf_valid' });

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(apiKeysService.authenticate).toHaveBeenCalledWith('cf_valid');
        expect(request.user).toEqual(apiKeyUser);
        expect(jwtCanActivate).not.toHaveBeenCalled();
    });

    it('rejects an invalid API key rather than falling back to a bearer token', async () => {
        apiKeysService.authenticate.mockResolvedValue(null);
        const { context } = createContext({ 'x-api-key': 'cf_revoked', authorization: 'Bearer valid-jwt' });

        await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException('Invalid API key'));
        expect(jwtCanActivate).not.toHaveBeenCalled();
    });

    it('falls back to JWT authentication when no API key is sent', async () => {
        const { context } = createContext({ authorization: 'Bearer valid-jwt' });

        await expect(guard.canActivate(context)).resolves.toBe(true);

        expect(jwtCanActivate).toHaveBeenCalledWith(context);
        expect(apiKeysService.authenticate).not.toHaveBeenCalled();
    });
});

describe('JwtAuthGuard.handleRequest', () => {
    const guard = new JwtAuthGuard();

    it('returns the authenticated user', () => {
        expect(guard.handleRequest(null, authenticatedUser, undefined)).toBe(authenticatedUser);
    });

    it('tells the client when the token has expired', () => {
        const expired = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });

        expect(() => guard.handleRequest(null, false, expired)).toThrow(new UnauthorizedException('Access token has expired'));
    });

    it('rejects a missing or malformed token', () => {
        expect(() => guard.handleRequest(null, false, new Error('No auth token'))).toThrow(
            new UnauthorizedException('Missing or invalid bearer token'),
        );
    });

    it('rethrows errors raised by the strategy', () => {
        const strategyError = new UnauthorizedException('The account for this token no longer exists');

        expect(() => guard.handleRequest(strategyError, false, undefined)).toThrow(strategyError);
    });
});
