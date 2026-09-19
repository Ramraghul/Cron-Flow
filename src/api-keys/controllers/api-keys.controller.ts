import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { API_KEY_HEADER, JWT_SECURITY_SCHEME } from '../../app.constants';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ApiKeyDto, CreatedApiKeyDto } from '../dto/api-key-response.dto';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { ApiKeysService } from '../services/api-keys.service';

/** Key management requires a JWT: a leaked API key must not be able to mint more keys. */
@ApiTags('API Keys')
@ApiBearerAuth(JWT_SECURITY_SCHEME)
@ApiErrorResponse(HttpStatus.UNAUTHORIZED)
@ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
    constructor(private readonly apiKeysService: ApiKeysService) {}

    @Post()
    @ApiOperation({
        summary: 'Create an API key',
        description:
            `Returns the full key **once** — only a SHA-256 hash is stored, so it cannot be recovered later. ` +
            `Send it in the \`${API_KEY_HEADER}\` header to call workflow, execution, scheduler and metrics endpoints.`,
    })
    @ApiCreatedResponse({ type: CreatedApiKeyDto })
    @ApiErrorResponse(HttpStatus.BAD_REQUEST)
    create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApiKeyDto): Promise<CreatedApiKeyDto> {
        return this.apiKeysService.create(user.id, dto);
    }

    @Get()
    @ApiOperation({ summary: 'List your API keys', description: 'Keys are masked; only the display prefix is returned.' })
    @ApiOkResponse({ type: [ApiKeyDto] })
    list(@CurrentUser() user: AuthenticatedUser): Promise<ApiKeyDto[]> {
        return this.apiKeysService.list(user.id);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Revoke an API key', description: 'The key stops working immediately.' })
    @ApiParam({ name: 'id', description: 'API key id', example: 'cm0x9c2k10001abcd8f7g6h5j' })
    @ApiNoContentResponse({ description: 'Key revoked' })
    @ApiErrorResponse(HttpStatus.NOT_FOUND)
    revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
        return this.apiKeysService.revoke(user.id, id);
    }
}
