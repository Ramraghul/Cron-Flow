import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const SortOrder = { Asc: 'asc', Desc: 'desc' } as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

export class PaginationQueryDto {
    @ApiPropertyOptional({ description: '1-based page number', minimum: 1, default: 1, example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page = 1;

    @ApiPropertyOptional({
        description: 'Items per page',
        minimum: 1,
        maximum: MAX_PAGE_SIZE,
        default: DEFAULT_PAGE_SIZE,
        example: DEFAULT_PAGE_SIZE,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    limit = DEFAULT_PAGE_SIZE;
}

export class PaginationMetaDto {
    @ApiProperty({ example: 1 })
    page!: number;

    @ApiProperty({ example: 20 })
    limit!: number;

    @ApiProperty({ example: 42, description: 'Total items matching the filters' })
    totalItems!: number;

    @ApiProperty({ example: 3 })
    totalPages!: number;

    @ApiProperty({ example: true })
    hasNextPage!: boolean;

    @ApiProperty({ example: false })
    hasPreviousPage!: boolean;
}

export function buildPaginationMeta(page: number, limit: number, totalItems: number): PaginationMetaDto {
    const totalPages = Math.ceil(totalItems / limit);
    return {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
}

/** Rows to skip for a 1-based page. */
export function paginationOffset(page: number, limit: number): number {
    return (page - 1) * limit;
}
