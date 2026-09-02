import { IsArray, IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDivisionDto {
  @ApiProperty({ description: 'The name of the division', example: 'Division A' })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  name: string;

  @ApiProperty({ description: 'The ID of the tournament', example: 1, required: true })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  tournamentId: number;

}

export class UpdateDivisionDto {
  @ApiProperty({ description: 'The name of the division', example: 'Division B', required: false })
  @IsOptional()
  @IsString()
  @Type(() => String)
  name: string;

  @ApiProperty({ description: 'The ID of the tournament', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tournamentId: number;
}

export class GenerateDivisionBracketDto {
  @ApiProperty({ description: 'The phase to build the bracket in', example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  phaseId?: number;

  @ApiProperty({ description: 'The generated phase name, when the bracket brings its own', example: 'Bracket', required: false })
  @IsOptional()
  @IsString()
  @Type(() => String)
  phaseName?: string;

  @ApiProperty({ description: 'The bracket type to generate', example: 'SingleElimination' })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  bracketType: string;

  @ApiProperty({ description: 'Players per match for this generated bracket', example: 2, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  playerPerMatch?: number;
}


export class UpdateDivisionSeedingDto {
  @IsArray()
  @IsNumber({}, { each: true })
  entrantIds: number[];
}

/**
 * Who joins or leaves a division. Always a list, even for one person: the
 * roster tab admits and withdraws a selection, and one name is a selection of
 * one.
 */
export class DivisionParticipantsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  participantIds: number[];
}
