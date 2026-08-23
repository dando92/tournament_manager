import { CreateDivisionDto, GenerateDivisionBracketDto, UpdateDivisionDto, UpdateDivisionSeedingDto } from './structure/division/division.requests';
import { CreatePhaseDto, UpdatePhaseDto } from './structure/division/phase.requests';
import { CreateMatchDto, UpdateMatchDto, CreateMatchWithSongsDto, RoundSourceDto } from '@match/match.requests';
import { CreatePlayerDto, UpdatePlayerDto, BulkAddPlayersToDivisionDto } from './catalog/player.requests';
import { CreateSongDto, UpdateSongDto } from './catalog/song.requests';
import { UpsertPointsDto, UpsertScoreDto } from '@match/rounds.requests';

import { CreateTournamentDto, UpdateTournamentDto } from './management/tournament.requests';
import { CreateParticipantDto, ImportParticipantEntryDto, ImportParticipantsDto, ImportParticipantsPreviewDto } from './registration/participants.requests';
import { AdvancementRuleInputDto, CreateAdvancementRuleDto, UpdateAdvancementRuleDto, UpdateAdvancementRulesDto } from './structure/dtos/advancement-rule.dto';
import {
    CreatePhaseGroupDto,
    UpdatePhaseGroupDto,
} from './structure/phase-group/phase-group.requests';

export { CreateDivisionDto, GenerateDivisionBracketDto, UpdateDivisionDto, UpdateDivisionSeedingDto };
export { CreatePhaseDto, UpdatePhaseDto };
export { CreateMatchDto, UpdateMatchDto, CreateMatchWithSongsDto, RoundSourceDto };
export { CreatePlayerDto, UpdatePlayerDto, BulkAddPlayersToDivisionDto };
export { CreateSongDto, UpdateSongDto };
export { UpsertPointsDto, UpsertScoreDto };

export { CreateTournamentDto, UpdateTournamentDto };
export { CreateParticipantDto, ImportParticipantEntryDto, ImportParticipantsDto, ImportParticipantsPreviewDto };
export { AdvancementRuleInputDto, CreateAdvancementRuleDto, UpdateAdvancementRuleDto, UpdateAdvancementRulesDto };
export {
    CreatePhaseGroupDto,
    UpdatePhaseGroupDto,
};
