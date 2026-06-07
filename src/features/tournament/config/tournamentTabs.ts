export const TOURNAMENT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "participants", label: "Participants" },
  { key: "songs", label: "Songs" },
  { key: "lobbies", label: "Lobbies" },
  { key: "live", label: "Live" },
  { key: "stats", label: "Stats" },
  { key: "configuration", label: "Configuration" },
] as const;

export type TournamentTabKey = (typeof TOURNAMENT_TABS)[number]["key"];
