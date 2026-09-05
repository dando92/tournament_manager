/**
 * The countries a player may be from, derived rather than listed.
 *
 * `Player.nationality` is ISO 3166-1 alpha-2, so the only list this needs is the
 * set of assigned codes — and the browser already has it. Walking `AA` to `ZZ`
 * and asking `Intl.DisplayNames` for a name gives back the code itself when it
 * is unassigned, which is the whole filter. Six hundred and seventy-six lookups
 * once at module load, against a two hundred line table that would go stale.
 *
 * The names are the browser's, so they follow the reader's own conventions
 * rather than a translation we would have to maintain. What comes back is not
 * only countries — CLDR also names groupings and its own test codes — so the
 * handful that are not somewhere a person is from are removed by name.
 */

const NOT_A_COUNTRY = new Set(['EU', 'QO', 'UN', 'XA', 'XB', 'ZZ']);

export type Country = {
    code: string;
    name: string;
};

function assignedCountries(): Country[] {
    const names = new Intl.DisplayNames(undefined, { type: 'region' });
    const countries: Country[] = [];

    for (let first = 65; first <= 90; first += 1) {
        for (let second = 65; second <= 90; second += 1) {
            const code = String.fromCharCode(first, second);
            if (NOT_A_COUNTRY.has(code)) {
                continue;
            }

            const name = safeName(names, code);
            if (name && name !== code) {
                countries.push({ code, name });
            }
        }
    }

    return countries.sort((left, right) => left.name.localeCompare(right.name));
}

/** `DisplayNames` throws on a malformed code rather than answering, so it is asked defensively. */
function safeName(names: Intl.DisplayNames, code: string): string | undefined {
    try {
        return names.of(code);
    } catch {
        return undefined;
    }
}

export const COUNTRIES: readonly Country[] = assignedCountries();

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

/** The country's name, or the code itself when it names nothing we know. */
export function countryName(code: string): string {
    return BY_CODE.get(code.toUpperCase())?.name ?? code;
}
