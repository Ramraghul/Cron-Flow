import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QueuesModule } from '../queues/queues.module';
import { SchedulerService } from './services/scheduler.service';
import { SchedulerController } from './controllers/scheduler.controller';

@Module({
    imports: [DatabaseModule, QueuesModule],
    controllers: [SchedulerController],
    providers: [SchedulerService],
    exports: [SchedulerService],
})
export class SchedulerModule {}
