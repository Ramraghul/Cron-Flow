import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ExecutionService } from '../services/execution.service';

@ApiTags('Executions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('workflows/:workflowId/executions')
export class ExecutionQueryController {
    constructor(private readonly executionService: ExecutionService) {}

    @Get()
    @ApiOperation({ summary: 'List executions for a specific workflow' })
    @ApiQuery({ name: 'limit', required: false, example: 20 })
    @ApiQuery({ name: 'offset', required: false, example: 0 })
    list(
        @Param('workflowId') workflowId: string,
        @Request() req: any,
        @Query('limit') limit = '20',
        @Query('offset') offset = '0',
    ) {
        return this.executionService.listExecutions(workflowId, req.user.id, +limit, +offset);
    }
}
