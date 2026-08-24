import { ArrayUnique, IsArray, IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class CreateControlRoomFlowDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class RenameControlRoomFlowDto {
    @IsString()
    @IsNotEmpty()
    name: string;
}

export class ReplaceControlRoomEntriesDto {
    @IsInt()
    @Min(1)
    version: number;

    @IsArray()
    @ArrayUnique()
    matchIds: number[];
}
