import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponse } from '../../common/decorators/api-error-response.decorator';
import { ExecutionAcceptedDto } from '../../executions/dto/execution-response.dto';
import { WebhooksService } from '../services/webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService) {}

    @Post(':token/trigger')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: 'Trigger a workflow from an external system',
        description:
            'No auth header needed — the unguessable token in the URL is the credential (the workflow’s `webhookToken`). ' +
            'Any JSON object sent as the body is stored on the execution as `triggerPayload`.',
    })
    @ApiParam({ name: 'token', description: 'The workflow’s webhookToken', example: 'k3Jd9sQ2mVx7LpA0bR4tYw8eZc1uN6hG' })
    @ApiBody({
        required: false,
        schema: { type: 'object', additionalProperties: true, example: { event: 'deploy.finished', ref: 'main' } },
    })
    @ApiAcceptedResponse({ type: ExecutionAcceptedDto })
    @ApiErrorResponse(HttpStatus.NOT_FOUND, 'No workflow has this webhook token')
    @ApiErrorResponse(HttpStatus.CONFLICT, 'The workflow is paused')
    @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS)
    @ApiErrorResponse(HttpStatus.SERVICE_UNAVAILABLE)
    trigger(@Param('token') token: string, @Body() payload: unknown): Promise<ExecutionAcceptedDto> {
        return this.webhooksService.trigger(token, payload);
    }
}
