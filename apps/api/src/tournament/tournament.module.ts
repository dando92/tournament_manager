import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { PersistenceModule } from '@tournament-manager/persistence';
import { AccountModule } from '@account/account.module';
import { StartggModule } from '../integrations/startgg/startgg.module';
import { LiveMessagingModule } from '../live-messaging/live-messaging.module';
import { Services } from './services';
import { CompletedSongService } from './services/completed-song.service';
import { Controllers } from './controllers';
import { TournamentAccessGuard, AdminGuard, CreatorOrAdminGuard } from '@auth/guards';
import { TournamentOpenGuard } from './guards/tournament-open.guard';

@Module({
    imports: [
        AuthModule,
        PersistenceModule,
        AccountModule,
		StartggModule,
        LiveMessagingModule,
    ],
    providers: [...Services, TournamentAccessGuard, TournamentOpenGuard, AdminGuard, CreatorOrAdminGuard],
    exports: [CompletedSongService],
    controllers: [...Controllers]
})
export class TournamentModule {}
