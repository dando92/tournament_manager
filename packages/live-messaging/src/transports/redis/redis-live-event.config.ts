import type { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

const DEFAULT_REDIS_HOST = '127.0.0.1';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_LIVE_EVENT_CHANNEL = 'tournament-manager.live';

export function createRedisClient(config: ConfigService): RedisClientType {
  return createClient({
    socket: {
      host: config.get<string>('REDIS_HOST') ?? DEFAULT_REDIS_HOST,
      port: Number(config.get<string>('REDIS_PORT') ?? DEFAULT_REDIS_PORT),
    },
  });
}

export function getLiveEventChannel(config: ConfigService): string {
  return (
    config.get<string>('LIVE_EVENT_CHANNEL') ?? DEFAULT_LIVE_EVENT_CHANNEL
  );
}
