import axios from "axios";
import { AdvancementCompetitionKind, AdvancementRuleInput } from "@/features/match/types/Match";

export async function updateAdvancementRulesForSource(
  sourceKind: AdvancementCompetitionKind,
  sourceId: number,
  rules: AdvancementRuleInput[],
): Promise<void> {
  await axios.put(`advancement-rules/sources/${sourceKind}/${sourceId}`, { rules });
}
