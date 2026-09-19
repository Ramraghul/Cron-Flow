import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetricsController } from './controllers/metrics.controller';
import { MetricsService } from './services/metrics.service';

@Module({
    imports: [AuthModule],
    controllers: [MetricsController],
    providers: [MetricsService],
})
export class MetricsModule {}
