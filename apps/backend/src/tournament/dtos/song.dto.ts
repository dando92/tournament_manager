import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSongDto {
  @ApiProperty({
    example: 'Song Title',
    description: 'Title of the song',
  })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  title: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  artist?: string;

  @ApiProperty({
    example: 'Song Group',
    description: 'Group of the song',
  })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  group: string;

  @ApiProperty({
    example: 5,
    description: 'Difficulty of the song',
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  difficulty: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tournamentId?: number;
}

export class UpdateSongDto {
  @ApiProperty({
    example: 'New Song Title',
    description: 'New title of the song',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Type(() => String)
  title: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  artist?: string;

  @ApiProperty({
    example: 'New Song Group',
    description: 'New group of the song',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Type(() => String)
  group: string;

  @ApiProperty({
    example: 8,
    description: 'New difficulty of the song',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  difficulty: number;
}
