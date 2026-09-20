import { Controller, Get, HttpStatus, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { ServiceInfoResponseDto } from '../dto/service-info-response.dto';
import { ServiceInfoService } from '../services/service-info.service';

/** Served at the API root (/api/v1) — the global prefix supplies the path. */
@ApiTags('Service')
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@Controller()
export class ServiceInfoController {
    constructor(private readonly serviceInfoService: ServiceInfoService) {}

    @Get()
    @ApiOperation({
        summary: 'Service information',
        description:
            'Public welcome endpoint: version, dependency health, and links to the docs, health probes and every resource group. Use it to verify a deployment without credentials.',
    })
    @ApiOkResponse({ type: ServiceInfoResponseDto })
    info(@Req() request: Request): Promise<ServiceInfoResponseDto> {
        // Behind a proxy these reflect X-Forwarded-Proto/Host, so deployed links use the public origin.
        return this.serviceInfoService.getInfo(`${request.protocol}://${request.get('host')}`);
    }
}
