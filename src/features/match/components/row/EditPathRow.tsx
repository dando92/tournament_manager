import { Match } from "@/features/match/types/Match";
import { MatchAdvancementRuleInput } from "@/features/match/types/Match";
import { toOrdinal } from "@/shared/utils";

type EditPathRowProps = {
  index: number;
  value: MatchAdvancementRuleInput | null;
  allMatches: Match[];
  currentMatchId: number;
  onChange: (value: MatchAdvancementRuleInput | null) => void;
  onHighlightMatch: (id: number | null) => void;
};

export default function EditPathRow({ index, value, allMatches, currentMatchId, onChange, onHighlightMatch }: EditPathRowProps) {
  const availableMatches = allMatches.filter((m) => m.id !== currentMatchId);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const matchId = e.target.value ? Number(e.target.value) : null;
    onChange(matchId ? { sourcePlacement: index + 1, targetId: matchId, targetSlot: value?.targetSlot ?? index + 1 } : null);
    onHighlightMatch(matchId);
  }

  function handleSlotChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!value) return;
    onChange({ ...value, targetSlot: Math.max(1, Number(e.target.value) || 1) });
  }

  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2">
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500 shrink-0 w-20">{toOrdinal(index + 1)} place</span>
          <select
            value={value?.targetId ?? ""}
            onChange={handleChange}
            className="flex-1 text-sm text-center border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">— None —</option>
            {availableMatches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={value?.targetSlot ?? index + 1}
            disabled={!value}
            onChange={handleSlotChange}
            className="w-16 text-sm text-center border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
      </td>
    </tr>
  );
}
