import { isEventEnvelope, isTournamentCreatedV1 } from './events';

describe('versioned event contracts', () => {
  const event = {
    id: 'a55e6bb3-b284-4b02-9841-534c9870645e',
    type: 'tournament.created',
    version: 1,
    aggregateId: '42',
    occurredAt: '2026-08-18T20:00:00.000Z',
    correlationId: 'a55e6bb3-b284-4b02-9841-534c9870645e',
    causationId: null,
    payload: { tournamentId: 42, name: 'Contract tournament' },
  };

  it('accepts the complete durable envelope and tournament.created v1 payload', () => {
    expect(isEventEnvelope(event)).toBe(true);
    expect(isTournamentCreatedV1(event)).toBe(true);
  });

  it('rejects missing observability metadata and incompatible payload versions', () => {
    const { correlationId: _correlationId, ...withoutCorrelation } = event;
    expect(isEventEnvelope(withoutCorrelation)).toBe(false);
    expect(isTournamentCreatedV1({ ...event, version: 2 })).toBe(false);
    expect(
      isTournamentCreatedV1({
        ...event,
        payload: { tournamentId: '42', name: 'Invalid' },
      }),
    ).toBe(false);
  });
});
