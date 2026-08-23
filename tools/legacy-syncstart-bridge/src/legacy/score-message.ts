/** `PLAYER_1 = 0` and `PLAYER_2` follows it, from ITGmania's `PlayerNumber.h`. */
export type LegacyPlayerNumber = 0 | 1;

/**
 * The tap counters in the order the cabinet writes them.
 *
 * `SyncStartManager::writeScoreMessage` walks `TapNoteScore` from `TNS_None` to
 * `TNS_CheckpointHit` and does two things to the fantastic band on the way: at
 * `TNS_W2` it writes the white count as an extra field, and it writes `TNS_W1`
 * minus that white count. So the wire carries the two fantastic windows apart —
 * `white` is Fantastic+ and `fantasticsWithoutWhite` is the blue remainder —
 * even though the enum has one slot for both.
 */
export type LegacyTapCounters = {
  none: number;
  hitMine: number;
  avoidMine: number;
  checkpointMiss: number;
  miss: number;
  w5: number;
  w4: number;
  w3: number;
  w2: number;
  white: number;
  fantasticsWithoutWhite: number;
  checkpointHit: number;
};

export type LegacyHoldCounters = {
  none: number;
  letGo: number;
  held: number;
  missed: number;
};

export type LegacyScoreMessage = {
  song: string;
  playerNumber: LegacyPlayerNumber;
  playerName: string;
  actualDancePoints: number;
  currentPossibleDancePoints: number;
  possibleDancePoints: number;
  formattedScore: string;
  life: number;
  isFailed: boolean;
  taps: LegacyTapCounters;
  holds: LegacyHoldCounters;
  totalHolds: number;
};

/**
 * `ALL_ITEMS_LENGTH` on the cabinet: ten miscellaneous fields, eleven tap
 * counters, the white count, and four hold counters. ITGmania drops a message
 * of any other length and so does this parser, because a field count that does
 * not match means the sender is not the protocol this bridge was written for.
 */
export const LEGACY_SCORE_FIELD_COUNT = 26;

/**
 * Reading one score datagram.
 *
 * A malformed message is not repaired: the parser answers `null` and the caller
 * logs it, so nothing half-parsed can reach the lobby state and be published as
 * a run somebody played.
 */
export function parseLegacyScoreMessage(
  payload: string,
): LegacyScoreMessage | null {
  const fields = payload.split("|");
  if (fields.length !== LEGACY_SCORE_FIELD_COUNT) return null;

  const song = fields[0].trim();
  const playerNumber = integer(fields[1]);
  const playerName = profileName(fields[2]);
  if (
    song === "" ||
    playerName === "" ||
    (playerNumber !== 0 && playerNumber !== 1)
  )
    return null;

  const numbers = [
    ...fields.slice(3, 6),
    ...fields.slice(9, LEGACY_SCORE_FIELD_COUNT),
  ].map(integer);
  const life = Number.parseFloat(fields[7]);
  if (numbers.some((value) => value === null) || !Number.isFinite(life))
    return null;

  const [
    actualDancePoints,
    currentPossibleDancePoints,
    possibleDancePoints,
    none,
    hitMine,
    avoidMine,
    checkpointMiss,
    miss,
    w5,
    w4,
    w3,
    w2,
    white,
    fantasticsWithoutWhite,
    checkpointHit,
    holdNone,
    letGo,
    held,
    missed,
    totalHolds,
  ] = numbers as number[];

  return {
    song,
    playerNumber,
    playerName,
    actualDancePoints,
    currentPossibleDancePoints,
    possibleDancePoints,
    formattedScore: fields[6].trim(),
    life,
    isFailed: fields[8].trim() === "1",
    taps: {
      none,
      hitMine,
      avoidMine,
      checkpointMiss,
      miss,
      w5,
      w4,
      w3,
      w2,
      white,
      fantasticsWithoutWhite,
      checkpointHit,
    },
    holds: { none: holdNone, letGo, held, missed },
    totalHolds,
  };
}

/**
 * The name a cabinet plays under, without the team suffix the venue profiles
 * carry. Tournament Manager matches a run to a participant by name, and the
 * roster holds the person rather than the person and their team.
 */
function profileName(value: string): string {
  return (value ?? "").split("~ Team")[0].trim();
}

function integer(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
