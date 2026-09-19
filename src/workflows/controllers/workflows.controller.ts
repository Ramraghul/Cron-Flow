import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiCreatedResponse,
    ApiExtraModels,
    ApiNoContentResponse,
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
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { ListWorkflowsQueryDto } from '../dto/list-workflows-query.dto';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { PaginatedWorkflowsResponseDto, WorkflowResponseDto } from '../dto/workflow-response.dto';
import { DelayStepConfigDto, HttpStepConfigDto } from '../dto/workflow-step.dto';
import { WorkflowsService } from '../services/workflows.service';

const WORKFLOW_ID_PARAM = { name: 'id', description: 'Workflow id', example: 'cm0x8b1f40001abcdlkj2h3g4' };

const CREATE_WORKFLOW_EXAMPLES = {
    httpPipeline: {
        summary: 'HTTP → delay → HTTP',
        value: {
            name: 'Nightly data sync',
            description: 'Warms the reporting cache, waits, then triggers the export',
            cronExpression: '0 2 * * *',
            timezone: 'Europe/London',
            steps: [
                { stepOrder: 1, type: 'HTTP', config: { url: 'https://httpbin.org/get', method: 'GET' } },
                { stepOrder: 2, type: 'DELAY', config: { duration: 2000 } },
                {
                    stepOrder: 3,
                    type: 'HTTP',
                    config: {
                        url: 'https://httpbin.org/post',
                        method: 'POST',
                        headers: { 'X-Source': 'cronflow' },
                        body: { report: 'daily' },
                    },
                    retryCount: 5,
                    timeout: 10000,
                },
            ],
        },
    },
    minimal: {
        summary: 'Single health ping every 5 minutes',
        value: {
            name: 'Uptime ping',
            cronExpression: '*/5 * * * *',
            steps: [{ stepOrder: 1, type: 'HTTP', config: { url: 'https://httpbin.org/status/200' } }],
        },
    },
};

@ApiTags('Workflows')
@ApiBearerAuth(JWT_SECURITY_SCHEME)
@ApiSecurity(API_KEY_SECURITY_SCHEME)
@ApiExtraModels(HttpStepConfigDto, DelayStepConfigDto)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED)
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@UseGuards(JwtOrApiKeyGuard)
@Controller('workflows')
export class WorkflowsController {
    constructor(private readonly workflowsService: WorkflowsService) {}

    @Post()
    @ApiOperation({
        summary: 'Create a workflow',
        description:
            'Validates the cron expression, timezone and every step config, saves the workflow, and registers ' +
            'its cron schedule. New workflows start `ACTIVE`. If the scheduler (Redis) is unavailable nothing is saved.',
    })
    @ApiBody({ type: CreateWorkflowDto, examples: CREATE_WORKFLOW_EXAMPLES })
    @ApiCreatedResponse({ type: WorkflowResponseDto })
    @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Validation failed — e.g. invalid cron, duplicate stepOrder, HTTP step without url')
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, 'Scheduler (Redis) unavailable — the workflow was not created')
    create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
        return this.workflowsService.create(user.id, dto);
    }

    @Get()
    @ApiOperation({
        summary: 'List workflows',
        description: 'Paginated list of your workflows, filterable by status and a text search.',
    })
    @ApiOkResponse({ type: PaginatedWorkflowsResponseDto })
    @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid query parameters')
    list(
        @CurrentUser() user: AuthenticatedUser,
        @Query() query: ListWorkflowsQueryDto,
    ): Promise<PaginatedWorkflowsResponseDto> {
        return this.workflowsService.list(user.id, query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a workflow', description: 'Includes its steps and webhook token.' })
    @ApiParam(WORKFLOW_ID_PARAM)
    @ApiOkResponse({ type: WorkflowResponseDto })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<WorkflowResponseDto> {
        return this.workflowsService.findOne(user.id, id);
    }

    @Patch(':id')
    @ApiOperation({
        summary: 'Update a workflow',
        description:
            'Partial update. Sending `steps` replaces the entire step list (past executions keep their history). ' +
            'Changing `cronExpression` or `timezone` reschedules an active workflow immediately.',
    })
    @ApiParam(WORKFLOW_ID_PARAM)
    @ApiOkResponse({ type: WorkflowResponseDto })
    @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Validation failed, or the body contains no fields to update')
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE)
    update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body() dto: UpdateWorkflowDto,
    ): Promise<WorkflowResponseDto> {
        return this.workflowsService.update(user.id, id, dto);
    }

    @Patch(':id/pause')
    @ApiOperation({ summary: 'Pause a workflow', description: 'Stops scheduled and webhook runs. Manual runs are still allowed.' })
    @ApiParam(WORKFLOW_ID_PARAM)
    @ApiOkResponse({ type: WorkflowResponseDto })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    @ApiErrorResponse(HttpStatus.CONFLICT, 'Workflow is already paused')
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE)
    pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<WorkflowResponseDto> {
        return this.workflowsService.pause(user.id, id);
    }

    @Patch(':id/resume')
    @ApiOperation({ summary: 'Resume a paused workflow', description: 'Re-registers its cron schedule.' })
    @ApiParam(WORKFLOW_ID_PARAM)
    @ApiOkResponse({ type: WorkflowResponseDto })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    @ApiErrorResponse(HttpStatus.CONFLICT, 'Workflow is already active')
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE)
    resume(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<WorkflowResponseDto> {
        return this.workflowsService.resume(user.id, id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a workflow', description: 'Removes its schedule and all of its execution history.' })
    @ApiParam(WORKFLOW_ID_PARAM)
    @ApiNoContentResponse({ description: 'Workflow deleted' })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE)
    remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
        return this.workflowsService.remove(user.id, id);
    }
}
