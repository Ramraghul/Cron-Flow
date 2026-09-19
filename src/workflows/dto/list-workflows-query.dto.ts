import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto, SortOrder } from '../../common/dto/pagination.dto';
import { trimString } from '../../common/transformers/string.transformers';

export const WorkflowSortField = {
    CreatedAt: 'createdAt',
    UpdatedAt: 'updatedAt',
    Name: 'name',
} as const;
export type WorkflowSortField = (typeof WorkflowSortField)[keyof typeof WorkflowSortField];

export class ListWorkflowsQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ enum: WorkflowStatus, description: 'Only return workflows with this status' })
    @IsOptional()
    @IsEnum(WorkflowStatus)
    status?: WorkflowStatus;

    @ApiPropertyOptional({
        example: 'sync',
        maxLength: 100,
        description: 'Case-insensitive match against name or description',
    })
    @IsOptional()
    @Transform(trimString)
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ enum: WorkflowSortField, default: WorkflowSortField.CreatedAt })
    @IsOptional()
    @IsEnum(WorkflowSortField)
    sortBy: WorkflowSortField = WorkflowSortField.CreatedAt;

    @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.Desc })
    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder: SortOrder = SortOrder.Desc;
}
