import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { LiveEventEnvelope } from '@tournament-manager/contracts';
export const LIVE_EVENT_PUBLISHER = Symbol('LIVE_EVENT_PUBLISHER');
export const LIVE_EVENT_SUBSCRIBER = Symbol('LIVE_EVENT_SUBSCRIBER');
export interface LiveEventPublisher { publish(event: LiveEventEnvelope): Promise<void>; }
export interface LiveEventSubscriber { subscribe(handler: (event: LiveEventEnvelope) => void | Promise<void>): Promise<() => Promise<void>>; }
@Injectable()
export class RedisLiveEventPublisher implements LiveEventPublisher, OnModuleDestroy {
  private readonly client: RedisClientType; private readonly channel: string;
  constructor(config: ConfigService) { this.client = createClient({ socket: { host: config.get('REDIS_HOST') ?? '127.0.0.1', port: Number(config.get('REDIS_PORT') ?? 6379) } }); this.channel = config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live'; }
  async publish(event: LiveEventEnvelope): Promise<void> { if (!this.client.isOpen) await this.client.connect(); await this.client.publish(this.channel, JSON.stringify(event)); }
  async onModuleDestroy(): Promise<void> { if (this.client.isOpen) await this.client.quit(); }
}
@Injectable()
export class RedisLiveEventSubscriber implements LiveEventSubscriber, OnModuleDestroy {
  private readonly client: RedisClientType; private readonly channel: string;
  constructor(config: ConfigService) { this.client = createClient({ socket: { host: config.get('REDIS_HOST') ?? '127.0.0.1', port: Number(config.get('REDIS_PORT') ?? 6379) } }); this.channel = config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live'; }
  async subscribe(handler: (event: LiveEventEnvelope) => void | Promise<void>): Promise<() => Promise<void>> { if (!this.client.isOpen) await this.client.connect(); await this.client.subscribe(this.channel, async (message) => { const event: unknown = JSON.parse(message); if (event && typeof event === 'object' && typeof (event as { type?: unknown }).type === 'string' && typeof (event as { tournamentId?: unknown }).tournamentId === 'number') await handler(event as LiveEventEnvelope); }); return async () => { if (this.client.isOpen) await this.client.unsubscribe(this.channel); }; }
  async onModuleDestroy(): Promise<void> { if (this.client.isOpen) await this.client.quit(); }
}
