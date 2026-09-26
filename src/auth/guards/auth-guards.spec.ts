import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { authenticatedUser } from '../../../test/utils/factories';
import { createConfigMock, createMock } from '../../../test/utils/mocks';
import { ApiKeysService } from '../../api-keys/services/api-keys.service';
import { DEMO_READ_ONLY_MESSAGE, DemoAccountsService } from '../../common/services/demo-accounts.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtOrApiKeyGuard } from './jwt-or-api-key.guard';

const DEMO_EMAIL = 'demo@example.com';

function demoAccounts(): DemoAccountsService {
    return new DemoAccountsService(createConfigMock({ demo: { readOnlyEmails: [DEMO_EMAIL] } }));
}

function createContext(headers: Record<string, string> = {}, method = 'GET') {
    const request: {
        headers: Record<string, string>;
        method: string;
        header: (name: string) => string | undefined;
        user?: unknown;
    } = {
        headers,
        method,
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
        guard = new JwtOrApiKeyGuard(apiKeysService, demoAccounts());
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

describe('demo accounts are read-only', () => {
    /** Stands in for Passport: authentication succeeds and attaches the demo user. */
    function mockPassportAuthentication(user: { email: string }) {
        jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockImplementation(((
            context: ExecutionContext,
        ) => {
            context.switchToHttp().getRequest<{ user?: unknown }>().user = { ...authenticatedUser, ...user };
            return true;
        }) as () => boolean);
    }

    it.each([['POST'], ['PATCH'], ['DELETE']])('blocks a bearer token writing with %s', async (method) => {
        mockPassportAuthentication({ email: DEMO_EMAIL });
        const guard = new JwtAuthGuard(demoAccounts());

        await expect(guard.canActivate(createContext({ authorization: 'Bearer demo' }, method).context)).rejects.toThrow(
            DEMO_READ_ONLY_MESSAGE,
        );
    });

    it('lets a demo bearer token read', async () => {
        mockPassportAuthentication({ email: DEMO_EMAIL });
        const guard = new JwtAuthGuard(demoAccounts());

        await expect(guard.canActivate(createContext({ authorization: 'Bearer demo' }, 'GET').context)).resolves.toBe(true);
    });

    it('leaves other accounts free to write', async () => {
        mockPassportAuthentication({ email: 'ada@example.com' });
        const guard = new JwtAuthGuard(demoAccounts());

        await expect(guard.canActivate(createContext({ authorization: 'Bearer real' }, 'POST').context)).resolves.toBe(true);
    });

    it('blocks a demo API key from writing, but not from reading', async () => {
        const apiKeysService = createMock<ApiKeysService>(['authenticate']);
        apiKeysService.authenticate.mockResolvedValue({ ...authenticatedUser, email: DEMO_EMAIL, authMethod: 'api-key' });
        const guard = new JwtOrApiKeyGuard(apiKeysService, demoAccounts());

        await expect(guard.canActivate(createContext({ 'x-api-key': 'cf_demo' }, 'DELETE').context)).rejects.toThrow(
            DEMO_READ_ONLY_MESSAGE,
        );
        await expect(guard.canActivate(createContext({ 'x-api-key': 'cf_demo' }, 'GET').context)).resolves.toBe(true);
    });
});

describe('JwtAuthGuard.handleRequest', () => {
    const guard = new JwtAuthGuard(demoAccounts());

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
