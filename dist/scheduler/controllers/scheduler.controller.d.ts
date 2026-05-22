import { SchedulerService } from '../services/scheduler.service';
export declare class SchedulerController {
    private readonly service;
    constructor(service: SchedulerService);
    listJobs(): {
        jobs: {
            workflowId: string;
            nextRun: Date | null;
            running: boolean;
        }[];
    };
}
//# sourceMappingURL=scheduler.controller.d.ts.map