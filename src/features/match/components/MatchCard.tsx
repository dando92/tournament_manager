import { Match, MatchState } from "@/features/match/types/Match";
import { Division } from "@/features/division/types/Division";
import AddEditSongToMatchModal from "@/features/match/modals/AddEditSongToMatchModal";
import AddPlayersToMatchModal from "@/features/match/modals/AddPlayersToMatchModal";
import { useEffect, useRef, useState } from "react";
import StandingModal from "@/features/match/modals/StandingModal";
import EditMatchNotesModal from "@/features/match/modals/EditMatchNotesModal";
import MatchHeader from "@/features/match/components/MatchHeader";
import MatchTable from "@/features/match/components/MatchTable";
import { useTournamentUpdates } from "@/features/tournament/context/TournamentUpdatesContext";

type MatchCardProps = {
  division: Division;
  match: Match;
  allMatches: Match[];
  controls?: boolean;
  tournamentId?: number;
  matchUpdateSignal?: number;
  highlightedMatchId?: number | null;
  onHighlightMatch?: (id: number | null) => void;
  onMatchUpdated: () => void;
  onDeleteMatch: (matchId: number) => void;
  onAddPlayersToMatch: (entrantIds: number[]) => Promise<void>;
  onAddSongToMatchByRoll: (group: string, level: string) => void;
  onAddSongToMatchBySongId: (songId: number) => void;
  onEditSongToMatchByRoll: (group: string, level: string, editSongId: number) => void;
  onEditSongToMatchBySongId: (songId: number, editSongId: number) => void;
  onDeleteSongFromMatch: (songId: number) => void;
  onAddStandingToMatch: (
    playerId: number,
    songId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
    scoreId?: number,
  ) => void;
  onEditMatchNotes: (matchId: number, notes: string) => void;
  onRenameMatch?: (matchId: number, name: string) => void;
  onEditStanding: (
    playerId: number,
    songId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
    scoreId?: number,
  ) => void;
  onDeleteStanding: (playerId: number, songId: number) => void;
  onUpdateMatchPaths?: (matchId: number, targetPaths: number[]) => Promise<void>;
  onUpdateMatchState?: (matchId: number, state: MatchState) => Promise<void>;
  onRefreshSelf?: () => void;
};

type StandingModalState = {
  open: boolean;
  mode: "add" | "edit";
  playerId: number;
  songId: number;
  playerName: string;
  songTitle: string;
  initialPercentage?: number;
  initialScore?: number;
  initialScoreId?: number;
  initialIsFailed?: boolean;
};

const closedModal: StandingModalState = {
  open: false,
  mode: "add",
  playerId: 0,
  songId: 0,
  playerName: "",
  songTitle: "",
};

