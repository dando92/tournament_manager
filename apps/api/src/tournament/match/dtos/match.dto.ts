import {
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  SCORING_SYSTEM_TYPES,
  type ScoringSystemType,
} from '@tournament-manager/scoring';

export class CreateMatchDto {
  @ApiProperty({ description: 'The name of the match', example: 'Match 1' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'A subtitle for the match', example: 'Group A' })
  @IsOptional()
  @IsString()
  subtitle: string;

  @ApiProperty({ description: 'Additional notes about the match', example: 'This match will be played on Friday' })
  @IsOptional()
  @IsString()
  notes: string;

  @ApiProperty({ description: 'The list of entrant ids participating in the match', example: [1, 2, 3] })
  @IsOptional()
  @IsArray()
  entrantIds?: number[];

  @ApiProperty({ description: 'The id of the phase group the match belongs to', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  phaseGroupId: number;

  @ApiProperty({ enum: SCORING_SYSTEM_TYPES, description: 'Which scoring system shall be used' })
  @IsNotEmpty()
  @IsIn(SCORING_SYSTEM_TYPES)
  scoringSystem: ScoringSystemType;

}

export class UpdateMatchDto {
  @ApiProperty({ description: 'The name of the match', example: 'Match 1' })
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty({ description: 'A subtitle for the match', example: 'Group A' })
  @IsOptional()
  @IsString()
  subtitle: string;

  @ApiProperty({ description: 'Additional notes about the match', example: 'This match will be played on Friday' })
  @IsOptional()
  @IsString()
  notes: string;

  @ApiProperty({ description: 'The list of entrant ids participating in the match', example: [1, 2, 3] })
  @IsOptional()
  @IsArray()
  entrantIds?: number[];

  @ApiProperty({ description: 'The id of the phase group the match belongs to', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  phaseGroupId?: number;

  @ApiProperty({ enum: SCORING_SYSTEM_TYPES, description: 'Which scoring system shall be used' })
  @IsOptional()
  @IsIn(SCORING_SYSTEM_TYPES)
  scoringSystem: ScoringSystemType;

}

export class CreateMatchWithSongsDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  entrantIds?: number[];

  @IsNotEmpty()
  @IsNumber()
  phaseGroupId: number;

  @IsNotEmpty()
  @IsIn(SCORING_SYSTEM_TYPES)
  scoringSystem: ScoringSystemType;

  @IsOptional()
  @IsNumber()
  tournamentId?: number;

  @IsOptional()
  @IsNumber()
  divisionId?: number;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  levels?: string;

  @IsOptional()
  @IsArray()
  songIds?: number[];

  getCreateMatchDto() : CreateMatchDto {
        const createDto = new CreateMatchDto();
        createDto.name = this.name;
        createDto.notes = this.notes;
        createDto.phaseGroupId = this.phaseGroupId;
        createDto.entrantIds = this.entrantIds;
        createDto.subtitle = this.subtitle;
        createDto.scoringSystem = this.scoringSystem;
        return createDto
  }
}

export class AddSongToMatchDto {
  @IsOptional()
  @IsNumber()
  songId?: number;

  @IsOptional()
  @IsNumber()
  tournamentId?: number;

  @IsOptional()
  @IsNumber()
  divisionId?: number;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsString()
  level?: string;
}

export class UpdateMatchActiveDto {
  @ApiProperty({ description: 'Whether the match is active for live score intake' })
  @IsBoolean()
  active: boolean;
}

export class MatchPlayerPointsDto {
  @IsNumber()
  playerId: number;

  @IsNumber()
  points: number;
}

export class CommitMatchResultDto {
  @ApiProperty({ description: 'Manual player points for matches without songs', required: false })
  @IsOptional()
  @IsArray()
  playerPoints?: MatchPlayerPointsDto[];

  @ApiProperty({ description: 'Report the completed result to the mapped start.gg set', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  publishToStartgg?: boolean;
}

export class AddStandingToMatchDto {
  @IsOptional()
  @IsNumber()
  scoreId?: number;

  @IsNumber()
  playerId: number;

  @IsNumber()
  songId: number;

  @IsNumber()
  percentage: number;

  @IsNumber()
  score: number;

  @IsBoolean()
  isFailed: boolean;
}
