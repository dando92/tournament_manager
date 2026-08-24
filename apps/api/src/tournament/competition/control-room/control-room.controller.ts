import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, UseGuards, ValidationPipe } from "@nestjs/common";
import type { ControlRoomEditorDto, ControlRoomFlowDto, CreatedResourceDto } from "@tournament-manager/contracts";

import { RequireOpenTournament, TournamentOpenGuard } from "@tournament/shared/tournament-open.guard";
import { ControlRoomCommands } from "./control-room.commands";
import { ControlRoomQueries } from "./control-room.queries";
import { CreateControlRoomFlowDto, RenameControlRoomFlowDto, ReplaceControlRoomEntriesDto } from "./control-room.requests";

@UseGuards(TournamentOpenGuard)
@Controller()
export class ControlRoomController {
    constructor(
        private readonly commands: ControlRoomCommands,
        private readonly queries: ControlRoomQueries,
    ) {}

    @Get("tournaments/:tournamentId/control-room/flows")
    list(@Param("tournamentId") tournamentId: number): Promise<ControlRoomFlowDto[]> {
        return this.queries.forTournament(Number(tournamentId));
    }

    @Post("tournaments/:tournamentId/control-room/flows")
    @RequireOpenTournament({ entity: "tournament", location: "params", field: "tournamentId" })
    async create(@Param("tournamentId") tournamentId: number, @Body(new ValidationPipe()) dto: CreateControlRoomFlowDto): Promise<CreatedResourceDto> {
        return { id: await this.commands.create(Number(tournamentId), dto.name) };
    }

    @Get("control-room/flows/:flowId")
    read(@Param("flowId") flowId: number): Promise<ControlRoomFlowDto> {
        return this.queries.byId(Number(flowId));
    }

    @Get("control-room/flows/:flowId/editor")
    editor(@Param("flowId") flowId: number): Promise<ControlRoomEditorDto> {
        return this.queries.editor(Number(flowId));
    }

    @Patch("control-room/flows/:flowId")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    rename(@Param("flowId") flowId: number, @Body(new ValidationPipe()) dto: RenameControlRoomFlowDto): Promise<void> {
        return this.commands.rename(Number(flowId), dto.name);
    }

    @Delete("control-room/flows/:flowId")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    remove(@Param("flowId") flowId: number): Promise<void> {
        return this.commands.remove(Number(flowId));
    }

    @Put("control-room/flows/:flowId/entries")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    replaceEntries(@Param("flowId") flowId: number, @Body(new ValidationPipe()) dto: ReplaceControlRoomEntriesDto): Promise<void> {
        return this.commands.replaceEntries(Number(flowId), dto.version, dto.matchIds);
    }

    @Post("control-room/flows/:flowId/start")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    start(@Param("flowId") flowId: number): Promise<void> {
        return this.commands.start(Number(flowId));
    }

    @Post("control-room/flows/:flowId/start-from/:entryId")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    startFrom(@Param("flowId") flowId: number, @Param("entryId") entryId: number): Promise<void> {
        return this.commands.start(Number(flowId), Number(entryId));
    }

    @Post("control-room/flows/:flowId/pause")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    pause(@Param("flowId") flowId: number): Promise<void> {
        return this.commands.pause(Number(flowId));
    }

    @Post("control-room/flows/:flowId/resume")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    resume(@Param("flowId") flowId: number): Promise<void> {
        return this.commands.resume(Number(flowId));
    }

    @Post("control-room/flows/:flowId/stop")
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: "control-room-flow", location: "params", field: "flowId" })
    stop(@Param("flowId") flowId: number): Promise<void> {
        return this.commands.stop(Number(flowId));
    }

    @Post("control-room/flows/:flowId/archive")
    @HttpCode(HttpStatus.NO_CONTENT)
    archive(@Param("flowId") flowId: number): Promise<void> {
        return this.commands.archive(Number(flowId));
    }

    @Delete("control-room/flows/:flowId/archive")
    @HttpCode(HttpStatus.NO_CONTENT)
    unarchive(@Param("flowId") flowId: number): Promise<void> {
        return this.commands.unarchive(Number(flowId));
    }
}
