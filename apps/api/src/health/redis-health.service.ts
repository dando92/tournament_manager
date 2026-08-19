import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'node:net';

@Injectable()
export class RedisHealthService {
  constructor(private readonly config: ConfigService) {}

  async ping(): Promise<void> {
    const host = this.config.get('REDIS_HOST') ?? '127.0.0.1';
    const port = Number(this.config.get('REDIS_PORT') ?? 6379);
    const timeoutMs = Number(this.config.get('HEALTH_CHECK_TIMEOUT_MS') ?? 1000);

    await new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      let response = '';

      const finish = (error?: Error) => {
        socket.removeAllListeners();
        socket.destroy();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      socket.setTimeout(timeoutMs);
      socket.once('error', (error) => finish(error));
      socket.once('timeout', () => finish(new Error('Redis health check timed out')));
      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
        if (response.includes('\r\n')) {
          if (response.startsWith('+PONG')) {
            finish();
          } else {
            finish(new Error(`Unexpected Redis response: ${response.trim()}`));
          }
        }
      });
      socket.connect(port, host, () => socket.write('*1\r\n$4\r\nPING\r\n'));
    });
  }
}
