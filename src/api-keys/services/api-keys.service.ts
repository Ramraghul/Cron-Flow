import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ApiKeysRepository } from '../repositories/api-keys.repository';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
    constructor(private readonly repo: ApiKeysRepository) {}

    async create(userId: string, dto: CreateApiKeyDto) {
        const rawKey = `cf_${uuidv4().replace(/-/g, '')}`;
        const keyPrefix = rawKey.substring(0, 8);
        const keyHash = await bcrypt.hash(rawKey, 10);
        const record = await this.repo.create({ userId, name: dto.name, keyHash, keyPrefix });
        return {
            id: record.id,
            name: record.name,
            key: rawKey,
            keyPrefix: record.keyPrefix,
            createdAt: record.createdAt,
            warning: 'Save this key — it will not be shown again.',
        };
    }

    async list(userId: string) {
        return this.repo.findByUserId(userId);
    }

    async revoke(id: string, userId: string) {
        const key = await this.repo.findById(id, userId);
        if (!key) throw new NotFoundException('API key not found');
        await this.repo.delete(id, userId);
        return { message: 'API key revoked successfully' };
    }
}
