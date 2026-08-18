import { ReactNode } from "react";
import { Match } from "@/features/match/types/Match";

type RawMatchCardsViewProps = {
  matches: Match[];
  renderMatchCard: (match: Match) => ReactNode;
};

export default function RawMatchCardsView({ matches, renderMatchCard }: RawMatchCardsViewProps) {
  return (
    <div>
      {[...matches].sort((a, b) => a.id - b.id).map((match) => renderMatchCard(match))}
    </div>
  );
}
