import type { PlayerRefDto } from './projections';

/**
 * What importing a list of names into a tournament would do.
 *
 * One row per distinct name: the local player it matched, if any, and whether
 * that player already competes in this tournament.
 */
export type ParticipantImportPreviewRowDto = {
    name: string;
    matchedPlayer: PlayerRefDto | null;
    alreadyParticipant: boolean;
};
