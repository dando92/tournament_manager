import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { TournamentSyncStartRegistry } from "./tournament-syncstart-registry";

@Injectable()
class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (
      !expected ||
      context.switchToHttp().getRequest().headers[
        "x-internal-service-token"
      ] !== expected
    )
      throw new UnauthorizedException();
    return true;
  }
}

@Controller("internal/tournaments")
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(private readonly tournaments: TournamentSyncStartRegistry) {}
  @Put(":tournamentId/configuration") configure(
    @Param("tournamentId") id: string,
    @Body() body: { syncstartUrl: string },
  ) {
    this.tournaments.configure(Number(id), body.syncstartUrl);
    return { configured: Boolean(body.syncstartUrl) };
  }
  @Delete(":tournamentId/configuration") close(
    @Param("tournamentId") id: string,
  ) {
    this.tournaments.close(Number(id));
    return { closed: true };
  }
  @Post(":tournamentId/server/connect") connect(
    @Param("tournamentId") id: string,
  ) {
    return this.tournaments.connectServer(Number(id));
  }
  @Delete(":tournamentId/server/disconnect") disconnect(
    @Param("tournamentId") id: string,
  ) {
    return this.tournaments.disconnectServer(Number(id));
  }
  @Get(":tournamentId/lobbies") lobbies(@Param("tournamentId") id: string) {
    return this.tournaments.listLobbies(Number(id));
  }
  @Post(":tournamentId/lobbies/connect") connectLobby(
    @Param("tournamentId") id: string,
    @Body() body: { lobbyName: string; lobbyCode: string; password?: string },
  ) {
    return this.tournaments.connectLobby({
      tournamentId: Number(id),
      ...body,
    });
  }
  @Post(":tournamentId/lobbies") createLobby(
    @Param("tournamentId") id: string,
    @Body() body: { lobbyName: string; password?: string },
  ) {
    return this.tournaments.createLobby({
      tournamentId: Number(id),
      ...body,
    });
  }
  @Delete(":tournamentId/lobbies/:lobbyId") disconnectLobby(
    @Param("tournamentId") id: string,
    @Param("lobbyId") lobbyId: string,
  ) {
    this.tournaments.disconnectLobby(Number(id), lobbyId);
    return { ok: true };
  }
}
