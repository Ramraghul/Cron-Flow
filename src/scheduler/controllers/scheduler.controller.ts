import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { API_KEY_SECURITY_SCHEME, JWT_SECURITY_SCHEME } from '../../app.constants';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ScheduleListResponseDto } from '../dto/schedule-response.dto';
import { SchedulerService } from '../services/scheduler.service';

@ApiTags('Scheduler')
@ApiBearerAuth(JWT_SECURITY_SCHEME)
@ApiSecurity(API_KEY_SECURITY_SCHEME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED)
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@UseGuards(JwtOrApiKeyGuard)
@Controller('scheduler')
export class SchedulerController {
    constructor(private readonly schedulerService: SchedulerService) {}

    @Get('jobs')
    @ApiOperation({
        summary: 'List cron schedules',
        description: 'Live scheduler state from Redis for each of your ACTIVE workflows, including the next run time.',
    })
    @ApiOkResponse({ type: ScheduleListResponseDto })
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE)
    async list(@CurrentUser() user: AuthenticatedUser): Promise<ScheduleListResponseDto> {
        return { data: await this.schedulerService.listForUser(user.id) };
    }
}
