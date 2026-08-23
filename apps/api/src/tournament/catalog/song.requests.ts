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
