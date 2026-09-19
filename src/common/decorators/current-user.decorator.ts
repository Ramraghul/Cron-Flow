import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/** Injects the authenticated principal. Only valid on routes protected by an auth guard. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user as AuthenticatedUser;
});
