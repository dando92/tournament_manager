export type LogLevel = "debug" | "info" | "warn" | "error";

const SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * One line of JSON per event, which is what a container log is read as.
 *
 * The bridge listens to a broadcast address, so it sees traffic it is not the
 * subject of. Everything it decides to ignore is logged at `debug` and nothing
 * else, or an idle venue LAN would fill the log with packets from cabinets no
 * tournament is watching.
 */
export class Logger {
  constructor(private readonly level: LogLevel = "info") {}

  debug(message: string, details?: Record<string, unknown>): void {
    this.write("debug", message, details);
  }

  info(message: string, details?: Record<string, unknown>): void {
    this.write("info", message, details);
  }

  warn(message: string, details?: Record<string, unknown>): void {
    this.write("warn", message, details);
  }

  error(message: string, details?: Record<string, unknown>): void {
    this.write("error", message, details);
  }

  private write(
    level: LogLevel,
    message: string,
    details?: Record<string, unknown>,
  ): void {
    if (SEVERITY[level] < SEVERITY[this.level]) return;

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "legacy-syncstart-bridge",
      message,
      ...details,
    });
    if (level === "error") console.error(line);
    else console.log(line);
  }
}
