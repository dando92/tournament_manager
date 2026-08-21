export function formatBracketType(bracketType: string | null | undefined): string | null {
  switch (bracketType) {
    case "SingleElimination":
    case "SINGLE_ELIMINATION":
      return "Single elimination";
    case "DoubleElimination":
    case "DOUBLE_ELIMINATION":
      return "Double elimination";
    case "RoundRobin":
    case "ROUND_ROBIN":
      return "Round robin";
    case "Swiss":
    case "SWISS":
      return "Swiss";
    case "CustomSchedule":
    case "CUSTOM_SCHEDULE":
      return "Custom schedule";
    default:
      return bracketType ?? null;
  }
}
