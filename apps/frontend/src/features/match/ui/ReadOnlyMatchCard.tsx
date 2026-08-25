import type { Division } from "@/features/division/model/types";
import type { Match } from "@/features/match/model/types";
import MatchCard from "@/features/match/ui/MatchCard";

type Props = {
    division: Division;
    match: Match;
    allMatches: Match[];
};

const noop = () => {};
const noopAsync = async () => {};

export default function ReadOnlyMatchCard({ division, match, allMatches }: Props) {
    return (
        <MatchCard
            division={division}
            divisionEntrants={[]}
            match={match}
            allMatches={allMatches}
            controls={false}
            onMatchUpdated={noop}
            onDeleteMatch={noop}
            onAddPlayersToMatch={noopAsync}
            onAddRounds={noop}
            onReplaceRoundSong={noop}
            onDeleteRound={noop}
            onAddHandScoredRound={noop}
            onChangePoints={noop}
            onAddStandingToMatch={noop}
            onEditMatchNotes={noop}
            onUpdateMatchScoringSystem={noopAsync}
            onEditStanding={noop}
            onDeleteStanding={noop}
        />
    );
}
