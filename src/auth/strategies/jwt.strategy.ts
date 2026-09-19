import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AppConfig } from '../../config/configuration';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        config: ConfigService<AppConfig, true>,
        private readonly authService: AuthService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get('auth', { infer: true }).jwtSecret,
            algorithms: ['HS256'],
        });
    }

    validate(payload: JwtPayload): Promise<AuthenticatedUser> {
        return this.authService.validateJwtPayload(payload);
    }
}
