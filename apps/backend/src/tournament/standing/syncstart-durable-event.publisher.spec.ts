import { ConfigService } from '@nestjs/config';
import { DurableEventTransport } from '../../eventing/eventing.interfaces';
import { SyncStartDurableEventPublisher } from './syncstart-durable-event.publisher';

describe('SyncStartDurableEventPublisher', () => {
  it('maps a completed song to the internal durable envelope', async () => {
    const transport = {
      publish: jest.fn().mockResolvedValue('1-0'),
    } as unknown as DurableEventTransport;
    const publisher = new SyncStartDurableEventPublisher(
      new ConfigService({ EVENT_STREAM: 'test-events' }),
      transport,
    );
    const event = {
      tournamentId: 42,
      lobbyId: 'ABCD',
      lobbyName: 'Finals',
      lobbyCode: 'ABCD',
      song: {
        songPath: 'Test Song',
        title: 'Test Song',
        artist: 'Artist',
        songLength: 120,
      },
      scores: [
        {
          playerId: 'player-1',
          playerName: 'Player One',
          score: 1000,
          exScore: 99,
          isFailed: false,
        },
      ],
    };

    await publisher.OnSongCompleted(event);

    expect(transport.publish).toHaveBeenCalledWith(
      'test-events',
      expect.objectContaining({
        type: 'syncstart.song-completed',
        aggregateId: '42',
        payload: event,
      }),
    );
    const durableEvent = (transport.publish as jest.Mock).mock.calls[0][1];
    expect(durableEvent.id).toEqual(expect.any(String));
  });
});
