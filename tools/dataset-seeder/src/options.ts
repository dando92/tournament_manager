/**
 * The shapes a measured database can have, and how the command line picks one.
 *
 * Three profiles, because they fail differently. `venue` is one tournament day
 * and is what a schedule and a pool projection are measured on. `stress` is the
 * same shape an order of magnitude larger, which is the point: a ratio between
 * two runs of the same shape says whether a cost grows with the installation,
 * and a ratio between two different shapes says nothing at all. `season` is
 * archive weight — many closed tournaments and a great many entrants with no
 * matches — which is the shape that exposes a read growing with the history
 * rather than with the pool.
 */
export type ProfileName = 'venue' | 'season' | 'stress';

export type Profile = {
    name: ProfileName;
    /** Tournaments under way, each with its own structure, matches and boards. */
    tournaments: number;
    /** Closed tournaments carrying entrants and no competition. */
    closedTournaments: number;
    divisionsPerClosedTournament: number;
    entrantsPerClosedDivision: number;
    /** The shape of each tournament under way. */
    divisions: number;
    /** Divisions played to the end, so a final placement can be read off them. */
    completedDivisions: number;
    entrantsPerDivision: number;
    phasesPerDivision: number;
    poolsPerPhase: number;
    matchesPerPool: number;
    songs: number;
    setups: number;
    schedules: number;
    entriesPerSchedule: number;
};

const PROFILES: Record<ProfileName, Profile> = {
    /* One tournament day: ~200 competitors, eight divisions, four cabinets,
       schedules of about forty entries, one of them running mid-course. */
    venue: {
        name: 'venue',
        tournaments: 1,
        closedTournaments: 0,
        divisionsPerClosedTournament: 0,
        entrantsPerClosedDivision: 0,
        divisions: 8,
        completedDivisions: 1,
        entrantsPerDivision: 25,
        phasesPerDivision: 2,
        poolsPerPhase: 4,
        matchesPerPool: 5,
        songs: 120,
        setups: 4,
        schedules: 4,
        entriesPerSchedule: 36,
    },
    /* Archive weight. The open tournament is deliberately small: what this
       profile measures is everything that has already happened. */
    season: {
        name: 'season',
        tournaments: 1,
        closedTournaments: 60,
        divisionsPerClosedTournament: 8,
        entrantsPerClosedDivision: 45,
        divisions: 4,
        completedDivisions: 1,
        entrantsPerDivision: 20,
        phasesPerDivision: 2,
        poolsPerPhase: 3,
        matchesPerPool: 4,
        songs: 90,
        setups: 4,
        schedules: 2,
        entriesPerSchedule: 20,
    },
    /* An order of magnitude above `venue`, to find where it breaks. Raise it
       further with --scale; the shape of a division does not change with it. */
    stress: {
        name: 'stress',
        tournaments: 1,
        closedTournaments: 0,
        divisionsPerClosedTournament: 0,
        entrantsPerClosedDivision: 0,
        divisions: 40,
        completedDivisions: 1,
        entrantsPerDivision: 50,
        phasesPerDivision: 3,
        poolsPerPhase: 8,
        matchesPerPool: 12,
        songs: 400,
        setups: 16,
        schedules: 12,
        entriesPerSchedule: 60,
    },
};

export type Options = {
    profile: Profile;
    seed: number;
    reset: boolean;
    tournamentName: string;
    /** A tournament id to add to, `'last'` for the most recent one, or nothing. */
    into: number | 'last' | null;
};

const USAGE = `
Usage: npm run seed:dataset -- [options]

  --profile <venue|season|stress>  Which shape to write. Default: venue.
  --seed <number>                  Generator seed. Default: 20260904.
  --tournaments <number>           How many tournaments are under way, each
                                   with the profile's full structure, matches
                                   and boards. Default: the profile's own.
  --completed <number>             How many divisions of each tournament are
                                   played to the end, as a single-elimination
                                   bracket. Default: the profile's own.
  --scale <number>                 Multiplies the structural counts. Default: 1.
  --into <id|last>                 Add the profile's divisions, matches and
                                   boards to a tournament that already exists
                                   instead of creating one.
  --reset                          Empty every data table first. Accounts and
                                   applied migrations are kept.
  --name <text>                    Name of the tournament under way.
  --help                           This text.

Every run appends. Without --reset the database keeps what it holds, so the
same command run again adds another tournament, and --into adds to one that is
already there. The seed is offset by the tournaments already present, so
repeated runs differ from one another while a given sequence of commands from a
reset database still reproduces row for row.

Database connection: DATABASE_HOST, DATABASE_PORT, DATABASE_USER,
DATABASE_PASSWORD, DATABASE_NAME, DATABASE_SSL — the same variables the
migration runner reads.
`;

export function parseOptions(argv: string[]): Options | null {
    if (argv.includes('--help') || argv.includes('-h')) {
        console.log(USAGE.trim());

        return null;
    }

    const profileName = (value(argv, 'profile') ?? 'venue') as ProfileName;
    if (!PROFILES[profileName]) {
        throw new Error(`Unknown profile "${profileName}". Known profiles: ${Object.keys(PROFILES).join(', ')}.`);
    }

    const scale = Number(value(argv, 'scale') ?? 1);
    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error(`--scale must be a positive number, got "${value(argv, 'scale')}".`);
    }

    const tournaments = Number(value(argv, 'tournaments') ?? PROFILES[profileName].tournaments);
    if (!Number.isInteger(tournaments) || tournaments < 1) {
        throw new Error(`--tournaments must be a positive whole number, got "${value(argv, 'tournaments')}".`);
    }

    const completed = Number(value(argv, 'completed') ?? PROFILES[profileName].completedDivisions);
    if (!Number.isInteger(completed) || completed < 0) {
        throw new Error(`--completed must be a whole number, got "${value(argv, 'completed')}".`);
    }

    return {
        profile: { ...scaled(PROFILES[profileName], scale), tournaments, completedDivisions: completed },
        seed: Number(value(argv, 'seed') ?? 20260904),
        reset: argv.includes('--reset'),
        tournamentName: value(argv, 'name') ?? `Dataset ${profileName}`,
        into: parseInto(value(argv, 'into')),
    };
}

function parseInto(raw: string | undefined): number | 'last' | null {
    if (raw === undefined) {
        return null;
    }
    if (raw === 'last') {
        return 'last';
    }

    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
        throw new Error(`--into takes a tournament id or "last", got "${raw}".`);
    }

    return id;
}

/**
 * Scale multiplies how much of the installation there is, never how a single
 * division is built. A pool of a `stress` run holds the same twelve matches as
 * a pool of a `venue` run, so a cost that grows between the two grows with the
 * installation — which is the only thing a laptop can measure honestly.
 */
function scaled(profile: Profile, scale: number): Profile {
    if (scale === 1) {
        return profile;
    }

    return {
        ...profile,
        closedTournaments: Math.round(profile.closedTournaments * scale),
        divisions: Math.max(1, Math.round(profile.divisions * scale)),
        schedules: Math.max(1, Math.round(profile.schedules * scale)),
    };
}

function value(argv: string[], name: string): string | undefined {
    const index = argv.indexOf(`--${name}`);

    return index >= 0 ? argv[index + 1] : undefined;
}
