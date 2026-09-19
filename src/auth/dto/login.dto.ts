import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { normaliseEmail } from '../../common/transformers/string.transformers';

export class LoginDto {
    @ApiProperty({ example: 'ada@example.com' })
    @Transform(normaliseEmail)
    @IsEmail({}, { message: 'email must be a valid email address' })
    email!: string;

    @ApiProperty({ example: 'correct-horse-battery-staple' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(1024)
    password!: string;
}
