import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { WebSocket, Server as WsServer } from 'ws';
import { UiUpdateContextService } from '@match/services/ui-update-context.service';

type TournamentUpdatePayload = {
  tournamentId: number;
};

type DivisionUpdatePayload = {
  tournamentId: number;
  divisionId: number;
};

type PhaseUpdatePayload = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
};

type PhaseGroupUpdatePayload = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
};

type MatchUpdatePayload = {
  tournamentId: number;
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
  matchId: number;
};

type UiWarningPayload = {
  tournamentId: number;
  message: string;
};

@WebSocketGateway({
  path: "/uiupdatehub",
  cors: {
    origin: '*',
  },
})
export class UiUpdateGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: WsServer;

  constructor(
    private readonly uiUpdateContextService: UiUpdateContextService,
  ) {}

  handleConnection(_client: WebSocket) {
    console.log(`Client connected to ui update gateway`);
  }

  handleDisconnect(_client: WebSocket) {
    console.log(`Client disconnected from ui update gateway`);
  }

  private broadcast(event: string, data: unknown) {
    const msg = JSON.stringify({ event, data });
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  async emitTournamentUpdate(tournamentId: number | null | undefined) {
    if (!tournamentId) return;

    const msg: TournamentUpdatePayload = { tournamentId };
    this.broadcast('TournamentUpdate', msg);
  }

  async emitDivisionUpdateByDivisionId(divisionId: number | null | undefined) {
    if (!divisionId) return;

    const payload = await this.uiUpdateContextService.getDivisionUpdatePayload(divisionId);
    if (!payload) return;

    this.broadcast('DivisionUpdate', payload);
  }

  async emitPhaseUpdateByPhaseId(phaseId: number | null | undefined) {
    if (!phaseId) return;

    const payload = await this.uiUpdateContextService.getPhaseUpdatePayload(phaseId);
    if (!payload) return;

    this.broadcast('PhaseUpdate', payload);
  }

  async emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId: number | null | undefined) {
    if (!phaseGroupId) return;

    const payload = await this.uiUpdateContextService.getPhaseGroupUpdatePayload(phaseGroupId);
    if (!payload) return;

    this.broadcast('PhaseGroupUpdate', payload);
  }

  async emitMatchUpdateByMatchId(matchId: number | null | undefined) {
    if (!matchId) return;

    const payload = await this.uiUpdateContextService.getMatchUpdatePayload(matchId);
    if (!payload) return;

    this.broadcast('MatchUpdate', payload);
  }

  emitWarning(tournamentId: number | null | undefined, message: string) {
    if (!tournamentId) return;

    const payload: UiWarningPayload = { tournamentId, message };
    this.broadcast('UiWarning', payload);
  }
}
