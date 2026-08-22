import { CreateDivisionDto, GenerateDivisionBracketDto, UpdateDivisionDto, UpdateDivisionSeedingDto } from './structure/dtos/division.dto';
import { CreatePhaseDto, UpdatePhaseDto } from './structure/dtos/phase.dto';
import { CreateMatchDto, UpdateMatchDto, CreateMatchWithSongsDto, RoundSourceDto } from '@match/match.requests';
import { CreatePlayerDto, UpdatePlayerDto, BulkAddPlayersToDivisionDto } from '@player/player.dto';
import { CreateRoundDto, UpdateRoundDto } from './competition/dtos/round.dto';
import { CreateSongDto, UpdateSongDto } from './competition/dtos/song.dto';
import { UpsertPointsDto, UpsertScoreDto } from '@match/rounds.requests';

import { CreateTournamentDto, UpdateTournamentDto } from './dtos/tournament.dto';
import { CreateParticipantDto, ImportParticipantEntryDto, ImportParticipantsDto, ImportParticipantsPreviewDto } from './dtos/participant-management.dto';
import { AdvancementRuleInputDto, CreateAdvancementRuleDto, UpdateAdvancementRuleDto, UpdateAdvancementRulesDto } from './structure/dtos/advancement-rule.dto';
import {
    CreatePhaseGroupDto,
    UpdatePhaseGroupDto,
} from './structure/dtos/phase-group.dto';

export { CreateDivisionDto, GenerateDivisionBracketDto, UpdateDivisionDto, UpdateDivisionSeedingDto };
export { CreatePhaseDto, UpdatePhaseDto };
export { CreateMatchDto, UpdateMatchDto, CreateMatchWithSongsDto, RoundSourceDto };
export { CreatePlayerDto, UpdatePlayerDto, BulkAddPlayersToDivisionDto };
export { CreateRoundDto, UpdateRoundDto };
export { CreateSongDto, UpdateSongDto };
export { UpsertPointsDto, UpsertScoreDto };

export { CreateTournamentDto, UpdateTournamentDto };
export { CreateParticipantDto, ImportParticipantEntryDto, ImportParticipantsDto, ImportParticipantsPreviewDto };
export { AdvancementRuleInputDto, CreateAdvancementRuleDto, UpdateAdvancementRuleDto, UpdateAdvancementRulesDto };
export {
    CreatePhaseGroupDto,
    UpdatePhaseGroupDto,
};
