export const REPORT_BRACKET_SET_MUTATION = `
mutation ReportBracketSet($setId: ID!, $winnerId: ID!) {
  reportBracketSet(setId: $setId, winnerId: $winnerId) {
    id
    state
  }
}
`;
