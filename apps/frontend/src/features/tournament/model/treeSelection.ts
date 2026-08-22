/**
 * Where the URL says we are in the tree.
 *
 * The tree is the navigation, so every node it can select has to be a real
 * address: a refresh, a bookmark or a link has to land back on the same branch.
 * Parsing the path in one place keeps the tree's highlight and the breadcrumb
 * from ever disagreeing about it.
 */

export type TreeSelection = {
  tournamentId: number;
  /** A tournament-level destination — "songs", "stats", "configuration". */
  page: string | null;
  divisionId: number | null;
  /** A division-level destination — "entrants" or "seeding". */
  divisionPage: string | null;
  phaseId: number | null;
  poolId: number | null;
};

const TOURNAMENT_PATH = /^\/tournament\/(\d+)(?:\/(.*))?$/;
const DIVISION_PATH = /^division\/(\d+)(?:\/(.*))?$/;
const PHASE_PATH = /^phase\/(\d+)(?:\/pool\/(\d+))?$/;

export function parseTreeSelection(pathname: string): TreeSelection | null {
  const tournament = pathname.replace(/\/+$/, "").match(TOURNAMENT_PATH);
  if (!tournament) return null;

  const tournamentId = Number(tournament[1]);
  const rest = tournament[2] ?? "";
  const empty: TreeSelection = {
    tournamentId,
    page: null,
    divisionId: null,
    divisionPage: null,
    phaseId: null,
    poolId: null,
  };

  const division = rest.match(DIVISION_PATH);
  if (!division) {
    return { ...empty, page: rest.split("/")[0] || null };
  }

  const divisionId = Number(division[1]);
  const tail = division[2] ?? "";
  const phase = tail.match(PHASE_PATH);
  if (phase) {
    return {
      ...empty,
      divisionId,
      phaseId: Number(phase[1]),
      poolId: phase[2] ? Number(phase[2]) : null,
    };
  }

  return { ...empty, divisionId, divisionPage: tail || null };
}

export function tournamentPagePath(tournamentId: number, page: string): string {
  return `/tournament/${tournamentId}/${page}`;
}

export function divisionPath(tournamentId: number, divisionId: number): string {
  return `/tournament/${tournamentId}/division/${divisionId}`;
}

export function divisionPagePath(tournamentId: number, divisionId: number, page: string): string {
  return `${divisionPath(tournamentId, divisionId)}/${page}`;
}

export function phasePath(tournamentId: number, divisionId: number, phaseId: number): string {
  return `${divisionPath(tournamentId, divisionId)}/phase/${phaseId}`;
}

export function poolPath(tournamentId: number, divisionId: number, phaseId: number, poolId: number): string {
  return `${phasePath(tournamentId, divisionId, phaseId)}/pool/${poolId}`;
}
