import { Module } from '@nestjs/common';
import { HealthModule } from '../health/health.module';
import { ServiceInfoController } from './controllers/service-info.controller';
import { ServiceInfoService } from './services/service-info.service';

@Module({
    imports: [HealthModule],
    controllers: [ServiceInfoController],
    providers: [ServiceInfoService],
})
export class ServiceInfoModule {}
