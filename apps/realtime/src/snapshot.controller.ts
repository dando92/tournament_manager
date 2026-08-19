import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import type { RealtimePath } from './realtime-event.mapper';

@Controller('realtime')
export class SnapshotController {
  constructor(private readonly gateway: RealtimeGateway) {}

  @Get('snapshot')
  snapshot(@Query('tournamentId') rawTournamentId: string, @Query('path') path: RealtimePath) {
    const tournamentId = Number(rawTournamentId);
    if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) throw new BadRequestException('Invalid tournamentId');
    if (!['/uiupdatehub', '/lobbygateway', '/livematchgateway'].includes(path)) throw new BadRequestException('Invalid path');
    return this.gateway.snapshot(tournamentId, path);
  }
}
