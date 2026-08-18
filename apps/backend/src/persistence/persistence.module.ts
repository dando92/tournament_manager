import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities } from './entities';
import { PostgresAdvisoryLock } from './postgres-advisory-lock';

@Module({
    imports: [
        TypeOrmModule.forFeature(Entities)
    ],
    providers: [PostgresAdvisoryLock],
    exports: [TypeOrmModule, PostgresAdvisoryLock]
})
export class PersistenceModule {}
