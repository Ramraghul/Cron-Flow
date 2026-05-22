import { OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { WorkflowService } from './services/workflow.service';
export declare class WorkflowModule implements OnModuleInit {
    private readonly moduleRef;
    private readonly workflowService;
    constructor(moduleRef: ModuleRef, workflowService: WorkflowService);
    onModuleInit(): Promise<void>;
}
//# sourceMappingURL=workflow.module.d.ts.map