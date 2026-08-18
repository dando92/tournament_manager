import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Player, Round, Setup } from '@persistence/entities';

export class CreateMatchAssignmentDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the player assigned',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  playerId: number;

  @ApiProperty({
    example: 1,
    description: 'ID of round assigned',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  roundId: number;

  @ApiProperty({
    example: 1,
    description: 'ID of round assigned',
    required: true,
  })
  @IsNotEmpty()
  @IsNumber()
  setupId: number;
}

export class UpdateMatchAssignmentDto {
  @ApiProperty({
    example: 1,
    description: 'ID of round assigned',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  playerId: number;

  @ApiProperty({
    example: 1,
    description: 'ID of round assigned',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  roundId: number;

  @ApiProperty({
    example: 1,
    description: 'ID of round assigned',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  setupId: number;

  setup?:Setup;
  round?:Round;
  player?:Player;
}
