import { PrismaService } from '../../database/prisma.service';
export declare class ApiKeysRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(data: {
        userId: string;
        name: string;
        keyHash: string;
        keyPrefix: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        userId: string;
        keyHash: string;
        keyPrefix: string;
        lastUsedAt: Date | null;
    }>;
    findByUserId(userId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        keyPrefix: string;
        lastUsedAt: Date | null;
    }[]>;
    findById(id: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        userId: string;
        keyHash: string;
        keyPrefix: string;
        lastUsedAt: Date | null;
    } | null>;
    delete(id: string, userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
//# sourceMappingURL=api-keys.repository.d.ts.map