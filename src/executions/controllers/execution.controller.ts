import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExecutionService } from '../services/execution.service';

@ApiTags('Executions')
@ApiBearerAuth('JWT')
@ApiSecurity('ApiKey')
@UseGuards(JwtAuthGuard)
@Controller('executions')
export class ExecutionController {
    constructor(private readonly executionService: ExecutionService) {}

    @Post(':workflowId/trigger')
    @ApiOperation({ summary: 'Manually trigger a workflow execution' })
    @ApiResponse({ status: 201, description: 'Execution queued' })
    trigger(@Param('workflowId') workflowId: string, @Request() req: any) {
        return this.executionService.triggerWorkflow(workflowId, req.user.id);
    }

    @Get(':executionId')
    @ApiOperation({ summary: 'Get execution details including step logs' })
    getExecution(@Param('executionId') executionId: string, @Request() req: any) {
        return this.executionService.getExecutionHistory(executionId, req.user.id);
    }
}
