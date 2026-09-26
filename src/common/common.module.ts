import { Global, Module } from '@nestjs/common';
import { DemoAccountsService } from './services/demo-accounts.service';

/** Cross-cutting helpers that guards and services in any module may inject. */
@Global()
@Module({
    providers: [DemoAccountsService],
    exports: [DemoAccountsService],
})
export class CommonModule {}
