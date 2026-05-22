import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ApiKeysController } from './controllers/api-keys.controller';
import { ApiKeysService } from './services/api-keys.service';
import { ApiKeysRepository } from './repositories/api-keys.repository';

@Module({
    imports: [DatabaseModule],
    controllers: [ApiKeysController],
    providers: [ApiKeysService, ApiKeysRepository],
    exports: [ApiKeysService],
})
export class ApiKeysModule {}
