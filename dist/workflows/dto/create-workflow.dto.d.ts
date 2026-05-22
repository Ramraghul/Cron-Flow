declare enum StepType {
    HTTP = "HTTP",
    DELAY = "DELAY"
}
declare class WorkflowStepDto {
    stepOrder: number;
    type: StepType;
    config: any;
}
export declare class CreateWorkflowDto {
    name: string;
    description?: string;
    cronExpression: string;
    steps: WorkflowStepDto[];
}
export {};
//# sourceMappingURL=create-workflow.dto.d.ts.map