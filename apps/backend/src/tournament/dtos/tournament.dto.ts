import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TournamentStaffDto {
    @ApiProperty({ example: 'd9c42b76-3c5f-4d2f-8f4c-32a2d93b24ff', description: 'Staff account id.' })
    id: string;

    @ApiProperty({ example: 'momo', description: 'Staff username.' })
    username: string;
}

export class TournamentResponseDto {
    @ApiProperty({ example: 1, description: 'Tournament id.' })
    id: number;

    @ApiProperty({ example: 'UEFA Euro 2024', description: 'The name of the tournament.' })
    name: string;

    @ApiProperty({
        description: 'WebSocket URL of the syncstart server for this tournament.',
        required: false,
        example: 'ws://syncservice.groovestats.com:1337',
    })
    syncstartUrl?: string;

    @ApiProperty({ example: 2, description: 'Number of match setups available for this tournament.' })
    availableSetupsCount: number;

    @ApiProperty({ example: 'EurocupScoreCalculator', description: 'Default scoring system for newly created matches.' })
    defaultScoringSystem: string;

    @ApiProperty({ type: () => [TournamentStaffDto], description: 'Tournament staff.' })
    staff: TournamentStaffDto[];
}

export class TournamentConfigurationDto {
    @ApiProperty({ example: 1, description: 'Tournament id.' })
    id: number;

    @ApiProperty({ example: 'UEFA Euro 2024', description: 'The name of the tournament.' })
    name: string;

    @ApiProperty({ description: 'WebSocket URL of the syncstart server for this tournament.' })
    syncstartUrl: string;

    @ApiProperty({ description: 'start.gg API key for this tournament.', required: false })
    startggApiKey?: string | null;

    @ApiProperty({ example: 2, description: 'Number of match setups available for this tournament.' })
    availableSetupsCount: number;

    @ApiProperty({ example: 'EurocupScoreCalculator', description: 'Default scoring system for newly created matches.' })
    defaultScoringSystem: string;
}

export class CreateTournamentDto {
    /**
     * The name of the tournament.
     * @example "UEFA Euro 2024"
     */
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'UEFA Euro 2024', description: 'The name of the tournament.' })
    name: string;

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
    @IsString()
    @ApiProperty({ description: 'Default scoring system for newly created matches.', required: false })
    defaultScoringSystem?: string;
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
    @IsString()
    @ApiProperty({ description: 'Default scoring system for newly created matches.', required: false })
    defaultScoringSystem?: string;
}
