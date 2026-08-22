import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AccountModule } from '@account/account.module';
import { AdminGuard, CreatorOrAdminGuard, TournamentAccessGuard } from '@auth/guards';
import { PersistenceModule } from '@tournament-manager/persistence';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { LiveMessagingModule } from '../live-messaging/live-messaging.module';
import { StartggModule } from '../integrations/startgg/startgg.module';
import { StartggService } from '../integrations/startgg/startgg.service';
import { TournamentStartggController } from '../integrations/startgg/tournament-startgg.controller';
import { AdvancementRulesController } from './structure/controllers/advancement-rules.controller';
import { DivisionsController } from './structure/controllers/divisions.controller';
import { PhaseGroupsController } from './structure/controllers/phase-groups.controller';
import { PhasesController } from './structure/controllers/phases.controller';
import { AdvancementRuleManager } from './structure/services/advancement-rule.manager';
import { AdvancementRuleService } from './structure/services/advancement-rule.service';
import { DivisionManager } from './structure/services/division.manager';
import { DivisionService } from './structure/services/division.service';
import { PhaseGroupManager } from './structure/services/phase-group.manager';
import { PhaseGroupService } from './structure/services/phase-group.service';
import { PhaseService } from './structure/services/phase.service';
import { BracketController } from './competition/bracket/bracket.controller';
import { BracketManager } from './competition/bracket/bracket.manager';
import { BracketSystemProvider } from './competition/bracket/BracketSystemProvider';
import { MatchesController } from './competition/match/match.controller';
import { AdvancementManager } from './competition/match/services/advancement.manager';
import { MatchCommands } from './competition/match/match.commands';
import { MatchQueries } from './competition/match/match.queries';
import { MatchStore } from './competition/match/match.store';
import { UiUpdateContextService } from './competition/match/services/ui-update-context.service';
import { UiUpdatePublisher } from './competition/match/services/ui-update.publisher';
import { ScoresController } from './competition/controllers/scores.controller';
import { SongsController } from './competition/controllers/songs.controller';
import { CompletedSongService } from './competition/services/completed-song.service';
import { ScoreService } from './competition/services/score.service';
import { SongRoller } from './competition/services/song.roller';
import { SongService } from './competition/services/song.service';
import { RoundsController } from './competition/match/rounds.controller';
import { PlayersController } from './player/players.controller';
import { PlayerManager } from './player/player.manager';
import { PlayerService } from './player/player.service';
import { EntrantService } from './services/entrant.service';
import { ParticipantService } from './services/participant.service';
import { TournamentManager } from './services/tournament.manager';
import { TournamentQueries } from './management/tournament.queries';
import { TournamentService } from './services/tournament.service';
import { TournamentOpenGuard } from './guards/tournament-open.guard';
import { TournamentsController } from './management/tournaments.controller';
import { TournamentParticipantsController } from './registration/tournament-participants.controller';
import { TournamentLobbiesController } from './syncstart/tournament-lobbies.controller';
import { TournamentSyncStartBootstrap } from './syncstart/tournament-syncstart.bootstrap';
import { TournamentSyncStartModule } from './syncstart/syncstart.module';
import { TournamentSyncStartService } from './syncstart/tournament-syncstart.service';

@Module({
    imports: [
        AuthModule,
        PersistenceModule,
        AccountModule,
        StartggModule,
        LiveMessagingModule,
        TournamentSyncStartModule,
    ],
    providers: [
        MatchCommands,
        MatchQueries,
        MatchStore,
        AdvancementManager,
        SongRoller,
        ScoringSystemProvider,
        BracketSystemProvider,
        BracketManager,
        TournamentSyncStartService,
        TournamentSyncStartBootstrap,
        PlayerService,
        PlayerManager,
        DivisionService,
        DivisionManager,
        ParticipantService,
        EntrantService,
        PhaseService,
        PhaseGroupService,
        PhaseGroupManager,
        SongService,
        ScoreService,
        UiUpdateContextService,
        StartggService,
        AdvancementRuleService,
        AdvancementRuleManager,
        UiUpdatePublisher,
        CompletedSongService,
        TournamentQueries,
        TournamentService,
        TournamentManager,
        TournamentAccessGuard,
        TournamentOpenGuard,
        AdminGuard,
        CreatorOrAdminGuard,
    ],
    exports: [CompletedSongService],
    controllers: [
        TournamentsController,
        TournamentParticipantsController,
        TournamentLobbiesController,
        TournamentStartggController,
        DivisionsController,
        PhasesController,
        PhaseGroupsController,
        AdvancementRulesController,
        MatchesController,
        PlayersController,
        SongsController,
        ScoresController,
        RoundsController,
        BracketController,
    ],
})
export class TournamentModule {}
