import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LiveEventEnvelope } from '@tournament-manager/contracts';
import { LIVE_EVENT_PUBLISHER, type LiveEventPublisher } from '@tournament-manager/live-messaging';
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

  async emitMatchUpdateByMatchId(matchId: number | null | undefined): Promise<void> {
    if (!matchId) return;
    const payload = await this.context.getMatchUpdatePayload(matchId);
    if (payload) await this.publish('ui.match-changed', payload.tournamentId, payload);
  }

  emitWarning(tournamentId: number | null | undefined, message: string): Promise<void> {
    if (!tournamentId) return Promise.resolve();
    return this.publish('ui.warning', tournamentId, { message });
  }

  private publish(type: string, tournamentId: number, payload: unknown): Promise<void> {
    const event: LiveEventEnvelope = { type, tournamentId, payload };
    return this.transport.publish(event);
  }
}
