import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsString } from 'class-validator';

export class LocalApiKeyLoginDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    apiKey: string;
}

export class AuthSignInDto {
    @ApiProperty({

    })
    @IsNotEmpty()
    @IsString()
    username: string;

    @ApiProperty({

    })
    @IsNotEmpty()
    @IsString()
    password: string;
}
