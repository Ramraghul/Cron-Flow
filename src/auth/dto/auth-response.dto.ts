import { ApiProperty } from '@nestjs/swagger';
import { AuthMethod } from '../../common/interfaces/authenticated-user.interface';

export class AuthUserDto {
    @ApiProperty({ example: 'cm0x8b1f40000abcdlkj2h3g4' })
    id!: string;

    @ApiProperty({ example: 'ada@example.com' })
    email!: string;
}

export class AuthResponseDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbTB4OGIxZjQwMDAwIn0.signature' })
    accessToken!: string;

    @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
    tokenType!: 'Bearer';

    @ApiProperty({ example: 86400, description: 'Seconds until the access token expires' })
    expiresIn!: number;

    @ApiProperty({ type: AuthUserDto })
    user!: AuthUserDto;
}

export class CurrentUserDto extends AuthUserDto {
    @ApiProperty({ enum: ['jwt', 'api-key'], example: 'jwt', description: 'How this request was authenticated' })
    authMethod!: AuthMethod;

    @ApiProperty({
        example: false,
        description: 'True for the public demo account, which may read but never create, change or run anything.',
    })
    readOnly!: boolean;
}
