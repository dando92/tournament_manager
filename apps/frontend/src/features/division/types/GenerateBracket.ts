export type { GenerateBracketResultDto } from "@tournament-manager/contracts";

export type GenerateBracketRequest = {
  divisionId: number;
  phaseName?: string;
  bracketType: string;
  playerPerMatch: number;
};

/** The bracket the API generated, told which division asked for it. */
export type GenerateBracketResult = {
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
};
