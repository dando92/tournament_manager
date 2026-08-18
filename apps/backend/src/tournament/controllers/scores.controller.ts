import { Controller, Get, Query } from '@nestjs/common';
import { Score } from '@persistence/entities';
import { ScoreService } from '../services/score.service';

@Controller('scores')
export class ScoresController {
    constructor(
        private readonly scoreService: ScoreService,
    ) {}

    @Get()
    find(@Query('songId') songId?: string, @Query('playerId') playerId?: string): Promise<Score[]> {
        return this.scoreService.find({
            songId: songId !== undefined ? Number(songId) : undefined,
            playerId: playerId !== undefined ? Number(playerId) : undefined,
        });
    }
}
