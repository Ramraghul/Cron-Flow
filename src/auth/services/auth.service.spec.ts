import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { buildUser } from '../../../test/utils/factories';
import { createConfigMock, createMock } from '../../../test/utils/mocks';
import { DemoAccountsService } from '../../common/services/demo-accounts.service';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthService } from './auth.service';

const AUTH_CONFIG = { jwtSecret: 'unit-test-secret', jwtExpiresInSeconds: 3600, bcryptSaltRounds: 4 };
const EMAIL = 'ada@example.com';
const DEMO_EMAIL = 'demo@example.com';
const PASSWORD = 'correct-horse-battery-staple';

describe('AuthService', () => {
    let service: AuthService;
    let repository: jest.Mocked<AuthRepository>;
    let jwtService: JwtService;

    beforeEach(async () => {
        repository = createMock<AuthRepository>(['findUserByEmail', 'findUserById', 'createUser']);
        jwtService = new JwtService({ secret: AUTH_CONFIG.jwtSecret, signOptions: { expiresIn: AUTH_CONFIG.jwtExpiresInSeconds } });

        const moduleRef = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: AuthRepository, useValue: repository },
                { provide: JwtService, useValue: jwtService },
                { provide: ConfigService, useValue: createConfigMock({ auth: AUTH_CONFIG }) },
                {
                    provide: DemoAccountsService,
                    useValue: new DemoAccountsService(createConfigMock({ demo: { readOnlyEmails: [DEMO_EMAIL] } })),
                },
            ],
        }).compile();

        service = moduleRef.get(AuthService);
    });

    describe('demoLogin', () => {
        it('issues a token for the configured demo account without credentials', async () => {
            const demoUser = buildUser({ email: DEMO_EMAIL });
            repository.findUserByEmail.mockResolvedValue(demoUser);

            const result = await service.demoLogin();

            expect(repository.findUserByEmail).toHaveBeenCalledWith(DEMO_EMAIL);
            expect(result.user).toEqual({ id: demoUser.id, email: DEMO_EMAIL });
            expect(jwtService.verify(result.accessToken)).toMatchObject({ sub: demoUser.id, email: DEMO_EMAIL });
        });

        it('reports that there is no demo account when the configured one is missing', async () => {
            repository.findUserByEmail.mockResolvedValue(null);

            await expect(service.demoLogin()).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('register', () => {
        it('stores a bcrypt hash — never the password — and signs the user in', async () => {
            repository.findUserByEmail.mockResolvedValue(null);
            repository.createUser.mockImplementation(async (email, passwordHash) => buildUser({ email, password: passwordHash }));

            const result = await service.register({ email: EMAIL, password: PASSWORD });

            const [storedEmail, storedHash] = repository.createUser.mock.calls[0];
            expect(storedEmail).toBe(EMAIL);
            expect(storedHash).not.toContain(PASSWORD);
            await expect(bcrypt.compare(PASSWORD, storedHash)).resolves.toBe(true);

            expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600, user: { id: 'user-1', email: EMAIL } });
            expect(jwtService.verify(result.accessToken)).toMatchObject({ sub: 'user-1', email: EMAIL });
        });

        it('throws 409 when the email is already registered', async () => {
            repository.findUserByEmail.mockResolvedValue(buildUser());

            await expect(service.register({ email: EMAIL, password: PASSWORD })).rejects.toThrow(
                new ConflictException('An account with this email already exists'),
            );
            expect(repository.createUser).not.toHaveBeenCalled();
        });
    });

    describe('login', () => {
        it('returns a signed access token for valid credentials', async () => {
            repository.findUserByEmail.mockResolvedValue(buildUser({ password: await bcrypt.hash(PASSWORD, 4) }));

            const result = await service.login({ email: EMAIL, password: PASSWORD });

            expect(jwtService.verify(result.accessToken)).toMatchObject({ sub: 'user-1' });
        });

        it('rejects a wrong password', async () => {
            repository.findUserByEmail.mockResolvedValue(buildUser({ password: await bcrypt.hash(PASSWORD, 4) }));

            await expect(service.login({ email: EMAIL, password: 'wrong-password' })).rejects.toThrow(
                new UnauthorizedException('Invalid email or password'),
            );
        });

        it('rejects an unknown email with the same message, so accounts cannot be enumerated', async () => {
            repository.findUserByEmail.mockResolvedValue(null);

            await expect(service.login({ email: 'nobody@example.com', password: PASSWORD })).rejects.toThrow(
                new UnauthorizedException('Invalid email or password'),
            );
        });
    });

    describe('validateJwtPayload', () => {
        it('resolves the current user from the token subject', async () => {
            repository.findUserById.mockResolvedValue({ id: 'user-1', email: EMAIL });

            await expect(service.validateJwtPayload({ sub: 'user-1', email: EMAIL })).resolves.toEqual({
                id: 'user-1',
                email: EMAIL,
                authMethod: 'jwt',
            });
            expect(repository.findUserById).toHaveBeenCalledWith('user-1');
        });

        it('rejects tokens for accounts that no longer exist', async () => {
            repository.findUserById.mockResolvedValue(null);

            await expect(service.validateJwtPayload({ sub: 'deleted', email: EMAIL })).rejects.toBeInstanceOf(
                UnauthorizedException,
            );
        });
    });
});
