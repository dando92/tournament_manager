import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AccountService } from './services/account.service';
import { AccountController } from './controllers/account.controller';
import { PersistenceModule } from '@tournament-manager/persistence';
import { AdminGuard } from '@auth/guards/admin.guard';
import { CreatorOrAdminGuard } from '@auth/guards/owner-or-admin.guard';

@Module({
    imports: [PersistenceModule],
    providers: [AccountService, AdminGuard, CreatorOrAdminGuard],
    controllers: [AccountController],
    exports: [AccountService],
})
export class AccountModule {
  constructor(private datasource: DataSource) { }
}
