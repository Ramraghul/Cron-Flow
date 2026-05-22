import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
export declare class AuthService {
    private readonly authRepository;
    private readonly jwtService;
    private readonly logger;
    constructor(authRepository: AuthRepository, jwtService: JwtService);
    register(registerDto: RegisterDto): Promise<{
        id: string;
        email: string;
        token: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        id: string;
        email: string;
        token: string;
    }>;
    validateJwtPayload(payload: JwtPayload): Promise<{
        id: string;
        email: string;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map