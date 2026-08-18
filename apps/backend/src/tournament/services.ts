import { MatchManager } from "@match/services/match.manager";
import { AdvancementManager } from "@match/services/advancement.manager";
import { MatchWorkflowManager } from "@match/services/match-workflow.manager";
import { MatchService } from "@match/services/match.service";
import { MatchResultService } from "@match/services/match-result.service";
import { SongRoller } from "./services/song.roller";
import { StandingManager } from "./standing/standing.manager";
import { StandingService } from "./standing/standing.service";
import { ScoringSystemProvider } from "./services/scoring-systems/ScoringSystemProvider";
import { BracketSystemProvider } from "@bracket/BracketSystemProvider";
import { BracketManager } from "@bracket/bracket.manager";
import { LobbyManager } from "./services/lobby-manager.service";
import { TournamentService } from "./services/tournament.service";
import { TournamentManager } from "./services/tournament.manager";
import { PlayerService } from "@player/player.service";
import { PlayerManager } from "@player/player.manager";
import { DivisionService } from './services/division.service';
import { DivisionManager } from './services/division.manager';
import { ParticipantService } from './services/participant.service';
import { EntrantService } from './services/entrant.service';
import { PhaseService } from './services/phase.service';
import { PhaseGroupService } from './services/phase-group.service';
import { PhaseGroupManager } from './services/phase-group.manager';
import { SongService } from './services/song.service';
import { ScoreService } from './services/score.service';
import { RoundService } from './services/round.service';
import { UiUpdateContextService } from '@match/services/ui-update-context.service';
import { StartggService } from '../integrations/startgg/startgg.service';
import { AdvancementRuleService } from './services/advancement-rule.service';
import { AdvancementRuleManager } from './services/advancement-rule.manager';

export { MatchManager };
export { AdvancementManager };
export { MatchWorkflowManager };
export { MatchService };
export { MatchResultService };
export { SongRoller };
export { StandingManager };
export { ScoringSystemProvider };
export { BracketSystemProvider };
export { BracketManager };
export { LobbyManager };
export { TournamentService };
export { TournamentManager };
export { PlayerService };
export { PlayerManager };
export { DivisionService };
export { DivisionManager };
export { ParticipantService };
export { EntrantService };
export { PhaseService };
export { PhaseGroupService };
export { PhaseGroupManager };
export { SongService };
export { ScoreService };
export { RoundService };
export { UiUpdateContextService };
export { StartggService };
export { AdvancementRuleService };
export { AdvancementRuleManager };

export { StandingService };

export const Services = [
    MatchService,
    MatchResultService,
    MatchManager,
    AdvancementManager,
    MatchWorkflowManager,
    SongRoller,
    StandingManager,
    StandingService,
    ScoringSystemProvider,
    BracketSystemProvider,
    BracketManager,
    LobbyManager,
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
    RoundService,
    UiUpdateContextService,
    StartggService,
    AdvancementRuleService,
    AdvancementRuleManager,

    TournamentService,
    TournamentManager,
];
