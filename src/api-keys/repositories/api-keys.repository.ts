import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ApiKeysRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(data: { userId: string; name: string; keyHash: string; keyPrefix: string; }) {
        return this.prisma.apiKey.create({ data });
    }

    async findByUserId(userId: string) {
        return this.prisma.apiKey.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
        });
    }

    async findById(id: string, userId: string) {
        return this.prisma.apiKey.findFirst({ where: { id, userId } });
    }

    async delete(id: string, userId: string) {
        return this.prisma.apiKey.deleteMany({ where: { id, userId } });
    }
}
