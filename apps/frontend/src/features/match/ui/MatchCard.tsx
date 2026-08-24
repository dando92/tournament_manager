import { Match, MatchAdvancementRuleInput, MatchHighlight, RoundSourceRequest } from "@/features/match/model/types";
import { Division } from "@/features/division/model/types";
import { Entrant } from "@/features/participant/model/types";
import AddEditSongToMatchModal from "@/features/match/ui/AddEditSongToMatchModal";
import AddPlayersToMatchModal from "@/features/match/ui/AddPlayersToMatchModal";
import { useEffect, useRef, useState } from "react";
import StandingModal from "@/features/match/ui/StandingModal";
import EditMatchNotesModal from "@/features/match/ui/EditMatchNotesModal";
import EditScoringSystemModal from "@/features/match/ui/EditScoringSystemModal";
import MatchHeader from "@/features/match/ui/MatchHeader";
import MatchEmptySlots from "@/features/match/ui/MatchEmptySlots";
import MatchTable from "@/features/match/ui/MatchTable";
import AdvancementRulesModal from "@/features/match/ui/AdvancementRulesModal";
import { getMatchCommitState } from "@/features/match/model/matchStatus";
import { entrantPlayers } from "@/features/participant/model/entrant";

type MatchCardProps = {
  division: Division;
  /** The division roster, read apart from its structure. Only the add-players dialog needs it. */
  divisionEntrants: Entrant[];
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
  onAddRounds: (sources: RoundSourceRequest[]) => void;
  onReplaceRoundSong: (roundId: number, source: RoundSourceRequest) => void;
  onDeleteRound: (roundId: number) => void;
  /** Adds the round with no song, the one whose points are written by hand. */
  onAddHandScoredRound: () => Promise<void> | void;
  onChangePoints: (playerId: number, roundId: number, points: number) => void;
  onAddStandingToMatch: (
    playerId: number,
    roundId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
    scoreId?: number,
  ) => void;
  onEditMatchNotes: (matchId: number, notes: string) => void;
  onUpdateMatchScoringSystem: (matchId: number, scoringSystem: string) => Promise<void>;
  onRenameMatch?: (matchId: number, name: string) => void;
  onEditStanding: (
    playerId: number,
    roundId: number,
    percentage: number,
    score: number,
    isFailed: boolean,
    scoreId?: number,
  ) => void;
  onDeleteStanding: (playerId: number, roundId: number) => void;
  onUpdateMatchAdvancementRules?: (matchId: number, rules: MatchAdvancementRuleInput[]) => Promise<void>;
  onUpdateMatchActive?: (matchId: number, active: boolean) => Promise<void>;
  onReopenMatchResult?: (matchId: number) => Promise<void>;
};

type StandingModalState = {
  open: boolean;
  mode: "add" | "edit";
  playerId: number;
  roundId: number;
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
  roundId: 0,
  songId: 0,
  playerName: "",
  songTitle: "",
};

