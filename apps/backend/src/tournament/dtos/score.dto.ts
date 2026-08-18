import { IsNotEmpty, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Song, Player }  from '@persistence/entities';

export class CreateScoreDto {
  @ApiProperty({ description: 'The percentage of the score', example: 95 })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  percentage: number;

  @ApiProperty({ description: 'Indicates if the score is a failure', example: false })
  @IsNotEmpty()
  @IsBoolean()
  @Type(() => Boolean)
  isFailed: boolean;

  @ApiProperty({ description: 'The ID of the song', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  songId: number;

  @ApiProperty({ description: 'The ID of the player', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  playerId: number;
}

export class UpdateScoreDto {
  @ApiProperty({ description: 'The percentage of the score', example: 95, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  percentage: number;

  @ApiProperty({ description: 'Indicates if the score is a failure', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFailed: boolean;

  @ApiProperty({ description: 'The ID of the song', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  songId: number;

  @ApiProperty({ description: 'The ID of the player', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  playerId: number;

  song?: Song;
  player?: Player;
}
