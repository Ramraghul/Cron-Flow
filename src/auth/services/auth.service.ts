import {
    Injectable,
    BadRequestException,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly authRepository: AuthRepository,
        private readonly jwtService: JwtService,
    ) {}

    async register(registerDto: RegisterDto) {
        const { email, password } = registerDto;

        // Check if user already exists
        const existingUser = await this.authRepository.findUserByEmail(email);
        if (existingUser) {
            throw new BadRequestException('User already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await this.authRepository.createUser(email, hashedPassword);

        // Generate JWT token
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const token = this.jwtService.sign(payload);

        this.logger.log(`User ${email} registered successfully`);

        return {
            id: user.id,
            email: user.email,
            token,
        };
    }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        // Find user
        const user = await this.authRepository.findUserByEmail(email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Generate JWT token
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
        };

        const token = this.jwtService.sign(payload);

        this.logger.log(`User ${email} logged in successfully`);

        return {
            id: user.id,
            email: user.email,
            token,
        };
    }

    async validateJwtPayload(payload: JwtPayload) {
        const user = await this.authRepository.findUserByEmail(payload.email);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return {
            id: user.id,
            email: user.email,
        };
    }
}
