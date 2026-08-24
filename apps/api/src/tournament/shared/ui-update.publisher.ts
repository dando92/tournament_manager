import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type EventEnvelope,
  LIVE_EVENT_PUBLISHER,
  type LiveEventPublisher,
} from '@tournament-manager/live-messaging';
import { MatchAddress } from '@match/match.aggregate';
import { DivisionAddress } from '@tournament/structure/division/division.aggregate';
import { PhaseAddress, PhaseGroupAddress } from '@tournament/structure/phase-group/phase-group.aggregate';

/**
 * What the interface is told, and where to route it.
 *
 * Every event carries the address of what changed, and every caller already
 * holds that address: a command loaded a graph that reaches the tournament, or
 * it read the address in the one query it needed anyway. `UiUpdateContextService`
 * — a lookup query per event published, for callers that had loaded the same
 * rows a moment earlier — went with the last write that could not answer where
 * it sat.
 */
@Injectable()
export class UiUpdatePublisher {
  constructor(
    private readonly config: ConfigService,
    @Inject(LIVE_EVENT_PUBLISHER) private readonly transport: LiveEventPublisher,
  ) {}

  emitTournamentUpdate(tournamentId: number | null | undefined): Promise<void> {
    if (!tournamentId) return Promise.resolve();
    return this.publish('ui.tournament-changed', tournamentId, { tournamentId });
  }

  emitSongsUpdate(tournamentId: number | null | undefined): Promise<void> {
    if (!tournamentId) return Promise.resolve();
    return this.publish('ui.songs-changed', tournamentId, { tournamentId });
  }

  emitDivisionUpdate(address: DivisionAddress): Promise<void> {
    if (!address?.tournamentId || !address?.divisionId) return Promise.resolve();
    return this.publish('ui.division-changed', address.tournamentId, address);
  }

  emitPhaseUpdate(address: PhaseAddress): Promise<void> {
    if (!address?.tournamentId || !address?.phaseId) return Promise.resolve();
    const { tournamentId, divisionId, phaseId } = address;
    return this.publish('ui.phase-changed', tournamentId, { tournamentId, divisionId, phaseId });
  }

  emitMatchUpdate(address: MatchAddress): Promise<void> {
    if (!address?.tournamentId) return Promise.resolve();
    return this.publish('ui.match-changed', address.tournamentId, address);
  }

  emitControlRoomFlowUpdate(tournamentId: number | null | undefined, flowId: number | null | undefined): Promise<void> {
    if (!tournamentId || !flowId) return Promise.resolve();
    return this.publish('ui.control-room-flow-changed', tournamentId, { tournamentId, flowId });
  }

  emitPhaseGroupUpdate(address: PhaseGroupAddress): Promise<void> {
    if (!address?.tournamentId || !address?.phaseGroupId) return Promise.resolve();
    const { tournamentId, divisionId, phaseId, phaseGroupId } = address;
    return this.publish('ui.phase-group-changed', tournamentId, { tournamentId, divisionId, phaseId, phaseGroupId });
  }

  emitWarning(tournamentId: number | null | undefined, message: string): Promise<void> {
    if (!tournamentId) return Promise.resolve();
    return this.publish('ui.warning', tournamentId, { message });
  }

  private publish(type: string, tournamentId: number, payload: unknown): Promise<void> {
    const event: EventEnvelope = { type, tournamentId, payload };
    return this.transport.publish(event);
  }
}
