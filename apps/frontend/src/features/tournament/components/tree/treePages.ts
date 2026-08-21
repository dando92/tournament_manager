import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faChartColumn,
  faDesktop,
  faListOl,
  faMusic,
  faRankingStar,
  faTableColumns,
  faTowerBroadcast,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

/**
 * The destinations the tree offers, and where each one sits.
 *
 * Every icon here says only what a thing *is*, so all of them are drawn in the
 * neutral scale. Colour in the tree is reserved for the status glyph on a
 * structural node, which says what a thing is *doing*. See .ai/Design.md.
 *
 * `requiresControl` hides a destination from someone who cannot edit the
 * tournament — hiding rather than disabling, so the tree never offers a door
 * that does not open.
 */

export type TreePage = {
  key: string;
  label: string;
  icon: IconDefinition;
  requiresControl?: boolean;
};

export const TOURNAMENT_TREE_PAGES: readonly TreePage[] = [
  { key: "overview", label: "Overview", icon: faTableColumns },
  { key: "participants", label: "Participants", icon: faUsers, requiresControl: true },
  { key: "songs", label: "Songs", icon: faMusic },
  { key: "lobbies", label: "Lobbies", icon: faDesktop, requiresControl: true },
  { key: "live", label: "Live", icon: faTowerBroadcast },
  { key: "stats", label: "Stats", icon: faChartColumn },
];

/**
 * The division-level destinations.
 *
 * These are staged: entrants, seeding and standings still live here so nothing
 * breaks while the tree lands. Entrants and seeding are due to merge into the
 * tournament-level Roster page and standings into Stats, at which point a
 * division becomes pure structure with no page children at all.
 */
export const DIVISION_TREE_PAGES: readonly TreePage[] = [
  { key: "entrants", label: "Entrants", icon: faUsers },
  { key: "seeding", label: "Seeding", icon: faListOl },
  { key: "standings", label: "Standings", icon: faRankingStar },
];
