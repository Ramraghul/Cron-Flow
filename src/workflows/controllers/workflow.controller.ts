import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkflowService } from '../services/workflow.service';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';

@ApiTags('Workflows')
@ApiBearerAuth('JWT')
@ApiSecurity('ApiKey')
@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowController {
    constructor(private readonly workflowService: WorkflowService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new workflow with cron schedule and steps' })
    @ApiResponse({ status: 201, description: 'Workflow created and registered with scheduler' })
    createWorkflow(@Request() req: any, @Body() dto: CreateWorkflowDto) {
        return this.workflowService.createWorkflow(req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all workflows for the authenticated user' })
    getUserWorkflows(@Request() req: any) {
        return this.workflowService.getUserWorkflows(req.user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single workflow by ID' })
    getWorkflowById(@Param('id') id: string, @Request() req: any) {
        return this.workflowService.getWorkflowById(id, req.user.id);
    }

    @Patch(':id/pause')
    @HttpCode(200)
    @ApiOperation({ summary: 'Pause a workflow — stops cron execution until resumed' })
    @ApiResponse({ status: 200, description: 'Workflow paused' })
    pauseWorkflow(@Param('id') id: string, @Request() req: any) {
        return this.workflowService.pauseWorkflow(id, req.user.id);
    }

    @Patch(':id/resume')
    @HttpCode(200)
    @ApiOperation({ summary: 'Resume a paused workflow — re-registers with scheduler' })
    @ApiResponse({ status: 200, description: 'Workflow resumed' })
    resumeWorkflow(@Param('id') id: string, @Request() req: any) {
        return this.workflowService.resumeWorkflow(id, req.user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a workflow and unregister from scheduler' })
    deleteWorkflow(@Param('id') id: string, @Request() req: any) {
        return this.workflowService.deleteWorkflow(id, req.user.id);
    }
}
