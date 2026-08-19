import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisHealthService implements OnModuleDestroy {
  private client?: RedisClientType;

  constructor(private readonly config: ConfigService) {}

  async ping(): Promise<void> {
    if (!this.client) {
      this.client = createClient({
        socket: {
          host: this.config.get('REDIS_HOST') ?? 'localhost',
          port: Number(this.config.get('REDIS_PORT') ?? 6379),
        },
      });
      this.client.on('error', () => undefined);
    }
    if (!this.client.isOpen) await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }
}
