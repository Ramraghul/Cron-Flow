import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyDto {
    @ApiProperty({ example: 'cm0x9c2k10001abcd8f7g6h5j' })
    id!: string;

    @ApiProperty({ example: 'GitHub Actions deploy hook' })
    name!: string;

    @ApiProperty({ example: 'cf_Q2hhbmdl', description: 'First characters of the key, for identification only' })
    keyPrefix!: string;

    @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
    lastUsedAt!: Date | null;

    @ApiProperty({ type: String, format: 'date-time', example: '2026-09-14T10:00:00.000Z' })
    createdAt!: Date;
}

export class CreatedApiKeyDto extends ApiKeyDto {
    @ApiProperty({
        example: 'cf_Q2hhbmdlTWUtVGhpcy1Jcy1Bbi1FeGFtcGxlLUtleQ',
        description: 'The full API key. Returned only once — store it securely.',
    })
    key!: string;
}
