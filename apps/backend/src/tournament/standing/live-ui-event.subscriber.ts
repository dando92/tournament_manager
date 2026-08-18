import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LiveEventEnvelope } from '../../contracts/events';
import {
  LIVE_EVENT_TRANSPORT,
  LiveEventTransport,
} from '../../eventing/eventing.interfaces';
import { UiUpdateGateway } from '@match/gateways/ui-update.gateway';

@Injectable()
export class LiveUiEventSubscriber
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private unsubscribe?: () => Promise<void>;

  constructor(
    private readonly config: ConfigService,
    private readonly uiUpdates: UiUpdateGateway,
    @Inject(LIVE_EVENT_TRANSPORT)
    private readonly transport: LiveEventTransport,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.unsubscribe = await this.transport.subscribe(
      this.config.get('LIVE_EVENT_CHANNEL') ?? 'tournament-manager.live',
      (event) => this.forward(event),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.unsubscribe?.();
  }

  private async forward(event: LiveEventEnvelope): Promise<void> {
    if (event.type === 'ui.match-changed') {
      const payload = event.payload as { matchId: number };
      await this.uiUpdates.emitMatchUpdateByMatchId(payload.matchId);
    } else if (event.type === 'ui.warning') {
      const payload = event.payload as { message: string };
      this.uiUpdates.emitWarning(event.tournamentId, payload.message);
    } else if (event.type === 'tournament.snapshot-changed') {
      await this.uiUpdates.emitTournamentUpdate(event.tournamentId);
    }
  }
}
