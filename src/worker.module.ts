import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { ExecutionEngineModule } from './execution-engine/execution-engine.module';

/** Everything the standalone worker needs — and nothing HTTP-related. */
@Module({
    imports: [CoreModule, ExecutionEngineModule],
})
export class WorkerModule {}
