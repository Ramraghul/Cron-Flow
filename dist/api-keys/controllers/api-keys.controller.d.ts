import { ApiKeysService } from '../services/api-keys.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
export declare class ApiKeysController {
    private readonly service;
    constructor(service: ApiKeysService);
    create(req: any, dto: CreateApiKeyDto): Promise<{
        id: string;
        name: string;
        key: string;
        keyPrefix: string;
        createdAt: Date;
        warning: string;
    }>;
    list(req: any): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        keyPrefix: string;
        lastUsedAt: Date | null;
    }[]>;
    revoke(id: string, req: any): Promise<{
        message: string;
    }>;
}
//# sourceMappingURL=api-keys.controller.d.ts.map