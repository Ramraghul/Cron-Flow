import { Module } from '@nestjs/common';
import { ApiKeysController } from './controllers/api-keys.controller';
import { ApiKeysRepository } from './repositories/api-keys.repository';
import { ApiKeysService } from './services/api-keys.service';

@Module({
    controllers: [ApiKeysController],
    providers: [ApiKeysService, ApiKeysRepository],
    exports: [ApiKeysService],
})
export class ApiKeysModule {}
