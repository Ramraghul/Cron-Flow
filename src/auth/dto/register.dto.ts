import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normaliseEmail } from '../../common/transformers/string.transformers';

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt silently ignores input beyond 72 bytes, so longer passwords are rejected outright. */
export const PASSWORD_MAX_BYTES = 72;

export class RegisterDto {
    @ApiProperty({ example: 'ada@example.com', maxLength: 254, description: 'Stored lower-cased' })
    @Transform(normaliseEmail)
    @IsEmail({}, { message: 'email must be a valid email address' })
    @MaxLength(254)
    email!: string;

    @ApiProperty({
        example: 'correct-horse-battery-staple',
        minLength: PASSWORD_MIN_LENGTH,
        description: `At least ${PASSWORD_MIN_LENGTH} characters and at most ${PASSWORD_MAX_BYTES} bytes`,
    })
    @IsString()
    @MinLength(PASSWORD_MIN_LENGTH)
    @IsByteLength(0, PASSWORD_MAX_BYTES, { message: `password must be at most ${PASSWORD_MAX_BYTES} bytes` })
    password!: string;
}
