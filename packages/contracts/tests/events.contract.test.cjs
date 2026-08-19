const assert = require('node:assert/strict');
const test = require('node:test');
const { isEventEnvelope } = require('../dist/index.js');

const event = {
  id: 'a55e6bb3-b284-4b02-9841-534c9870645e',
  type: 'tournament.created',
  aggregateId: '42',
  payload: { tournamentId: 42, name: 'Contract tournament' },
};

test('accepts the minimal routing and idempotency fields', () => {
  assert.equal(isEventEnvelope(event), true);
});

test('rejects unreadable envelopes without revalidating internal payloads', () => {
  assert.equal(isEventEnvelope({ ...event, id: undefined }), false);
  assert.equal(isEventEnvelope({ ...event, type: undefined }), false);
  assert.equal(isEventEnvelope({ ...event, aggregateId: undefined }), false);
  assert.equal(isEventEnvelope({ ...event, payload: undefined }), true);
  const { payload: _payload, ...withoutPayload } = event;
  assert.equal(isEventEnvelope(withoutPayload), false);
});
