import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
    @ApiProperty({ example: 'CI Pipeline Key', description: 'Human-readable label for this key' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    name!: string;
}
