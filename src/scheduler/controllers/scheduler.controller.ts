import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SchedulerService } from '../services/scheduler.service';

@ApiTags('Scheduler')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('scheduler')
export class SchedulerController {
    constructor(private readonly service: SchedulerService) {}

    @Get('jobs')
    @ApiOperation({ summary: 'List all registered cron jobs with their next run time' })
    listJobs() {
        return { jobs: this.service.listJobs() };
    }
}
