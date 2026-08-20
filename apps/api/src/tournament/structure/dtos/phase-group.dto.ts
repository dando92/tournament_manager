import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePhaseGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  displayIdentifier?: string;

  @IsOptional()
  @IsString()
  bracketType?: string;
}

export class UpdatePhaseGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayIdentifier?: string | null;

  @IsOptional()
  @IsString()
  bracketType?: string | null;

  @IsOptional()
  @IsString()
  state?: string;
}

export class UpdatePhaseGroupSeedingDto {
  @IsArray()
  @IsNumber({}, { each: true })
  entrantIds: number[];
}

