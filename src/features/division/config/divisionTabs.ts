export const DIVISION_TABS = [
  { key: "phases", label: "Phases" },
  { key: "entrants", label: "Entrants and Seeding" },
  { key: "standings", label: "Standings" },
] as const;

export type DivisionTabKey = (typeof DIVISION_TABS)[number]["key"];
