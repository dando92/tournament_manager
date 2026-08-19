import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersistenceModule } from '@tournament-manager/persistence';
import { StartggClient } from './startgg.client';

@Module({
    imports: [
        ConfigModule,
        PersistenceModule,
    ],
    providers: [StartggClient],
    exports: [StartggClient],
})
export class StartggModule {}
