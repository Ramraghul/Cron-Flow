import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Accepts `Authorization: Bearer <jwt>` only. Used for account-level routes such as API key management. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    override handleRequest<TUser>(error: unknown, user: TUser | false, info: unknown): TUser {
        if (error) {
            throw error;
        }
        if (!user) {
            const expired = info instanceof Error && info.name === 'TokenExpiredError';
            throw new UnauthorizedException(expired ? 'Access token has expired' : 'Missing or invalid bearer token');
        }
        return user;
    }
}
