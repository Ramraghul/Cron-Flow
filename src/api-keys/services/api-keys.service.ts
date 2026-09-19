import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { errorMessage } from '../../common/utils/error.util';
import { API_KEY_MAX_LENGTH, API_KEY_PREFIX, apiKeyDisplayPrefix, generateApiKey, hashApiKey } from '../api-key.util';
import { ApiKeyDto, CreatedApiKeyDto } from '../dto/api-key-response.dto';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { ApiKeysRepository } from '../repositories/api-keys.repository';

/** `lastUsedAt` is refreshed at most this often per key, to avoid a database write on every request. */
export const LAST_USED_WRITE_INTERVAL_MS = 60_000;

@Injectable()
export class ApiKeysService {
    private readonly logger = new Logger(ApiKeysService.name);

    constructor(private readonly repository: ApiKeysRepository) {}

    async create(userId: string, dto: CreateApiKeyDto): Promise<CreatedApiKeyDto> {
        const rawKey = generateApiKey();
        const record = await this.repository.create({
            userId,
            name: dto.name,
            keyHash: hashApiKey(rawKey),
            keyPrefix: apiKeyDisplayPrefix(rawKey),
        });

        this.logger.log(`API key ${record.id} created for user ${userId}`);
        return { ...record, key: rawKey };
    }

    list(userId: string): Promise<ApiKeyDto[]> {
        return this.repository.findAllForUser(userId);
    }

    async revoke(userId: string, apiKeyId: string): Promise<void> {
        const deleted = await this.repository.deleteForUser(apiKeyId, userId);
        if (!deleted) {
            throw new NotFoundException(`API key ${apiKeyId} not found`);
        }
        this.logger.log(`API key ${apiKeyId} revoked by user ${userId}`);
    }

    /** Resolves the owner of a raw API key, or returns `null` if the key is unknown or malformed. */
    async authenticate(rawKey: string): Promise<AuthenticatedUser | null> {
        if (!rawKey.startsWith(API_KEY_PREFIX) || rawKey.length > API_KEY_MAX_LENGTH) {
            return null;
        }

        const record = await this.repository.findByHash(hashApiKey(rawKey));
        if (!record) {
            return null;
        }

        this.recordUsage(record.id, record.lastUsedAt);
        return { id: record.user.id, email: record.user.email, authMethod: 'api-key' };
    }

    /** Fire-and-forget: a failed usage timestamp must never fail the request it belongs to. */
    private recordUsage(apiKeyId: string, lastUsedAt: Date | null): void {
        const now = new Date();
        if (lastUsedAt && now.getTime() - lastUsedAt.getTime() < LAST_USED_WRITE_INTERVAL_MS) {
            return;
        }

        this.repository
            .touchLastUsed(apiKeyId, now)
            .catch((error: unknown) =>
                this.logger.warn(`Could not record usage for API key ${apiKeyId}: ${errorMessage(error)}`),
            );
    }
}
