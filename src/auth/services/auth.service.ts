import { ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DemoAccountsService } from '../../common/services/demo-accounts.service';
import { AppConfig } from '../../config/configuration';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly authConfig: AppConfig['auth'];
    /** Compared against when an email is unknown, so response time doesn't reveal which accounts exist. */
    private dummyPasswordHash?: Promise<string>;

    constructor(
        private readonly authRepository: AuthRepository,
        private readonly jwtService: JwtService,
        private readonly demoAccounts: DemoAccountsService,
        config: ConfigService<AppConfig, true>,
    ) {
        this.authConfig = config.get('auth', { infer: true });
    }

    async register(dto: RegisterDto): Promise<AuthResponseDto> {
        const existingUser = await this.authRepository.findUserByEmail(dto.email);
        if (existingUser) {
            throw new ConflictException('An account with this email already exists');
        }

        const passwordHash = await bcrypt.hash(dto.password, this.authConfig.bcryptSaltRounds);
        const user = await this.authRepository.createUser(dto.email, passwordHash);
        this.logger.log(`Registered user ${user.id}`);

        return this.issueAccessToken(user);
    }

    async login(dto: LoginDto): Promise<AuthResponseDto> {
        const user = await this.authRepository.findUserByEmail(dto.email);
        const hashToCompare = user?.password ?? (await this.getDummyPasswordHash());
        const passwordMatches = await bcrypt.compare(dto.password, hashToCompare);

        // One message for both cases, so the endpoint cannot be used to discover registered emails.
        if (!user || !passwordMatches) {
            throw new UnauthorizedException('Invalid email or password');
        }

        return this.issueAccessToken(user);
    }

    async validateJwtPayload(payload: JwtPayload): Promise<AuthenticatedUser> {
        const user = await this.authRepository.findUserById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('The account for this token no longer exists');
        }
        return { id: user.id, email: user.email, authMethod: 'jwt' };
    }

    /** Signs in to the read-only demo account, so the dashboard needs no credentials of its own. */
    async demoLogin(): Promise<AuthResponseDto> {
        const email = this.demoAccounts.demoEmail;
        const user = email ? await this.authRepository.findUserByEmail(email) : null;
        if (!user) {
            throw new NotFoundException('This server has no demo account');
        }
        return this.issueAccessToken(user);
    }

    private issueAccessToken(user: Pick<User, 'id' | 'email'>): AuthResponseDto {
        const payload: JwtPayload = { sub: user.id, email: user.email };
        return {
            accessToken: this.jwtService.sign(payload),
            tokenType: 'Bearer',
            expiresIn: this.authConfig.jwtExpiresInSeconds,
            user: { id: user.id, email: user.email },
        };
    }

    private getDummyPasswordHash(): Promise<string> {
        this.dummyPasswordHash ??= bcrypt.hash(randomUUID(), this.authConfig.bcryptSaltRounds);
        return this.dummyPasswordHash;
    }
}
