import { createSocket, type RemoteInfo, type Socket } from "node:dgram";
import type { BridgeConfig } from "../config";
import type { Logger } from "../observability/logger";
import { LEGACY_OPCODE, opcodeName } from "./opcodes";
import {
  parseLegacyScoreMessage,
  type LegacyScoreMessage,
} from "./score-message";

export type LegacyUdpHandlers = {
  onSong(song: string): void;
  onStart(song: string): void;
  onScore(message: LegacyScoreMessage): void;
  onFinalScore(message: LegacyScoreMessage, payload: string): void;
};

/**
 * The listener on the legacy broadcast port.
 *
 * ITGmania sends to `INADDR_BROADCAST`, so this socket hears every cabinet on
 * the segment whether or not the tournament is watching it. Nothing it receives
 * is trusted: a datagram whose opcode is not part of the protocol, or whose
 * payload does not have the exact field count the cabinet writes, is logged and
 * dropped instead of reaching the lobby state.
 */
export class LegacyUdpServer {
  private readonly socket: Socket;

  constructor(
    private readonly config: BridgeConfig,
    private readonly logger: Logger,
    private readonly handlers: LegacyUdpHandlers,
  ) {
    this.socket = createSocket({ type: "udp4", reuseAddr: true });
    this.socket.on("message", (buffer, remote) =>
      this.handleDatagram(buffer, remote),
    );
    this.socket.on("error", (error) =>
      this.logger.error("UDP socket error", {
        port: config.udpPort,
        error: error.message,
      }),
    );
  }

  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once("error", reject);
      this.socket.bind(this.config.udpPort, () => {
        this.socket.off("error", reject);
        this.logger.info("Listening for legacy SyncStart broadcasts", {
          port: this.config.udpPort,
          allowedSources: this.config.udpAllowedSources,
        });
        resolve();
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.socket.close(() => resolve()));
  }

  private handleDatagram(buffer: Buffer, remote: RemoteInfo): void {
    if (buffer.length === 0) return;
    if (!this.isAllowed(remote.address)) {
      this.logger.debug(
        "Ignoring datagram from a source outside the allowlist",
        {
          source: remote.address,
        },
      );
      return;
    }

    const opcode = buffer[0];
    const payload = buffer.subarray(1).toString("utf8");

    switch (opcode) {
      case LEGACY_OPCODE.song:
        this.logger.debug("Song selected", {
          source: remote.address,
          song: payload,
        });
        return this.handlers.onSong(payload);
      case LEGACY_OPCODE.start:
        this.logger.debug("Song starting", {
          source: remote.address,
          song: payload,
        });
        return this.handlers.onStart(payload);
      case LEGACY_OPCODE.score:
        return this.dispatchScore(opcode, payload, remote, (message) =>
          this.handlers.onScore(message),
        );
      case LEGACY_OPCODE.finalScore:
      case LEGACY_OPCODE.finalCourseScore:
        return this.dispatchScore(opcode, payload, remote, (message) =>
          this.handlers.onFinalScore(message, payload),
        );
      default:
        this.logger.debug("Ignoring datagram", {
          source: remote.address,
          opcode: opcodeName(opcode),
        });
    }
  }

  private dispatchScore(
    opcode: number,
    payload: string,
    remote: RemoteInfo,
    dispatch: (message: LegacyScoreMessage) => void,
  ): void {
    const message = parseLegacyScoreMessage(payload);
    if (!message) {
      this.logger.warn("Dropping malformed score datagram", {
        source: remote.address,
        opcode: opcodeName(opcode),
        payload: payload.slice(0, 400),
      });
      return;
    }
    dispatch(message);
  }

  private isAllowed(source: string): boolean {
    return (
      this.config.udpAllowedSources.length === 0 ||
      this.config.udpAllowedSources.includes(source)
    );
  }
}
