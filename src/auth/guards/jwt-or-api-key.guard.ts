import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeysService } from '../../api-keys/services/api-keys.service';
import { API_KEY_HEADER } from '../../app.constants';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Authenticates with an `x-api-key` header when present, otherwise falls back to a JWT bearer token.
 * Used on resource routes so scripts and CI systems can call the API without a login flow.
 */
@Injectable()
export class JwtOrApiKeyGuard extends JwtAuthGuard {
    constructor(private readonly apiKeysService: ApiKeysService) {
        super();
    }

    override async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const apiKey = request.header(API_KEY_HEADER);

        if (apiKey === undefined) {
            return (await super.canActivate(context)) as boolean;
        }

        const user = await this.apiKeysService.authenticate(apiKey);
        if (!user) {
            throw new UnauthorizedException('Invalid API key');
        }

        request.user = user;
        return true;
    }
}