export default function MatchCard({
  division,
  match,
  allMatches,
  controls = false,
  tournamentId,
  matchUpdateSignal,
  highlightedMatchId = null,
  onHighlightMatch = () => {},
  onMatchUpdated,
  onDeleteMatch,
  onAddPlayersToMatch,
  onAddSongToMatchByRoll,
  onAddSongToMatchBySongId,
  onEditSongToMatchByRoll,
  onEditSongToMatchBySongId,
  onDeleteSongFromMatch,
  onAddStandingToMatch,
  onEditMatchNotes,
  onRenameMatch,
  onDeleteStanding,
  onEditStanding,
  onUpdateMatchPaths,
  onUpdateMatchState,
  onRefreshSelf,
}: MatchCardProps) {
  const [addSongToMatchModalOpen, setAddSongToMatchModalOpen] = useState(false);
  const [addPlayersToMatchModalOpen, setAddPlayersToMatchModalOpen] = useState(false);
  const [editSongId, setEditSongId] = useState<number | null>(null);
  const [standingModal, setStandingModal] = useState<StandingModalState>(closedModal);
  const [editMatchNotesModalOpen, setEditMatchNotesModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pendingTargetPaths, setPendingTargetPaths] = useState<(number | null)[]>([]);

  const onMatchUpdatedRef = useRef(onMatchUpdated);
  useEffect(() => { onMatchUpdatedRef.current = onMatchUpdated; });

  useEffect(() => {
    if (!matchUpdateSignal) return;
    onMatchUpdatedRef.current();
  }, [matchUpdateSignal]);

  const cardRef = useRef<HTMLDivElement>(null);
  const { updatedMatchIds } = useTournamentUpdates();
  const onRefreshSelfRef = useRef(onRefreshSelf);
  useEffect(() => { onRefreshSelfRef.current = onRefreshSelf; });
  useEffect(() => {
    if (updatedMatchIds.has(match.id)) onRefreshSelfRef.current?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedMatchIds]);

  const maxPlayersPerMatch = division.playersPerMatch ?? 2;
  const isHighlighted = match.id === highlightedMatchId;
  const matchState = match.state ?? (match.matchResult ? "Completed" : "NotActive");
  const stateButtonLabel = {
    NotActive: "Click to activate",
    Active: "Active",
    Pending: "Commit match",
    Completed: "Re-open match",
  }[matchState];
  const stateButtonClass = {
    NotActive: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
    Active: "border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
    Pending: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    Completed: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
  }[matchState];

  function enterEditMode() {
    const existing = match.targetPaths ?? [];
    const initial: (number | null)[] = Array.from({ length: maxPlayersPerMatch }, (_, i) => {
      const id = existing[i];
      return id && id > 0 ? id : null;
    });
    setPendingTargetPaths(initial);
    setEditMode(true);
  }

  function cancelEditMode() {
    setEditMode(false);
    setPendingTargetPaths([]);
  }

  async function saveEditMode() {
    const newTargetPaths = pendingTargetPaths.map(v => v ?? 0);
    if (onUpdateMatchPaths) {
      await onUpdateMatchPaths(match.id, newTargetPaths);
    }
    onMatchUpdatedRef.current();
    setEditMode(false);
    setPendingTargetPaths([]);
  }

  async function toggleCurrentMatch() {
    if (!controls) return;

    const nextStateByState: Record<MatchState, MatchState> = {
      NotActive: "Active",
      Active: "NotActive",
      Pending: "Completed",
      Completed: "Pending",
    };
    const currentState = match.state ?? (match.matchResult ? "Completed" : "NotActive");
    const nextState = nextStateByState[currentState];

    await onUpdateMatchState?.(match.id, nextState);
  }

  return (
    <div
      ref={cardRef}
      className={`flex flex-col w-full p-4 my-3 border rounded-xl bg-white shadow-sm transition-shadow ${
        isHighlighted
          ? "border-green-400 ring-2 ring-green-300 shadow-green-100 shadow-lg"
          : "border-gray-100"
      }`}
    >
      <AddEditSongToMatchModal
        songId={editSongId}
        matchId={match.id}
        divisionId={division.id}
        tournamentId={tournamentId}
        open={addSongToMatchModalOpen}
        onAddSongToMatchByRoll={(_, __, group, level) => onAddSongToMatchByRoll(group, level)}
        onAddSongToMatchBySongId={(_, __, songId) => onAddSongToMatchBySongId(songId)}
        onEditSongToMatchByRoll={(_, __, group, level, editSongId) => onEditSongToMatchByRoll(group, level, editSongId)}
        onEditSongToMatchBySongId={(_, __, songId, editSongId) => onEditSongToMatchBySongId(songId, editSongId)}
        onClose={() => {
          setAddSongToMatchModalOpen(false);
          setEditSongId(null);
        }}
      />
      <AddPlayersToMatchModal
        open={addPlayersToMatchModalOpen}
        divisionEntrants={division.entrants ?? []}
        matchEntrants={match.entrants ?? []}
        onAddPlayers={onAddPlayersToMatch}
        onClose={() => setAddPlayersToMatchModalOpen(false)}
      />
      <StandingModal
        {...standingModal}
        onClose={() => setStandingModal(closedModal)}
        onSave={(playerId, songId, pct, score, isFailed, scoreId) => {
          if (standingModal.mode === "add") {
            onAddStandingToMatch(playerId, songId, pct, score, isFailed, scoreId);
          } else {
            onEditStanding(playerId, songId, pct, score, isFailed, scoreId);
          }
        }}
      />
      <EditMatchNotesModal
        match={match}
        open={editMatchNotesModalOpen}
        onClose={() => setEditMatchNotesModalOpen(false)}
        onSave={onEditMatchNotes}
      />

      <MatchHeader
        match={match}
        controls={controls}
        onOpenEditNotes={() => setEditMatchNotesModalOpen(true)}
        onDeleteMatch={onDeleteMatch}
        onOpenAddSong={() => setAddSongToMatchModalOpen(true)}
        onOpenAddPlayer={() => setAddPlayersToMatchModalOpen(true)}
        onRenameMatch={onRenameMatch}
        editMode={editMode}
        canEditRoutes={controls}
        onEditRoutes={enterEditMode}
        onSaveRoutes={saveEditMode}
        onCancelRoutes={cancelEditMode}
      />

      <MatchTable
        match={match}
        allMatches={allMatches}
        maxPlayersPerMatch={maxPlayersPerMatch}
        controls={controls}
        editMode={editMode}
        highlightedMatchId={highlightedMatchId}
        onHighlightMatch={onHighlightMatch}
        pendingTargetPaths={pendingTargetPaths}
        onPendingTargetPathChange={(index, value) => {
          setPendingTargetPaths((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
          });
        }}
        onDeleteSong={onDeleteSongFromMatch}
        onDeletePlayer={(entrantId) =>
          onAddPlayersToMatch(
            (match.entrants ?? [])
              .filter((entrant) => entrant.id !== entrantId)
              .map((entrant) => entrant.id),
          )
        }
        onOpenAddStanding={(playerId, songId, playerName, songTitle) =>
          setStandingModal({ open: true, mode: "add", playerId, songId, playerName, songTitle })
        }
        onOpenEditStanding={(playerId, songId, playerName, songTitle, scoreId, percentage, score, isFailed) =>
          setStandingModal({ open: true, mode: "edit", playerId, songId, playerName, songTitle, initialScoreId: scoreId, initialPercentage: percentage, initialScore: score, initialIsFailed: isFailed })
        }
        onDeleteStanding={onDeleteStanding}
      />

      {controls && (
        <button
          type="button"
          onClick={toggleCurrentMatch}
          className={`mt-2 w-full rounded-md border px-3 py-2 text-center text-xs font-semibold transition-colors cursor-pointer ${stateButtonClass}`}
        >
          {stateButtonLabel}
        </button>
      )}
    </div>
  );
}
