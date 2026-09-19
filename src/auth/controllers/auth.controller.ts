import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
    ApiSecurity,
    ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { API_KEY_SECURITY_SCHEME, JWT_SECURITY_SCHEME } from '../../app.constants';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthResponseDto, CurrentUserDto } from '../dto/auth-response.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { JwtOrApiKeyGuard } from '../guards/jwt-or-api-key.guard';
import { AuthService } from '../services/auth.service';

/** Stricter than the global limit to slow down credential-stuffing attempts. */
const CREDENTIAL_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Auth')
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    @Throttle(CREDENTIAL_THROTTLE)
    @ApiOperation({
        summary: 'Register a new account',
        description: 'Creates a user and returns an access token, so the client is signed in immediately.',
    })
    @ApiCreatedResponse({ type: AuthResponseDto })
    @ApiErrorResponse(HttpStatus.BAD_REQUEST)
    @ApiErrorResponse(HttpStatus.CONFLICT, 'An account with this email already exists')
    register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
        return this.authService.register(dto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle(CREDENTIAL_THROTTLE)
    @ApiOperation({ summary: 'Log in', description: 'Exchanges email and password for a JWT access token.' })
    @ApiOkResponse({ type: AuthResponseDto })
    @ApiErrorResponse(HttpStatus.BAD_REQUEST)
    @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Invalid email or password')
    login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
        return this.authService.login(dto);
    }

    @Get('me')
    @UseGuards(JwtOrApiKeyGuard)
    @ApiBearerAuth(JWT_SECURITY_SCHEME)
    @ApiSecurity(API_KEY_SECURITY_SCHEME)
    @ApiOperation({ summary: 'Get the authenticated user', description: 'Handy for checking that a token or API key works.' })
    @ApiOkResponse({ type: CurrentUserDto })
    @ApiErrorResponse(HttpStatus.UNAUTHORIZED)
    me(@CurrentUser() user: AuthenticatedUser): CurrentUserDto {
        return user;
    }
}
