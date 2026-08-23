import { Body, CanActivate, Controller, ExecutionContext, Get, Injectable, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CompletedSongRequest } from '@tournament-manager/contracts';
import { Tournament } from '@tournament-manager/persistence';
import { Repository } from 'typeorm';
import { CompletedSongService } from '@tournament/syncstart/completed-song.service';

@Injectable()
class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected || context.switchToHttp().getRequest().headers['x-internal-service-token'] !== expected) throw new UnauthorizedException();
    return true;
  }
}

@Controller('internal/syncstart')
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(private readonly completedSongs: CompletedSongService, @InjectRepository(Tournament) private readonly tournaments: Repository<Tournament>) {}
  @Post('completed-songs') async completedSong(@Body() request: CompletedSongRequest): Promise<void> { await this.completedSongs.submit(request); }
  @Get('tournaments') async tournamentsForBootstrap() { return (await this.tournaments.find({ where: { status: 'open' } })).filter((t) => t.syncstartUrl).map((t) => ({ tournamentId: t.id, syncstartUrl: t.syncstartUrl })); }
}
