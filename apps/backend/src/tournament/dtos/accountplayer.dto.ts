import { IsNotEmpty, IsNumber, IsString, IsOptional, } from 'class-validator';
import { Type } from 'class-transformer';
import { Player, Score }  from '@persistence/entities';
import { ApiProperty } from '@nestjs/swagger';
import { PrimaryGeneratedColumn } from 'typeorm';

export class CreateAccountPlayerDto {
    @ApiProperty({
    example: 'John Doe',
    description: 'Name of the player',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    username: string;

    @ApiProperty({
    example: 'example@example.com',
    description: 'Account email',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    email: string;

    @ApiProperty({
        example: 'Password!',
        description: 'Account password',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    password: string;

    @ApiProperty({
    example: 1,
    description: 'Groovestatsapi key for the player',
    required: false,
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    grooveStatsApi: string;

    @ApiProperty({
        example: 1,
        description: 'ID of the player table this account belongs to',
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    playerId: number;

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ApiProperty({
    example: 'localstorage/picture.png',
    description: 'url of the player profile picture',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    playerPictureUrl: string;

    @ApiProperty({
    example: 'John Doe',
    description: 'Name of the player',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    playerName: string;

    @ApiProperty({
    example: '5 years',
    description: 'Time the player has been actively playing',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    playedFor: string;

    @ApiProperty({
    example: 'Netherlands',
    description: 'Country the player represents',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    country: string;

    @ApiProperty({
    example: '15',
    description: 'Highest stamina pass the player has achieved',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    highestStaminaPass: number;

    @ApiProperty({
    example: '??',
    description: 'I don\'t know',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    staminaLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The footspeed level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    footSpeedLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The crossover tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    crossOverTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The footswitch tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    footSwitchTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The sideswitch tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    sideSwitchTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The bracket tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    bracketTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The doublestep tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    doubleStepTechLevel: number;
    
    @ApiProperty({
    example: '12',
    description: 'The jack tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    jackTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The xmod tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    xmodTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The burst tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    burstTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The rhythms tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    rhythmsTechLevel: number;

    @ApiProperty({
    example: 1,
    description: 'ID of the scores table for this player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    scoresId: number;

    @ApiProperty({
    example: 1,
    description: 'ID of the team the player belongs to',
    required: false,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    teamId: number;

    @ApiProperty({
    example: 1,
    description: 'ID of the bracket table this player belongs to',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    BracketId: number;
}

export class UpdateAccountPlayerDto {
    @ApiProperty({
    example: 'John Doe',
    description: 'Name of the player',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    userName: string;

    @ApiProperty({
    example: 'example@example.com',
    description: 'Account email',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    email: string;

    @ApiProperty({
        example: 'Password!',
        description: 'Account password',
    })
    @IsNotEmpty()
    @IsString()
    @Type(() => String)
    password: string;

    @ApiProperty({
    example: 1,
    description: 'Groovestatsapi key for the player',
    required: false,
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    grooveStatsApi: string;

    @ApiProperty({
        example: 1,
        description: 'ID of the team the player belongs to',
        required: false,
    })
    @IsNumber()
    @Type(() => Number)
    playerId: number;

    player?: Promise<Player>;

       @ApiProperty({
    example: 'localstorage/picture.png',
    description: 'url of the player profile picture',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    playerPictureUrl: string;

    @ApiProperty({
    example: 'John Doe',
    description: 'Name of the player',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    playerName: string;

    @ApiProperty({
    example: '5 years',
    description: 'Time the player has been actively playing',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    playedFor: string;

    @ApiProperty({
    example: 'Netherlands',
    description: 'Country the player represents',
    })
    @IsString()
    @IsOptional()
    @Type(() => String)
    country: string;

    @ApiProperty({
    example: '15',
    description: 'Highest stamina pass the player has achieved',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    highestStaminaPass: number;

    @ApiProperty({
    example: '??',
    description: 'I don\'t know',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    staminaLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The footspeed level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    footSpeedLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The crossover tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    crossOverTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The footswitch tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    footSwitchTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The sideswitch tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    sideSwitchTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The bracket tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    bracketTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The doublestep tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    doubleStepTechLevel: number;
    
    @ApiProperty({
    example: '12',
    description: 'The jack tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    jackTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The xmod tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    xmodTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The burst tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    burstTechLevel: number;

    @ApiProperty({
    example: '12',
    description: 'The rhythms tech level of the player',
    })
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    rhythmsTechLevel: number;
    
      @ApiProperty({
      example: 1,
      description: 'ID of the scores table for this player',
      })
      @IsString()
      @Type(() => Number)
      scoresId: number;
    
      score?: Promise<Score>
    
      @ApiProperty({
        example: 1,
        description: 'ID of the team the player belongs to',
        required: false,
      })
      @IsOptional()
      @IsNumber()
      @Type(() => Number)
      teamId: number;
    
}