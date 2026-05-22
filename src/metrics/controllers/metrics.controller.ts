import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MetricsService } from '../services/metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
    constructor(private readonly service: MetricsService) {}

    @Get('health')
    @ApiOperation({ summary: 'Health check — no auth required' })
    health() {
        return this.service.health();
    }

    @Get()
    @ApiBearerAuth('JWT')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Platform-wide metrics (admin view)' })
    global() {
        return this.service.getGlobalMetrics();
    }

    @Get('workflows/:id')
    @ApiBearerAuth('JWT')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Per-workflow execution metrics' })
    workflow(@Param('id') id: string, @Request() req: any) {
        return this.service.getWorkflowMetrics(id, req.user.id);
    }
}
