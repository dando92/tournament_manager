import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { isRealtimePath } from './realtime-message';
import {
  REALTIME_SNAPSHOT_READER,
  type RealtimeSnapshotReader,
} from './snapshots/realtime-snapshot-reader';

@Controller('realtime')
export class SnapshotController {
  constructor(
    @Inject(REALTIME_SNAPSHOT_READER) private readonly snapshots: RealtimeSnapshotReader,
  ) {}

  @Get('snapshot')
  snapshot(@Query('tournamentId') rawTournamentId: string, @Query('path') path: string) {
    const tournamentId = Number(rawTournamentId);
    if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) throw new BadRequestException('Invalid tournamentId');
    if (!isRealtimePath(path)) throw new BadRequestException('Invalid path');
    return this.snapshots.snapshot(tournamentId, path);
  }
}
