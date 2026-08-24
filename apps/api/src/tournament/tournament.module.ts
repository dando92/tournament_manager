import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { AccountModule } from '@account/account.module';
import { AdminGuard } from '@auth/guards/admin.guard';
import { CreatorOrAdminGuard } from '@auth/guards/owner-or-admin.guard';
import { TournamentAccessGuard } from '@auth/guards/tournament-access.guard';
import { PersistenceModule } from '@tournament-manager/persistence';
import { ScoringSystemProvider } from '@tournament-manager/scoring';
import { LiveMessagingModule } from '../live-messaging/live-messaging.module';
import { StartggModule } from '../integrations/startgg/startgg.module';
import { StartggMatchReporter } from '../integrations/startgg/startgg-match.reporter';
import { StartggService } from '../integrations/startgg/startgg.service';
import { TournamentStartggController } from '../integrations/startgg/tournament-startgg.controller';
import { AdvancementRulesController } from './structure/advancement/advancement-rule.controller';
import { DivisionsController } from './structure/division/division.controller';
import { DivisionQueries } from './structure/division/division.queries';
import { TreeQueries } from './structure/tree.queries';
import { StandingsQueries } from './competition/standings.queries';
import { PhaseGroupsController } from './structure/phase-group/phase-group.controller';
import { PhasesController } from './structure/division/phase.controller';
import { AdvancementRuleCommands } from './structure/advancement/advancement-rule.commands';
import { AdvancementRuleStore } from './structure/advancement/advancement-rule.store';
import { DivisionCommands } from './structure/division/division.commands';
import { DivisionStore } from './structure/division/division.store';
import { PhaseGroupCommands } from './structure/phase-group/phase-group.commands';
import { PhaseGroupQueries } from './structure/phase-group/phase-group.queries';
import { PhaseGroupStore } from './structure/phase-group/phase-group.store';
import { BracketController } from './competition/bracket/bracket.controller';
import { BracketCommands } from './competition/bracket/bracket.commands';
import { MatchesController } from './competition/match/match.controller';
import { AdvancementRunner } from './structure/advancement/advancement.runner';
import { MatchCommands } from './competition/match/match.commands';
import { MatchQueries } from './competition/match/match.queries';
import { MatchStore } from './competition/match/match.store';
import { UiUpdatePublisher } from './shared/ui-update.publisher';
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
import { TournamentOpenGuard } from './shared/tournament-open.guard';
import { TournamentsController } from './management/tournament.controller';
import { ParticipantQueries } from './registration/participants.queries';
import { TournamentParticipantsController } from './registration/participants.controller';
import { TournamentLobbiesController } from './syncstart/tournament-lobbies.controller';
import { TournamentSyncStartBootstrap } from './syncstart/tournament-syncstart.bootstrap';
import { TournamentSyncStartModule } from './syncstart/syncstart.module';
import { TournamentSyncStartService } from './syncstart/tournament-syncstart.service';
import { ControlRoomController } from './competition/control-room/control-room.controller';
import { ControlRoomCommands } from './competition/control-room/control-room.commands';
import { ControlRoomQueries } from './competition/control-room/control-room.queries';
import { ControlRoomStore } from './competition/control-room/control-room.store';
import { ControlRoomRunner } from './competition/control-room/control-room.runner';
import { ControlRoomBootstrap } from './competition/control-room/control-room.bootstrap';
import { ControlRoomMutationGuard } from './competition/control-room/control-room-mutation.guard';

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
        AdvancementRunner,
        SongRoller,
        ScoringSystemProvider,
        BracketCommands,
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
        AdvancementRuleStore,
        AdvancementRuleCommands,
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
        ControlRoomCommands,
        ControlRoomQueries,
        ControlRoomStore,
        ControlRoomRunner,
        ControlRoomBootstrap,
        ControlRoomMutationGuard,
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
        ControlRoomController,
    ],
})
export class TournamentModule {}
