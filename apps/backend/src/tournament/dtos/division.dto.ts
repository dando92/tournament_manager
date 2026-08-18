import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Tournament } from '@persistence/entities';

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

  tournament?: Tournament;
}

export class GenerateDivisionBracketDto {
  @ApiProperty({ description: 'The generated phase name', example: 'Bracket', required: false })
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

