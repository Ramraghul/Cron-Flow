import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
    ApiAcceptedResponse,
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiSecurity,
    ApiTags,
} from '@nestjs/swagger';
import { API_KEY_SECURITY_SCHEME, JWT_SECURITY_SCHEME } from '../../app.constants';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ExecutionAcceptedDto, PaginatedExecutionsResponseDto } from '../dto/execution-response.dto';
import { ListExecutionsQueryDto } from '../dto/list-executions-query.dto';
import { ExecutionsService } from '../services/executions.service';

const WORKFLOW_ID_PARAM = { name: 'workflowId', description: 'Workflow id', example: 'cm0x8b1f40001abcdlkj2h3g4' };

@ApiTags('Executions')
@ApiBearerAuth(JWT_SECURITY_SCHEME)
@ApiSecurity(API_KEY_SECURITY_SCHEME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED)
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@UseGuards(JwtOrApiKeyGuard)
@Controller('workflows/:workflowId/executions')
export class WorkflowExecutionsController {
    constructor(private readonly executionsService: ExecutionsService) {}

    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: 'Run a workflow now',
        description:
            'Creates a `PENDING` execution and queues it for a worker, returning **202 Accepted** immediately. ' +
            'Poll `statusUrl` to follow progress. Paused workflows can still be run manually.',
    })
    @ApiParam(WORKFLOW_ID_PARAM)
    @ApiAcceptedResponse({ type: ExecutionAcceptedDto })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, 'Job queue (Redis) unavailable — the execution is recorded as FAILED')
    trigger(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workflowId') workflowId: string,
    ): Promise<ExecutionAcceptedDto> {
        return this.executionsService.triggerManually(user.id, workflowId);
    }

    @Get()
    @ApiOperation({ summary: 'List executions of a workflow', description: 'Newest first, filterable by status and trigger.' })
    @ApiParam(WORKFLOW_ID_PARAM)
    @ApiOkResponse({ type: PaginatedExecutionsResponseDto })
    @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid query parameters')
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workflowId') workflowId: string,
        @Query() query: ListExecutionsQueryDto,
    ): Promise<PaginatedExecutionsResponseDto> {
        return this.executionsService.listForWorkflow(user.id, workflowId, query);
    }
}
