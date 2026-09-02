/**
 * The levels a draw asks for, as somebody writes them.
 *
 * `9,9,10,10`, `9 9 10 10` and `9-9-10-10` all say the same thing: four songs,
 * two of each level. Anything between the numbers separates them, so nobody has
 * to be told which separator this field wants. The API parses the same way, so
 * a level list means the same on both sides.
 */
export function parseRollLevels(text: string): number[] {
    return text
        .split(/[^0-9]+/)
        .filter((part) => part.length > 0)
        .map((part) => parseInt(part, 10));
}

/** The levels written back into the field, after a card was taken out of the draw. */
export function formatRollLevels(levels: number[]): string {
    return levels.join(', ');
}
