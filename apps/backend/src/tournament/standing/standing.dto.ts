import {
    IsNotEmpty,
    IsNumber,
    IsOptional,
} from 'class-validator';
import { Score, Round } from '@persistence/entities';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStandingDto {
    @ApiProperty({
        example: 2,
        description: 'ID of the score',
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    scoreId: number;

    @ApiProperty({
        example: 2,
        description: 'ID of the round',
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    roundId: number;

    @ApiProperty({ description: 'The score value', example: 1, required: true })
    @IsNotEmpty()
    @IsNumber()
    points: number;
}

export class UpdateStandingDto {
    @ApiProperty({ description: 'The score value', example: 1, required: true })
    @IsOptional()
    @IsNumber()
    points: number;

    @ApiProperty({
        example: 2,
        description: 'ID of the score',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    scoreId: number;

    score?: Score;

    @ApiProperty({
        example: 2,
        description: 'ID of the round',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    roundId: number;

    round?: Round;
}
