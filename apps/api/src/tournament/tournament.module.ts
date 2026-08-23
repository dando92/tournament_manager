import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AccountModule } from '@account/account.module';
import { AdminGuard, CreatorOrAdminGuard, TournamentAccessGuard } from '@auth/guards';
import { PersistenceModule } from '@tournament-manager/persistence';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { LiveMessagingModule } from '../live-messaging/live-messaging.module';
import { StartggModule } from '../integrations/startgg/startgg.module';
import { StartggMatchReporter } from '../integrations/startgg/startgg-match.reporter';
import { StartggService } from '../integrations/startgg/startgg.service';
import { TournamentStartggController } from '../integrations/startgg/tournament-startgg.controller';
import { AdvancementRulesController } from './structure/controllers/advancement-rules.controller';
import { DivisionsController } from './structure/division/division.controller';
import { DivisionQueries } from './structure/division/division.queries';
import { TreeQueries } from './structure/tree.queries';
import { StandingsQueries } from './competition/standings.queries';
import { PhaseGroupsController } from './structure/phase-group/phase-group.controller';
import { PhasesController } from './structure/division/phase.controller';
import { AdvancementRuleManager } from './structure/services/advancement-rule.manager';
import { AdvancementRuleService } from './structure/services/advancement-rule.service';
import { DivisionCommands } from './structure/division/division.commands';
import { DivisionStore } from './structure/division/division.store';
import { PhaseGroupCommands } from './structure/phase-group/phase-group.commands';
import { PhaseGroupQueries } from './structure/phase-group/phase-group.queries';
import { PhaseGroupStore } from './structure/phase-group/phase-group.store';
import { BracketController } from './competition/bracket/bracket.controller';
import { BracketSystemProvider } from './competition/bracket/BracketSystemProvider';
import { MatchesController } from './competition/match/match.controller';
import { AdvancementManager } from './competition/match/services/advancement.manager';
import { MatchCommands } from './competition/match/match.commands';
import { MatchQueries } from './competition/match/match.queries';
import { MatchStore } from './competition/match/match.store';
import { UiUpdatePublisher } from './competition/match/services/ui-update.publisher';
import { ScoresController } from './competition/score.controller';
import { ScoreQueries } from './competition/score.queries';
import { ScoreStore } from './competition/score.store';
import { SongsController } from './catalog/song.controller';
import { SongCommands } from './catalog/song.commands';
import { SongQueries } from './catalog/song.queries';
import { SongStore } from './catalog/song.store';
import { CompletedSongService } from './syncstart/completed-song.service';
import { SongRoller } from './catalog/song-roller';
import { RoundsController } from './competition/match/rounds.controller';
import { PlayersController } from './catalog/player.controller';
import { PlayerQueries } from './catalog/player.queries';
import { PlayerStore } from './catalog/player.store';
import { ParticipantsCommands } from './registration/participants.commands';
import { TournamentCommands } from './management/tournament.commands';
import { TournamentQueries } from './management/tournament.queries';
import { TournamentStore } from './management/tournament.store';
import { TournamentOpenGuard } from './guards/tournament-open.guard';
import { TournamentsController } from './management/tournament.controller';
import { ParticipantQueries } from './registration/participants.queries';
import { TournamentParticipantsController } from './registration/participants.controller';
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
        TournamentSyncStartService,
        TournamentSyncStartBootstrap,
        PlayerQueries,
        PlayerStore,
        DivisionCommands,
        DivisionStore,
        ParticipantsCommands,
        PhaseGroupCommands,
        PhaseGroupQueries,
        PhaseGroupStore,
        SongCommands,
        SongStore,
        StartggService,
        StartggMatchReporter,
        AdvancementRuleService,
        AdvancementRuleManager,
        UiUpdatePublisher,
        CompletedSongService,
        DivisionQueries,
        ScoreQueries,
        ScoreStore,
        SongQueries,
        ParticipantQueries,
        StandingsQueries,
        TreeQueries,
        TournamentQueries,
        TournamentCommands,
        TournamentStore,
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
