import { Module } from '@nestjs/common';
import { ExecutionsModule } from '../executions/executions.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { WebhooksController } from './controllers/webhooks.controller';
import { WebhooksService } from './services/webhooks.service';

@Module({
    imports: [WorkflowsModule, ExecutionsModule],
    controllers: [WebhooksController],
    providers: [WebhooksService],
})
export class WebhooksModule {}
