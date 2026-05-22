import {
    CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly prisma: PrismaService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey: string | undefined = request.headers['x-api-key'];

        if (!apiKey) throw new UnauthorizedException('API key required');

        const prefix = apiKey.substring(0, 8);
        const candidates = await this.prisma.apiKey.findMany({
            where: { keyPrefix: prefix },
            include: { user: true },
        });

        for (const record of candidates) {
            const match = await bcrypt.compare(apiKey, record.keyHash);
            if (match) {
                this.prisma.apiKey
                    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
                    .catch(() => null);
                request.user = { id: record.user.id, email: record.user.email };
                return true;
            }
        }

        throw new UnauthorizedException('Invalid API key');
    }
}
