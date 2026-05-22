import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhooksService } from '../services/webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly service: WebhooksService) {}

    @Post(':token/trigger')
    @HttpCode(200)
    @ApiOperation({
        summary: 'Trigger a workflow via its webhook token',
        description: 'No authentication required — the token acts as the secret. Include any payload in the body.',
    })
    @ApiParam({ name: 'token', description: 'Workflow webhookToken (from the workflow object)' })
    @ApiResponse({ status: 200, description: 'Execution queued' })
    @ApiResponse({ status: 404, description: 'Webhook not found' })
    trigger(
        @Param('token') token: string,
        @Body() payload: Record<string, any>,
    ) {
        return this.service.triggerByToken(token, payload);
    }
}
