import { LoggerService } from '@nestjs/common';
import * as fs from 'fs';

export class AppLogger implements LoggerService {
  private stream: fs.WriteStream | null;

  constructor() {
    const logFile = process.env.LOG_FILE;
    this.stream = logFile ? fs.createWriteStream(logFile, { flags: 'a' }) : null;
  }

  private write(level: string, message: unknown, context?: string) {
    const line = `[${new Date().toISOString()}] [${level}]${context ? ` [${context}]` : ''} ${message}\n`;
    if (this.stream) {
      this.stream.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  log(message: unknown, context?: string) {
    this.write('LOG', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('ERROR', trace ? `${message} — ${trace}` : message, context);
  }

  warn(message: unknown, context?: string) {
    this.write('WARN', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('DEBUG', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('VERBOSE', message, context);
  }
}
