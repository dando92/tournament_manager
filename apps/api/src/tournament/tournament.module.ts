import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { PersistenceModule } from '@tournament-manager/persistence';
import { AccountModule } from '@account/account.module';
import { StartggModule } from '../integrations/startgg/startgg.module';
import { EventingModule } from '../eventing/eventing.module';
import { Services } from './services';
import { Controllers } from './controllers';
import { TournamentAccessGuard, AdminGuard, CreatorOrAdminGuard } from '@auth/guards';
import { TournamentOpenGuard } from './guards/tournament-open.guard';

@Module({
    imports: [
        AuthModule,
        PersistenceModule,
        AccountModule,
		StartggModule,
        EventingModule,
    ],
    providers: [...Services, TournamentAccessGuard, TournamentOpenGuard, AdminGuard, CreatorOrAdminGuard],
    controllers: [...Controllers]
})
export class TournamentModule {}
