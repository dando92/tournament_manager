export type GenerateBracketRequest = {
  divisionId: number;
  phaseName?: string;
  bracketType: string;
  playerPerMatch: number;
};

export type GenerateBracketResult = {
  divisionId: number;
  phaseId: number;
  phaseGroupId: number;
};
