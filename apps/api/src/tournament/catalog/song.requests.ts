import {
  ArrayNotEmpty,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { ChartDifficulty } from '@tournament-manager/contracts';

/** The six slots a chart can be written for. */
export const CHART_DIFFICULTIES: ChartDifficulty[] = ['Novice', 'Easy', 'Medium', 'Hard', 'Expert', 'Edit'];

/** One chart the browser read out of a simfile. Every field of it is untrusted. */
export class ImportSongDto {
  @ApiProperty({ example: 'Pack A/Song Folder', description: 'SyncStart song path: <pack>/<song folder>' })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  title: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  artist?: string;

  @ApiProperty({ example: 'Pack A', description: 'Pack the song was imported from' })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  group: string;

  @ApiProperty({ example: 13, description: 'Chart meter' })
  @IsInt()
  @Type(() => Number)
  difficulty: number;

  @ApiProperty({ enum: CHART_DIFFICULTIES, description: 'Difficulty slot read from the simfile' })
  @IsIn(CHART_DIFFICULTIES)
  chartDifficulty: ChartDifficulty;
}

/**
 * A whole folder of simfiles, as the browser read it.
 *
 * The rows are written in one transaction: a pack is imported completely or
 * not at all, so a validation or database failure leaves nothing half added.
 */
export class ImportSongsDto {
  @ApiProperty({ example: 1, description: 'Tournament whose pool the songs join' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  tournamentId: number;

  @ApiProperty({ type: [ImportSongDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => ImportSongDto)
  songs: ImportSongDto[];
}

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
