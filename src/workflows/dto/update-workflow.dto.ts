import { PartialType } from '@nestjs/swagger';
import { CreateWorkflowDto } from './create-workflow.dto';

/**
 * Every field is optional but validated exactly as on create.
 * Sending `steps` replaces the whole step list; past executions keep their own step snapshots.
 */
export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}
