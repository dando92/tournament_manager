import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AccountService } from './services';
import { AccountController } from './controllers';
import { PersistenceModule } from '@persistence/persistence.module';
import { AdminGuard, CreatorOrAdminGuard } from '@auth/guards';

@Module({
    imports: [PersistenceModule],
    providers: [AccountService, AdminGuard, CreatorOrAdminGuard],
    controllers: [AccountController],
    exports: [AccountService],
})
export class AccountModule {
  constructor(private datasource: DataSource) { }
}
