import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
}
//# sourceMappingURL=auth.controller.d.ts.map