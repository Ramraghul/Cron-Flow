import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AppConfig } from '../config/configuration';
import { AuthController } from './controllers/auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Registration, login and the JWT strategy. Re-exports ApiKeysModule so that any module
 * importing AuthModule can use JwtOrApiKeyGuard (which depends on ApiKeysService).
 */
@Module({
    imports: [
        PassportModule,
        ApiKeysModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService<AppConfig, true>) => {
                const { jwtSecret, jwtExpiresInSeconds } = config.get('auth', { infer: true });
                return { secret: jwtSecret, signOptions: { expiresIn: jwtExpiresInSeconds, algorithm: 'HS256' } };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthRepository, JwtStrategy],
    exports: [ApiKeysModule],
})
export class AuthModule {}
