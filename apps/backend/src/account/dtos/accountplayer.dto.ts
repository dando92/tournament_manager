import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountPlayerDto {
    @ApiProperty({ example: 'johndoe', description: 'Username for the account' })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    username: string;

    @ApiProperty({ example: 'user@example.com', description: 'Account email' })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    email: string;

    @ApiProperty({ example: 'Password!', description: 'Account password' })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    password: string;

    @ApiProperty({ example: 'abc123', description: 'GrooveStats API key', required: false })
    @IsOptional()
    @IsString()
    @Type(() => String)
    grooveStatsApi?: string;

    @ApiProperty({ example: 'John Doe', description: 'Display name for the player (defaults to username)', required: false })
    @IsOptional()
    @IsString()
    @Type(() => String)
    playerName?: string;
}

export class UpdateAccountPlayerDto {
    @ApiProperty({ example: 'johndoe', description: 'Username', required: false })
    @IsOptional()
    @IsString()
    @Type(() => String)
    username?: string;

    @ApiProperty({ example: 'user@example.com', description: 'Account email', required: false })
    @IsOptional()
    @IsString()
    @Type(() => String)
    email?: string;

    @ApiProperty({ example: 'abc123', description: 'GrooveStats API key', required: false })
    @IsOptional()
    @IsString()
    @Type(() => String)
    grooveStatsApi?: string;
}