export default function MatchCard({
  division,
  divisionEntrants,
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
  onAddRounds,
  onReplaceRoundSong,
  onDeleteRound,
  onAddHandScoredRound,
  onChangePoints,
  onAddStandingToMatch,
  onEditMatchNotes,
  onUpdateMatchScoringSystem,
  onRenameMatch,
  onDeleteStanding,
  onEditStanding,
  onUpdateMatchAdvancementRules,
  onUpdateMatchActive,
  onReopenMatchResult,
}: MatchCardProps) {
  const [addSongToMatchModalOpen, setAddSongToMatchModalOpen] = useState(false);
  const [addPlayersToMatchModalOpen, setAddPlayersToMatchModalOpen] = useState(false);
  const [editRoundId, setEditRoundId] = useState<number | null>(null);
  const [standingModal, setStandingModal] = useState<StandingModalState>(closedModal);
  const [editMatchNotesModalOpen, setEditMatchNotesModalOpen] = useState(false);
  const [editScoringSystemModalOpen, setEditScoringSystemModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savingAdvancementRules, setSavingAdvancementRules] = useState(false);
  const [pendingAdvancementRules, setPendingAdvancementRules] = useState<MatchAdvancementRuleInput[]>([]);
  const [advancementTargetMatches, setAdvancementTargetMatches] = useState<Match[] | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /* Hand scoring is no longer a switch this card remembers: it is the round
     with no song, which everyone looking at the match can see. */
  const handScoredRound = match.rounds.find((round) => round.song === null) ?? null;
  const isHighlighted = match.id === highlight.matchId;
  const commitState = getMatchCommitState(match);
  const matchPlayers = entrantPlayers(match.entrants);
  const hasIncomingRoutes = (match.advancementRules ?? []).some(
    (rule) => rule.targetKind === "match" && rule.targetId === match.id,
  );
  /* Nothing in it at all — not even a route feeding it — so the card shows the
     shape the match is about to take rather than an empty table. */
  const showEmptySlots =
    controls &&
    !match.matchResult &&
    match.rounds.length === 0 &&
    matchPlayers.length === 0 &&
    !hasIncomingRoutes;

  useEffect(() => {
    if (!isHighlighted) return;
    cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isHighlighted]);

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
    setSavingAdvancementRules(true);
    try {
      if (onUpdateMatchAdvancementRules) {
        await onUpdateMatchAdvancementRules(match.id, pendingAdvancementRules);
      }
      onMatchUpdated();
      setEditMode(false);
      setPendingAdvancementRules([]);
      setAdvancementTargetMatches(null);
    } finally {
      setSavingAdvancementRules(false);
    }
  }

  function openAddSong() {
    if (match.matchResult || handScoredRound) return;
    setAddSongToMatchModalOpen(true);
  }

  /**
   * Turning hand scoring on and off is adding and removing its round. A match
   * is scored one way or the other, so the action is refused while songs are
   * in — the same rule the API enforces.
   */
  async function toggleHandScoring() {
    if (!controls || match.matchResult) return;

    if (handScoredRound) {
      if ((handScoredRound.standings ?? []).some((standing) => standing.points > 0)) {
        const confirmed = window.confirm("Points assigned by hand will be deleted. Continue?");
        if (!confirmed) return;
      }
      onDeleteRound(handScoredRound.id);
      return;
    }

    if (match.rounds.length > 0) return;
    await onAddHandScoredRound();
  }

  /** The standing modal offers the scores a player already has on that song. */
  function songIdOfRound(roundId: number): number {
    return match.rounds.find((round) => round.id === roundId)?.song?.id ?? 0;
  }

  async function toggleActive() {
    if (!controls) return;
    await onUpdateMatchActive?.(match.id, !match.active);
  }

  async function reopenMatch() {
    if (!controls || commitState !== "Completed") return;
    await onReopenMatchResult?.(match.id);
  }

  return (
    <div
      ref={cardRef}
      className={`group/match flex flex-col w-full p-4 my-3 border rounded-xl bg-ui-surface shadow-sm transition-shadow ${
        isHighlighted
          ? "border-state-done/40 ring-2 ring-state-done/40 shadow-state-done/20 shadow-lg"
          : "border-ui-border"
      }`}
    >
      <AddEditSongToMatchModal
        editingRoundId={editRoundId}
        tournamentId={tournamentId}
        open={addSongToMatchModalOpen}
        onAddRounds={onAddRounds}
        onReplaceRoundSong={onReplaceRoundSong}
        onClose={() => {
          setAddSongToMatchModalOpen(false);
          setEditRoundId(null);
        }}
      />
      <AddPlayersToMatchModal
        open={addPlayersToMatchModalOpen}
        divisionEntrants={divisionEntrants}
        matchEntrants={match.entrants ?? []}
        onAddPlayers={onAddPlayersToMatch}
        onClose={() => setAddPlayersToMatchModalOpen(false)}
      />
      <StandingModal
        {...standingModal}
        onClose={() => setStandingModal(closedModal)}
        onSave={(playerId, roundId, pct, score, isFailed, scoreId) => {
          if (standingModal.mode === "add") {
            onAddStandingToMatch(playerId, roundId, pct, score, isFailed, scoreId);
          } else {
            onEditStanding(playerId, roundId, pct, score, isFailed, scoreId);
          }
        }}
      />
      <EditMatchNotesModal
        match={match}
        open={editMatchNotesModalOpen}
        onClose={() => setEditMatchNotesModalOpen(false)}
        onSave={onEditMatchNotes}
      />
      <EditScoringSystemModal
        match={match}
        open={editScoringSystemModalOpen}
        onClose={() => setEditScoringSystemModalOpen(false)}
        onSave={onUpdateMatchScoringSystem}
      />
      <AdvancementRulesModal
        open={editMode}
        sourceKind="match"
        sourceId={match.id}
        rules={pendingAdvancementRules}
        division={division}
        allMatches={advancementTargetMatches ?? allMatches}
        saving={savingAdvancementRules}
        onChange={setPendingAdvancementRules}
        onSave={saveEditMode}
        onCancel={cancelEditMode}
      />

      <MatchHeader
        match={match}
        controls={controls}
        commitState={commitState}
        showAddActions={!showEmptySlots}
        canAddSong={matchPlayers.length > 0 && handScoredRound === null}
        handScored={handScoredRound !== null}
        canToggleHandScoring={handScoredRound !== null || match.rounds.length === 0}
        onToggleHandScoring={toggleHandScoring}
        onOpenEditNotes={() => setEditMatchNotesModalOpen(true)}
        onOpenEditScoringSystem={() => setEditScoringSystemModalOpen(true)}
        onDeleteMatch={onDeleteMatch}
        onOpenAddSong={openAddSong}
        onOpenAddPlayer={() => setAddPlayersToMatchModalOpen(true)}
        onRenameMatch={onRenameMatch}
        canEditAdvancementRules={controls && !editMode}
        onEditAdvancementRules={enterEditMode}
        onToggleActive={toggleActive}
        onReopenMatch={reopenMatch}
      />

      {showEmptySlots && (
        <MatchEmptySlots
          canAddSong={matchPlayers.length > 0}
          onAddSong={openAddSong}
          onAddPlayer={() => setAddPlayersToMatchModalOpen(true)}
        />
      )}

      {!showEmptySlots && (
        <MatchTable
          match={match}
          division={division}
          allMatches={allMatches}
          controls={controls}
          highlight={highlight}
          onHighlight={onHighlight}
          enablePathRowHighlight={enablePathRowHighlight}
          onDeleteRound={onDeleteRound}
          onDeletePlayer={(entrantId) =>
            onAddPlayersToMatch(
              (match.entrants ?? [])
                .filter((entrant) => entrant.id !== entrantId)
                .map((entrant) => entrant.id),
            )
          }
          onOpenAddStanding={(playerId, roundId, playerName, songTitle) =>
            setStandingModal({ open: true, mode: "add", playerId, roundId, songId: songIdOfRound(roundId), playerName, songTitle })
          }
          onOpenEditStanding={(playerId, roundId, playerName, songTitle, scoreId, percentage, score, isFailed) =>
            setStandingModal({ open: true, mode: "edit", playerId, roundId, songId: songIdOfRound(roundId), playerName, songTitle, initialScoreId: scoreId, initialPercentage: percentage, initialScore: score, initialIsFailed: isFailed })
          }
          onDeleteStanding={onDeleteStanding}
          onChangePoints={onChangePoints}
        />
      )}
    </div>
  );
}
