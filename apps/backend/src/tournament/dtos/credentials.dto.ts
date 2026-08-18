import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Account } from '@persistence/entities';

export class AuthenticateUserDto {
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