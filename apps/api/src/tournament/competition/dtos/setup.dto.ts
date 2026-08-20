import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSetupDto {
    @ApiProperty({ description: 'Can be either P1 or P2', example: 'P1' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'The name of the corresponding cabinet. Name can be retrieved from the machine', example: 'Cabinet1' })
    @IsNotEmpty()
    @IsString()
    cabinetName: string;

    @ApiProperty({ description: 'The name of the division', example: 0 })
    @IsNotEmpty()
    @IsNumber()
    position: number;
}

export class UpdateSetupDto {
    @ApiProperty({ description: 'Can be either P1 or P2', example: 'P1' })
    @IsOptional()
    @IsString()
    name: string;

    @ApiProperty({ description: 'The name of the corresponding cabinet. Name can be retrieved from the machine', example: 'Cabinet1' })
    @IsOptional()
    @IsString()
    cabinetName: string;

    @ApiProperty({ description: 'The name of the division', example: 0 })
    @IsOptional()
    @IsNumber()
    position: number;
}