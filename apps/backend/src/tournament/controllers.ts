import { DivisionsController } from './controllers/divisions.controller';
import { PhasesController } from './controllers/phases.controller';
import { PhaseGroupsController } from './controllers/phase-groups.controller';
import { AdvancementRulesController } from './controllers/advancement-rules.controller';
import { MatchesController } from '@match/controllers/matches.controller';
import { PlayersController } from '@player/players.controller';
import { TournamentsController } from './controllers/tournaments.controller';
import { SongsController } from './controllers/songs.controller';
import { ScoresController } from './controllers/scores.controller';
import { StandingsController } from './standing/standings.controller';
import { BracketController } from '@bracket/bracket.controller';

export const Controllers = [
    DivisionsController,
    PhasesController,
    PhaseGroupsController,
    AdvancementRulesController,
    MatchesController,
    PlayersController,
    TournamentsController,
    SongsController,
    ScoresController,
    StandingsController,
    BracketController,
];
