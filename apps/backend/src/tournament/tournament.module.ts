import { Module } from '@nestjs/common';
import { AuthModule } from '@auth/auth.module';
import { PersistenceModule } from '@persistence/persistence.module';
import { SyncStartModule } from '@syncstart/index';
import { AccountModule } from '@account/account.module';
import { StartggModule } from '../integrations/startgg/startgg.module';
import { Services } from './services';
import { Controllers } from './controllers';
import { Gateways } from './gateways';
import { TournamentAccessGuard, AdminGuard, CreatorOrAdminGuard } from '@auth/guards';

@Module({
    imports: [
        AuthModule,
        PersistenceModule,
        SyncStartModule,
        AccountModule,
		StartggModule
    ],
    providers: [...Gateways, ...Services, TournamentAccessGuard, AdminGuard, CreatorOrAdminGuard],
    controllers: [...Controllers]
})
export class TournamentModule {}
