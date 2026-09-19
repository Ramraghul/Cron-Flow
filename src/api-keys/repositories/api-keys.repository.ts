import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** Columns safe to return to clients — never the hash. */
const publicApiKeyFields = {
    id: true,
    name: true,
    keyPrefix: true,
    lastUsedAt: true,
    createdAt: true,
} satisfies Prisma.ApiKeySelect;

const apiKeyAuthFields = {
    id: true,
    lastUsedAt: true,
    user: { select: { id: true, email: true } },
} satisfies Prisma.ApiKeySelect;

export type ApiKeyRecord = Prisma.ApiKeyGetPayload<{ select: typeof publicApiKeyFields }>;
export type ApiKeyWithOwner = Prisma.ApiKeyGetPayload<{ select: typeof apiKeyAuthFields }>;

@Injectable()
export class ApiKeysRepository {
    constructor(private readonly prisma: PrismaService) {}

    create(data: { userId: string; name: string; keyHash: string; keyPrefix: string }): Promise<ApiKeyRecord> {
        return this.prisma.apiKey.create({ data, select: publicApiKeyFields });
    }

    findAllForUser(userId: string): Promise<ApiKeyRecord[]> {
        return this.prisma.apiKey.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: publicApiKeyFields,
        });
    }

    findByHash(keyHash: string): Promise<ApiKeyWithOwner | null> {
        return this.prisma.apiKey.findUnique({ where: { keyHash }, select: apiKeyAuthFields });
    }

    async touchLastUsed(id: string, usedAt: Date): Promise<void> {
        await this.prisma.apiKey.update({ where: { id }, data: { lastUsedAt: usedAt } });
    }

    /** Deletes the key only if it belongs to `userId`. Returns whether a key was deleted. */
    async deleteForUser(id: string, userId: string): Promise<boolean> {
        const { count } = await this.prisma.apiKey.deleteMany({ where: { id, userId } });
        return count > 0;
    }
}
