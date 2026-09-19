import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueuesModule } from '../queues/queues.module';
import { SchedulerController } from './controllers/scheduler.controller';
import { SchedulerService } from './services/scheduler.service';

@Module({
    imports: [AuthModule, QueuesModule],
    controllers: [SchedulerController],
    providers: [SchedulerService],
    exports: [SchedulerService],
})
export class SchedulerModule {}
