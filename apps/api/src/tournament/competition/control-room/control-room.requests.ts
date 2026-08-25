import { ArrayUnique, IsArray, IsDateString, IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class ControlRoomFlowEntryInputDto {
    @IsInt()
    @Min(1)
    matchId: number;

    @IsInt()
    @Min(1)
    @Max(1440)
    expectedDurationMinutes: number;
}

export class CreateControlRoomFlowDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsDateString()
    willStartAt: string;

    @IsInt()
    @Min(1)
    @Max(1440)
    defaultExpectedDurationMinutes: number;

    @IsArray()
    @ArrayUnique()
    matchIds: number[];
}

export class UpdateControlRoomFlowDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsDateString()
    willStartAt: string;
}

export class ReplaceControlRoomEntriesDto {
    @IsInt()
    @Min(1)
    version: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ControlRoomFlowEntryInputDto)
    entries: ControlRoomFlowEntryInputDto[];
}

export class UpdateControlRoomEntryTimeDto {
    @IsInt()
    @Min(1)
    @Max(1440)
    expectedDurationMinutes: number;
}
