import { IsNotEmpty, IsNumber, IsString, IsOptional, } from 'class-validator';
import { Type } from 'class-transformer';
import { Player }  from '@persistence/entities';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
    @ApiProperty({
    example: 'John Doe',
    description: 'Name of the player',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    username: string;

    @ApiProperty({
    example: 'example@example.com',
    description: 'Account email',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    email: string;

    @ApiProperty({
        example: 'Password!',
        description: 'Account password',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    password: string;

    @ApiProperty({
        example: 1,
        description: 'ID of the team the player belongs to',
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    playerId: number;
}

export class UpdateAcountDto {
    @ApiProperty({
    example: 'John Doe',
    description: 'Name of the player',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    userName: string;

    @ApiProperty({
    example: 'example@example.com',
    description: 'Account email',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    email: string;

    @ApiProperty({
        example: 'Password!',
        description: 'Account password',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    password: string;

    @ApiProperty({
        example: 1,
        description: 'ID of the team the player belongs to',
        required: false,
    })
    @IsNumber()
    @Type(() => Number)
    playerId: number;

    player?: Promise<Player>;
}