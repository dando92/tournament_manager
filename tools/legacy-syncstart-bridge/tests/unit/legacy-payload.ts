/**
 * A legacy datagram payload, written field by field in the order
 * `SyncStartManager::writeScoreMessage` writes them. Every test that needs a
 * cabinet message builds it here, so a change to the wire order is one edit and
 * one failing expectation rather than twenty rewritten string literals.
 */
export type LegacyPayloadOverrides = {
  song?: string;
  playerNumber?: number;
  playerName?: string;
  actualDancePoints?: number;
  currentPossibleDancePoints?: number;
  possibleDancePoints?: number;
  formattedScore?: string;
  life?: number;
  isFailed?: boolean;
  none?: number;
  hitMine?: number;
  avoidMine?: number;
  checkpointMiss?: number;
  miss?: number;
  w5?: number;
  w4?: number;
  w3?: number;
  w2?: number;
  white?: number;
  fantasticsWithoutWhite?: number;
  checkpointHit?: number;
  holdNone?: number;
  letGo?: number;
  held?: number;
  missed?: number;
  totalHolds?: number;
};

export function legacyPayload(overrides: LegacyPayloadOverrides = {}): string {
  const field = {
    song: "5guys1pack/Earthquake",
    playerNumber: 0,
    playerName: "Alice",
    actualDancePoints: 4200,
    currentPossibleDancePoints: 4400,
    possibleDancePoints: 4400,
    formattedScore: "95.45",
    life: 1,
    isFailed: false,
    none: 0,
    hitMine: 0,
    avoidMine: 3,
    checkpointMiss: 0,
    miss: 2,
    w5: 1,
    w4: 4,
    w3: 9,
    w2: 20,
    white: 120,
    fantasticsWithoutWhite: 44,
    checkpointHit: 0,
    holdNone: 0,
    letGo: 1,
    held: 7,
    missed: 0,
    totalHolds: 9,
    ...overrides,
  };

  return [
    field.song,
    field.playerNumber,
    field.playerName,
    field.actualDancePoints,
    field.currentPossibleDancePoints,
    field.possibleDancePoints,
    field.formattedScore,
    field.life,
    field.isFailed ? "1" : "0",
    field.none,
    field.hitMine,
    field.avoidMine,
    field.checkpointMiss,
    field.miss,
    field.w5,
    field.w4,
    field.w3,
    field.w2,
    field.white,
    field.fantasticsWithoutWhite,
    field.checkpointHit,
    field.holdNone,
    field.letGo,
    field.held,
    field.missed,
    field.totalHolds,
  ].join("|");
}

/** An update sent before the first arrow: every counter is still zero. */
export function emptyLegacyPayload(
  overrides: LegacyPayloadOverrides = {},
): string {
  return legacyPayload({
    actualDancePoints: 0,
    currentPossibleDancePoints: 0,
    formattedScore: "0.00",
    none: 0,
    hitMine: 0,
    avoidMine: 0,
    checkpointMiss: 0,
    miss: 0,
    w5: 0,
    w4: 0,
    w3: 0,
    w2: 0,
    white: 0,
    fantasticsWithoutWhite: 0,
    checkpointHit: 0,
    holdNone: 0,
    letGo: 0,
    held: 0,
    missed: 0,
    ...overrides,
  });
}
