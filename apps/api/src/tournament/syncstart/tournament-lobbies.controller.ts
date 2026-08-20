import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, TournamentAccessGuard } from '@auth/guards';
import { RequireOpenTournament, TournamentOpenGuard } from '@tournament/guards/tournament-open.guard';
import { TournamentSyncStartService } from './tournament-syncstart.service';

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
}
