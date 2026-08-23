/**
 * The opcodes of the legacy UDP protocol, as `SyncStartManager.cpp` defines
 * them. The first byte of every datagram is one of these; the rest is UTF-8.
 */
export const LEGACY_OPCODE = {
  start: 0x00,
  song: 0x01,
  score: 0x02,
  marathonSongLoading: 0x03,
  marathonSongReady: 0x04,
  finalScore: 0x05,
  finalCourseScore: 0x06,
} as const;

export type LegacyOpcode = (typeof LEGACY_OPCODE)[keyof typeof LEGACY_OPCODE];

export function opcodeName(opcode: number): string {
  const entry = Object.entries(LEGACY_OPCODE).find(
    ([, value]) => value === opcode,
  );
  return entry
    ? entry[0]
    : `unknown(0x${opcode.toString(16).padStart(2, "0")})`;
}
