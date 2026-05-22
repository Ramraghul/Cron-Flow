import { ApiKeysRepository } from '../repositories/api-keys.repository';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
export declare class ApiKeysService {
    private readonly repo;
    constructor(repo: ApiKeysRepository);
    create(userId: string, dto: CreateApiKeyDto): Promise<{
        id: string;
        name: string;
        key: string;
        keyPrefix: string;
        createdAt: Date;
        warning: string;
    }>;
    list(userId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        keyPrefix: string;
        lastUsedAt: Date | null;
    }[]>;
    revoke(id: string, userId: string): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=api-keys.service.d.ts.map