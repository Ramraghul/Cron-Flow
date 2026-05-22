import { WebhooksService } from '../services/webhooks.service';
export declare class WebhooksController {
    private readonly service;
    constructor(service: WebhooksService);
    trigger(token: string, payload: Record<string, any>): Promise<{
        message: string;
        workflowId: string;
        executionId?: undefined;
    } | {
        message: string;
        executionId: string;
        workflowId: string;
    }>;
}
//# sourceMappingURL=webhooks.controller.d.ts.map