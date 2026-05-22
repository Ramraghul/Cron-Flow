import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiKeysService } from '../services/api-keys.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
    constructor(private readonly service: ApiKeysService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new API key' })
    @ApiResponse({ status: 201, description: 'Key created — raw key returned once only.' })
    create(@Request() req: any, @Body() dto: CreateApiKeyDto) {
        return this.service.create(req.user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List all API keys (keys are masked)' })
    list(@Request() req: any) {
        return this.service.list(req.user.id);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Revoke an API key by ID' })
    revoke(@Param('id') id: string, @Request() req: any) {
        return this.service.revoke(id, req.user.id);
    }
}
