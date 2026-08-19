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
import { SyncStartSessionManager } from "./syncstart-session.manager";

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
  constructor(private readonly sessions: SyncStartSessionManager) {}
  @Put(":tournamentId/configuration") configure(
    @Param("tournamentId") id: string,
    @Body() body: { syncstartUrl: string },
  ) {
    return this.sessions.execute({
      action: "configure-tournament",
      tournamentId: Number(id),
      syncstartUrl: body.syncstartUrl,
    });
  }
  @Delete(":tournamentId/configuration") close(
    @Param("tournamentId") id: string,
  ) {
    return this.sessions.execute({
      action: "close-tournament",
      tournamentId: Number(id),
    });
  }
  @Post(":tournamentId/server/connect") connect(
    @Param("tournamentId") id: string,
  ) {
    return this.sessions.execute({
      action: "connect-server",
      tournamentId: Number(id),
    });
  }
  @Delete(":tournamentId/server/disconnect") disconnect(
    @Param("tournamentId") id: string,
  ) {
    return this.sessions.execute({
      action: "disconnect-server",
      tournamentId: Number(id),
    });
  }
  @Get(":tournamentId/lobbies") lobbies(@Param("tournamentId") id: string) {
    return this.sessions.execute({
      action: "list-lobbies",
      tournamentId: Number(id),
    });
  }
  @Post(":tournamentId/lobbies/connect") connectLobby(
    @Param("tournamentId") id: string,
    @Body() body: { lobbyName: string; lobbyCode: string; password?: string },
  ) {
    return this.sessions.execute({
      action: "connect-lobby",
      tournamentId: Number(id),
      ...body,
    });
  }
  @Post(":tournamentId/lobbies") createLobby(
    @Param("tournamentId") id: string,
    @Body() body: { lobbyName: string; password?: string },
  ) {
    return this.sessions.execute({
      action: "create-lobby",
      tournamentId: Number(id),
      ...body,
    });
  }
  @Delete(":tournamentId/lobbies/:lobbyId") disconnectLobby(
    @Param("tournamentId") id: string,
    @Param("lobbyId") lobbyId: string,
  ) {
    return this.sessions.execute({
      action: "disconnect-lobby",
      tournamentId: Number(id),
      lobbyId,
    });
  }
}
