import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import { JwtAuthGuard } from '@auth/guards/jwt-auth.guard';
import { TournamentAccessGuard } from '@auth/guards/tournament-access.guard';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/shared/tournament-open.guard';
import { TournamentSyncStartService } from './tournament-syncstart.service';

class LobbySongCommandDto {
    @IsInt()
    @Min(1)
    songId: number;
}

@UseGuards(TournamentOpenGuard)
@Controller('tournaments')
export class TournamentLobbiesController {
    constructor(private readonly syncStart: TournamentSyncStartService) {}

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Get(':id/lobbies')
    getLobbies(@Param('id') id: number) {
        return this.syncStart.listLobbies(Number(id));
    }

    @Get(':id/lobbies/status')
    getLobbiesStatus(@Param('id') id: number) {
        return this.syncStart.listLobbies(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Get(':id/lobbies/control-options')
    getControlOptions(@Param('id') id: number) {
        return this.syncStart.controlOptions(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/server/connect')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    connectSyncStartServer(@Param('id') id: number) {
        return this.syncStart.connectServer(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/lobbies/server/disconnect')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    disconnectSyncStartServer(@Param('id') id: number) {
        return this.syncStart.disconnectServer(Number(id));
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/connect')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    async connectLobby(
        @Param('id') id: number,
        @Body() body: { name?: string; lobbyCode: string; password?: string },
    ) {
        const lobbyId = await this.syncStart.connectLobby(Number(id), body.name, body.lobbyCode, body.password);
        return { id: lobbyId };
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/create')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    createLobby(
        @Param('id') id: number,
        @Body() body: { name?: string; password?: string },
    ) {
        return this.syncStart.createLobby(Number(id), body.name, body.password);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Delete(':id/lobbies/:lobbyId/disconnect')
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    async disconnectLobby(@Param('id') id: number, @Param('lobbyId') lobbyId: string) {
        await this.syncStart.disconnectLobby(Number(id), lobbyId);
        return { ok: true };
    }


    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/:lobbyId/select-song')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    selectSong(
        @Param('id') id: number,
        @Param('lobbyId') lobbyId: string,
        @Body(new ValidationPipe()) body: LobbySongCommandDto,
    ): Promise<void> {
        return this.syncStart.selectSong(Number(id), lobbyId, body.songId);
    }

    @UseGuards(JwtAuthGuard, TournamentAccessGuard)
    @Post(':id/lobbies/:lobbyId/start')
    @HttpCode(HttpStatus.NO_CONTENT)
    @RequireOpenTournament({ entity: 'tournament', location: 'params', field: 'id' })
    startSong(
        @Param('id') id: number,
        @Param('lobbyId') lobbyId: string,
        @Body(new ValidationPipe()) body: LobbySongCommandDto,
    ): Promise<void> {
        return this.syncStart.startSong(Number(id), lobbyId, body.songId);
    }
}
