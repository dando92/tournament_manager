import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type EventEnvelope,
  LIVE_EVENT_PUBLISHER,
  type LiveEventPublisher,
} from '@tournament-manager/live-messaging';
import { MatchAddress } from '@match/match.aggregate';
import { DivisionAddress } from '@tournament/structure/division/division.aggregate';
import { UiUpdateContextService } from './ui-update-context.service';

@Injectable()
export class UiUpdatePublisher {
  constructor(
    private readonly context: UiUpdateContextService,
    private readonly config: ConfigService,
    @Inject(LIVE_EVENT_PUBLISHER) private readonly transport: LiveEventPublisher,
  ) {}

  emitTournamentUpdate(tournamentId: number | null | undefined): Promise<void> {
    if (!tournamentId) return Promise.resolve();
    return this.publish('ui.tournament-changed', tournamentId, { tournamentId });
  }

  /** The division writes carry the address of what they changed, like the match writes. */
  emitDivisionUpdate(address: DivisionAddress): Promise<void> {
    if (!address?.tournamentId || !address?.divisionId) return Promise.resolve();
    return this.publish('ui.division-changed', address.tournamentId, address);
  }

  async emitDivisionUpdateByDivisionId(divisionId: number | null | undefined): Promise<void> {
    if (!divisionId) return;
    const payload = await this.context.getDivisionUpdatePayload(divisionId);
    if (payload) await this.publish('ui.division-changed', payload.tournamentId, payload);
  }

  async emitPhaseUpdateByPhaseId(phaseId: number | null | undefined): Promise<void> {
    if (!phaseId) return;
    const payload = await this.context.getPhaseUpdatePayload(phaseId);
    if (payload) await this.publish('ui.phase-changed', payload.tournamentId, payload);
  }

  async emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId: number | null | undefined): Promise<void> {
    if (!phaseGroupId) return;
    const payload = await this.context.getPhaseGroupUpdatePayload(phaseGroupId);
    if (payload) await this.publish('ui.phase-group-changed', payload.tournamentId, payload);
  }

  /**
   * The match writes carry the address of what they changed, because the graph
   * they loaded reaches the tournament. Nothing has to be looked up to route
   * the event.
   */
  emitMatchUpdate(address: MatchAddress): Promise<void> {
    if (!address?.tournamentId) return Promise.resolve();
    return this.publish('ui.match-changed', address.tournamentId, address);
  }

  emitPhaseGroupUpdate(address: MatchAddress): Promise<void> {
    if (!address?.tournamentId) return Promise.resolve();
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
