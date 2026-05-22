import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MetricsController } from './controllers/metrics.controller';
import { MetricsService } from './services/metrics.service';

@Module({
    imports: [DatabaseModule],
    controllers: [MetricsController],
    providers: [MetricsService],
    exports: [MetricsService],
})
export class MetricsModule {}
