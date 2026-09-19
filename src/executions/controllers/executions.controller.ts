import { Controller, Get, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { API_KEY_SECURITY_SCHEME, JWT_SECURITY_SCHEME } from '../../app.constants';
import { JwtOrApiKeyGuard } from '../../auth/guards/jwt-or-api-key.guard';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ExecutionDetailsDto } from '../dto/execution-response.dto';
import { ExecutionsService } from '../services/executions.service';

@ApiTags('Executions')
@ApiBearerAuth(JWT_SECURITY_SCHEME)
@ApiSecurity(API_KEY_SECURITY_SCHEME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED)
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@UseGuards(JwtOrApiKeyGuard)
@Controller('executions')
export class ExecutionsController {
    constructor(private readonly executionsService: ExecutionsService) {}

    @Get(':id')
    @ApiOperation({
        summary: 'Get an execution',
        description: 'Status, timings and a per-step log (attempts, output summary, errors).',
    })
    @ApiParam({ name: 'id', description: 'Execution id', example: 'cm0xb2c3d0002abcd4e5f6g7h' })
    @ApiOkResponse({ type: ExecutionDetailsDto })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ExecutionDetailsDto> {
        return this.executionsService.findOne(user.id, id);
    }
}
