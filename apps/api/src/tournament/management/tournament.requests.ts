import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
    SCORING_SYSTEM_TYPES,
    type ScoringSystemType,
} from '@tournament-manager/scoring';

/**
 * Creation accepts only the tournament name (FQ-003). Every other field keeps its
 * persisted default and is edited afterwards through the tournament configuration page.
 */
export class CreateTournamentDto {
    /**
     * The name of the tournament.
     * @example "UEFA Euro 2024"
     */
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'UEFA Euro 2024', description: 'The name of the tournament.' })
    name: string;
}

export class UpdateTournamentDto {
    /**
     * The name of the tournament.
     * @example "UEFA Euro 2024"
     */
    @IsOptional()
    @IsString()
    @ApiProperty({ example: 'UEFA Euro 2024', description: 'The name of the tournament.', required: false })
    name?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'WebSocket URL of the syncstart server for this tournament.', required: false })
    syncstartUrl?: string;

    @IsOptional()
    @IsString()
    @ApiProperty({ description: 'start.gg API key for this tournament.', required: false })
    startggApiKey?: string | null;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    @ApiProperty({ description: 'Number of match setups available for this tournament.', required: false })
    availableSetupsCount?: number;

    @IsOptional()
    @IsIn(SCORING_SYSTEM_TYPES)
    @ApiProperty({ enum: SCORING_SYSTEM_TYPES, description: 'Default scoring system for newly created matches.', required: false })
    defaultScoringSystem?: ScoringSystemType;
}
