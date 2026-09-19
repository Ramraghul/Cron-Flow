import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionStatus, TriggerType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListExecutionsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ enum: ExecutionStatus, description: 'Only return executions with this status' })
    @IsOptional()
    @IsEnum(ExecutionStatus)
    status?: ExecutionStatus;

    @ApiPropertyOptional({ enum: TriggerType, description: 'Only return executions started this way' })
    @IsOptional()
    @IsEnum(TriggerType)
    triggerType?: TriggerType;
}
