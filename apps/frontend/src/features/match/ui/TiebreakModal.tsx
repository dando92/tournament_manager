import { useEffect, useMemo, useState } from "react";

import { Match } from "@/features/match/model/types";
import { listSongs } from "@/features/song/api/song.api";
import { Song } from "@/features/song/model/types";
import BaseModal from "@/shared/components/ui/BaseModal";
import Select from "@/shared/components/ui/Select";
import { btnPrimary, btnSecondary } from "@/styles/buttonStyles";
import { displaySongTitle } from "@/features/song/model/songTitle";

type Props = {
  open: boolean;
  match: Match;
  tournamentId?: number;
  onClose: () => void;
  onCreate: (playerIds: number[], songId?: number) => Promise<void>;
};

export default function TiebreakModal({ open, match, tournamentId, onClose, onCreate }: Props) {
  const [tieIndex, setTieIndex] = useState(0);
  const [mode, setMode] = useState<"song" | "manual">("song");
  const [songs, setSongs] = useState<Song[]>([]);
  const [songId, setSongId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const ties = match.resultState.ambiguousTies;
  const playersById = useMemo(() => new Map(
    match.entrants.flatMap((entrant) => entrant.participants ?? [])
      .map((participant) => participant.player)
      .filter(Boolean)
      .map((player) => [player.id, player]),
  ), [match.entrants]);

  useEffect(() => {
    if (!open) return;
    setTieIndex(0);
    setMode("song");
    setSaving(false);
    listSongs(tournamentId)
      .then((catalog) => {
        setSongs(catalog);
        setSongId(catalog[0]?.id ?? null);
      })
      .catch(() => {
        setSongs([]);
        setSongId(null);
      });
  }, [open, tournamentId]);

  const tie = ties[tieIndex] ?? null;
  const footer = (
    <div className="flex justify-end gap-2">
      <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
      <button
        type="button"
        className={btnPrimary}
        disabled={!tie || saving || (mode === "song" && songId === null)}
        onClick={async () => {
          if (!tie) return;
          setSaving(true);
          try {
            await onCreate(tie.playerIds, mode === "song" ? songId ?? undefined : undefined);
            onClose();
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Creating…" : "Create tiebreak"}
      </button>
    </div>
  );

  return (
    <BaseModal open={open} onClose={onClose} title="Create tiebreak" footer={footer} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4 text-sm text-ui-text">
        {ties.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Tied placement</span>
            <Select
              value={tieIndex}
              onChange={(event) => setTieIndex(Number(event.target.value))}
            >
              {ties.map((candidate, index) => (
                <option key={candidate.playerIds.join("-")} value={index}>
                  Places {candidate.fromPlacement}–{candidate.toPlacement}
                </option>
              ))}
            </Select>
          </label>
        )}

        {tie && (
          <div>
            <div className="mb-1 font-semibold">Players</div>
            <div className="text-ui-text-soft">
              {tie.playerIds.map((playerId) => playersById.get(playerId)?.playerName ?? `Player ${playerId}`).join(" · ")}
            </div>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 font-semibold">Resolution method</legend>
          <div className="flex gap-4">
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" checked={mode === "song"} onChange={() => setMode("song")} />
              Song
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} />
              By hand
            </label>
          </div>
        </fieldset>

        {mode === "song" && (
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold">Song</span>
            <Select
              value={songId ?? ""}
              onChange={(event) => setSongId(Number(event.target.value) || null)}
            >
              {songs.length === 0 && <option value="">No songs available</option>}
              {songs.map((song) => <option key={song.id} value={song.id}>{displaySongTitle(song.title)}</option>)}
            </Select>
          </label>
        )}
      </div>
    </BaseModal>
  );
}
