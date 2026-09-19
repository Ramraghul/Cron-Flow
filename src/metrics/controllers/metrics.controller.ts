import { Controller, Get, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { API_KEY_SECURITY_SCHEME, JWT_SECURITY_SCHEME } from '../../app.constants';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MetricsSummaryDto, WorkflowMetricsDto } from '../dto/metrics-response.dto';
import { MetricsService } from '../services/metrics.service';

@ApiTags('Metrics')
@ApiBearerAuth(JWT_SECURITY_SCHEME)
@ApiSecurity(API_KEY_SECURITY_SCHEME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED)
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@UseGuards(JwtOrApiKeyGuard)
@Controller('metrics')
export class MetricsController {
    constructor(private readonly metricsService: MetricsService) {}

    @Get()
    @ApiOperation({
        summary: 'Dashboard metrics',
        description: 'Workflow counts, execution totals by status and trigger, success rate, average duration and recent runs.',
    })
    @ApiOkResponse({ type: MetricsSummaryDto })
    summary(@CurrentUser() user: AuthenticatedUser): Promise<MetricsSummaryDto> {
        return this.metricsService.getSummary(user.id);
    }

    @Get('workflows/:workflowId')
    @ApiOperation({ summary: 'Metrics for one workflow' })
    @ApiParam({ name: 'workflowId', description: 'Workflow id', example: 'cm0x8b1f40001abcdlkj2h3g4' })
    @ApiOkResponse({ type: WorkflowMetricsDto })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    workflow(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workflowId') workflowId: string,
    ): Promise<WorkflowMetricsDto> {
        return this.metricsService.getWorkflowMetrics(user.id, workflowId);
    }
}
