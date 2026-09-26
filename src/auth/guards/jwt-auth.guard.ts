import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DemoAccountsService } from '../../common/services/demo-accounts.service';

/** Accepts `Authorization: Bearer <jwt>` only. Used for account-level routes such as API key management. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(protected readonly demoAccounts: DemoAccountsService) {
        super();
    }

    override async canActivate(context: ExecutionContext): Promise<boolean> {
        const authenticated = (await super.canActivate(context)) as boolean;
        const request = context.switchToHttp().getRequest<Request>();
        this.demoAccounts.assertMayWrite((request.user as AuthenticatedUser).email, request.method);
        return authenticated;
    }

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
