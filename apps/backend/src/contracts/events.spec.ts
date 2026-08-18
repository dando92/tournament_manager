import { isEventEnvelope } from './events';

describe('internal event envelope', () => {
  const event = {
    id: 'a55e6bb3-b284-4b02-9841-534c9870645e',
    type: 'tournament.created',
    aggregateId: '42',
    payload: { tournamentId: 42, name: 'Contract tournament' },
  };

  it('accepts the minimal routing and idempotency fields', () => {
    expect(isEventEnvelope(event)).toBe(true);
  });

  it('rejects unreadable transport envelopes without validating internal payloads', () => {
    expect(isEventEnvelope({ ...event, id: undefined })).toBe(false);
    expect(isEventEnvelope({ ...event, type: undefined })).toBe(false);
    expect(isEventEnvelope({ ...event, aggregateId: undefined })).toBe(false);
    expect(isEventEnvelope({ ...event, payload: undefined })).toBe(true);
    const { payload: _payload, ...withoutPayload } = event;
    expect(isEventEnvelope(withoutPayload)).toBe(false);
  });
});
