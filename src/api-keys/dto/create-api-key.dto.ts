import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transformers/string.transformers';

export class CreateApiKeyDto {
    @ApiProperty({ example: 'GitHub Actions deploy hook', description: 'Human-readable label', maxLength: 80 })
    @Transform(trimString)
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    name!: string;
}
