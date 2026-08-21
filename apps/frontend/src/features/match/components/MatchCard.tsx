import { Match, MatchAdvancementRuleInput, MatchHighlight } from "@/features/match/types/Match";
import { Division } from "@/features/division/types/Division";
import AddEditSongToMatchModal from "@/features/match/modals/AddEditSongToMatchModal";
import AddPlayersToMatchModal from "@/features/match/modals/AddPlayersToMatchModal";
import { useRef, useState } from "react";
import StandingModal from "@/features/match/modals/StandingModal";
import EditMatchNotesModal from "@/features/match/modals/EditMatchNotesModal";
import MatchHeader from "@/features/match/components/MatchHeader";
import MatchEmptySlots from "@/features/match/components/MatchEmptySlots";
import MatchTable from "@/features/match/components/MatchTable";
import AdvancementRulesEditor from "@/features/advancement/components/AdvancementRulesEditor";
import { getMatchCommitState } from "@/features/match/utils/matchStatus";
import { useManualScoring } from "@/features/match/hooks/useManualScoring";
import { entrantPlayers } from "@/features/entrant/types/Entrant";

type MatchCardProps = {
  division: Division;
  match: Match;
  allMatches: Match[];
  loadAdvancementTargets?: () => Promise<Match[]>;
  controls?: boolean;
  tournamentId?: number;
  highlight?: MatchHighlight;
  onHighlight?: (highlight: MatchHighlight) => void;
  enablePathRowHighlight?: boolean;
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
  onUpdateMatchAdvancementRules?: (matchId: number, rules: MatchAdvancementRuleInput[]) => Promise<void>;
  onUpdateMatchActive?: (matchId: number, active: boolean) => Promise<void>;
  onReopenMatchResult?: (matchId: number) => Promise<void>;
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
  loadAdvancementTargets,
  controls = false,
  tournamentId,
  highlight = { matchId: null, phaseGroupId: null },
  onHighlight = () => {},
  enablePathRowHighlight = false,
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
  onUpdateMatchAdvancementRules,
  onUpdateMatchActive,
  onReopenMatchResult,
}: MatchCardProps) {
  const [addSongToMatchModalOpen, setAddSongToMatchModalOpen] = useState(false);
  const [addPlayersToMatchModalOpen, setAddPlayersToMatchModalOpen] = useState(false);
  const [editSongId, setEditSongId] = useState<number | null>(null);
  const [standingModal, setStandingModal] = useState<StandingModalState>(closedModal);
  const [editMatchNotesModalOpen, setEditMatchNotesModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pendingAdvancementRules, setPendingAdvancementRules] = useState<MatchAdvancementRuleInput[]>([]);
  const [advancementTargetMatches, setAdvancementTargetMatches] = useState<Match[] | null>(null);
  const manualScoring = useManualScoring(match.id);
  const manualPoints = manualScoring.enabled ? manualScoring.points : {};

  const cardRef = useRef<HTMLDivElement>(null);

  const isHighlighted = match.id === highlight.matchId;
  const commitState = getMatchCommitState(match, manualPoints);
  const hasManualDraftPoints = Object.values(manualPoints).some((points) => points > 0);
  const matchPlayers = entrantPlayers(match.entrants);
  const hasIncomingRoutes = (match.advancementRules ?? []).some(
    (rule) => rule.targetKind === "match" && rule.targetId === match.id,
  );
  /* Nothing in it at all — not even a route feeding it — so the card shows the
     shape the match is about to take rather than an empty table. */
  const showEmptySlots =
    controls &&
    !match.matchResult &&
    !editMode &&
    match.rounds.length === 0 &&
    matchPlayers.length === 0 &&
    !hasIncomingRoutes &&
    !manualScoring.enabled;

  function enterEditMode() {
    setPendingAdvancementRules(
      (match.advancementRules ?? [])
        .filter((rule) => rule.sourceKind === "match" && rule.sourceId === match.id)
        .map((rule) => ({
          sourcePlacement: rule.sourcePlacement,
          targetKind: rule.targetKind,
          targetId: rule.targetId,
          targetSlot: rule.targetSlot,
        })),
    );
    setAdvancementTargetMatches(allMatches);
    setEditMode(true);
    loadAdvancementTargets?.()
      .then(setAdvancementTargetMatches)
      .catch(() => setAdvancementTargetMatches(allMatches));
  }

  function cancelEditMode() {
    setEditMode(false);
    setPendingAdvancementRules([]);
    setAdvancementTargetMatches(null);
  }

  async function saveEditMode() {
    if (onUpdateMatchAdvancementRules) {
      await onUpdateMatchAdvancementRules(match.id, pendingAdvancementRules);
    }
    onMatchUpdated();
    setEditMode(false);
    setPendingAdvancementRules([]);
    setAdvancementTargetMatches(null);
  }

  function openAddSong() {
    if (match.matchResult) return;
    if (match.rounds.length === 0 && hasManualDraftPoints) {
      const confirmed = window.confirm("Manual points will be reset before adding songs. Continue?");
      if (!confirmed) return;
      manualScoring.clear();
    }
    setAddSongToMatchModalOpen(true);
  }

  function toggleManualScoring() {
    if (!controls) return;
    if (manualScoring.enabled && hasManualDraftPoints) {
      const confirmed = window.confirm("Points assigned by hand will be discarded. Continue?");
      if (!confirmed) return;
    }
    manualScoring.setEnabled(!manualScoring.enabled);
  }

  async function toggleActive() {
    if (!controls) return;
    await onUpdateMatchActive?.(match.id, !match.active);
  }

  async function reopenMatch() {
    if (!controls || commitState !== "Completed") return;
    await onReopenMatchResult?.(match.id);
    manualScoring.clear();
  }

  return (
    <div
      ref={cardRef}
      className={`group/match flex flex-col w-full p-4 my-3 border rounded-xl bg-ui-surface shadow-sm transition-shadow ${
        isHighlighted
          ? "border-ui-border-strong ring-2 ring-ui-border-strong shadow-ui-border shadow-lg"
          : "border-ui-border"
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
        commitState={commitState}
        showAddActions={!showEmptySlots}
        canAddSong={matchPlayers.length > 0}
        manualScoringEnabled={manualScoring.enabled}
        onToggleManualScoring={toggleManualScoring}
        onOpenEditNotes={() => setEditMatchNotesModalOpen(true)}
        onDeleteMatch={onDeleteMatch}
        onOpenAddSong={openAddSong}
        onOpenAddPlayer={() => setAddPlayersToMatchModalOpen(true)}
        onRenameMatch={onRenameMatch}
        canEditAdvancementRules={controls && !editMode}
        onEditAdvancementRules={enterEditMode}
        onToggleActive={toggleActive}
        onReopenMatch={reopenMatch}
      />

      {editMode && (
        <AdvancementRulesEditor
          sourceKind="match"
          sourceId={match.id}
          rules={pendingAdvancementRules}
          division={division}
          allMatches={advancementTargetMatches ?? allMatches}
          onChange={setPendingAdvancementRules}
          onSave={saveEditMode}
          onCancel={cancelEditMode}
        />
      )}

      {showEmptySlots && (
        <MatchEmptySlots
          canAddSong={matchPlayers.length > 0}
          onAddSong={openAddSong}
          onAddPlayer={() => setAddPlayersToMatchModalOpen(true)}
        />
      )}

      {!editMode && !showEmptySlots && (
        <MatchTable
          match={match}
          division={division}
          allMatches={allMatches}
          controls={controls}
          highlight={highlight}
          onHighlight={onHighlight}
          enablePathRowHighlight={enablePathRowHighlight}
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
          manualScoringEnabled={manualScoring.enabled}
          manualPoints={manualPoints}
          onManualPointsChange={manualScoring.setPoints}
        />
      )}

      {manualScoring.enabled && !match.matchResult && !editMode && (
        /* Said plainly, because the draft looks exactly like saved data and is
           not: it lives on this device until a commit sends it. */
        <p className="mt-2 text-xs text-ui-text-mute">
          Scored by hand. These points stay on this device until you commit the match — nobody else sees them yet.
        </p>
      )}
    </div>
  );
}
