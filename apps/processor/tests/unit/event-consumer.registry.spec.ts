import { EventConsumerRegistry } from '@processor/eventing/event-consumer.registry';

describe('EventConsumerRegistry', () => {
  it('registers one consumer per event type and resolves it deterministically', () => {
    const registry = new EventConsumerRegistry();
    const consumer = {
      identity: 'projection',
      eventType: 'tournament.created',
      handle: jest.fn(),
    };

    registry.register(consumer);

    expect(
      registry.get({
        id: 'event-1',
        type: 'tournament.created',
        aggregateId: '7',
        payload: {},
      }),
    ).toBe(consumer);
    expect(() => registry.register({ ...consumer })).toThrow(
      'Event consumer tournament.created is already registered',
    );
  });
});
