import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '@auth/auth.module';

import { PersistenceModule } from '@persistence/persistence.module';
import { TournamentModule } from '@tournament/tournament.module';
import { AccountModule } from '@account/account.module';

import { Entities } from '@persistence/entities';

import { AuthService } from '@auth/services';
import { AuthController } from '@auth/controllers';


@Module({
  imports: [
  ConfigModule.forRoot({
  isGlobal: true,
    }),
  TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      if (config.get('DB_TYPE') === 'sqlite') {
        return {
          type: 'sqlite',
          database: config.get('SQLITE_PATH') ?? './tournament.db',
          entities: Entities,
          synchronize: true,
        };
      }
      if (config.get('DB_TYPE') === 'postgres') {
        return {
          type: 'postgres',
          host: config.getOrThrow('DATABASE_HOST'),
          port: parseInt(config.get('DATABASE_PORT') ?? '5432'),
          username: config.getOrThrow('DATABASE_USER'),
          password: config.getOrThrow('DATABASE_PASSWORD'),
          database: config.getOrThrow('DATABASE_NAME'),
          entities: Entities,
          synchronize: true,
          ssl: config.get('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        };
      }
      return {
        type: 'mariadb',
        host: config.getOrThrow('DATABASE_HOST'),
        port: 3306,
        username: config.getOrThrow('DATABASE_USER'),
        password: config.getOrThrow('DATABASE_PASSWORD'),
        database: config.getOrThrow('DATABASE_NAME'),
        entities: Entities,
        synchronize: true,
      };
    },
  }),
    PersistenceModule,
    AuthModule,
    AccountModule,
    TournamentModule

   ],
  controllers:[
    AuthController
  ],
  providers: [
    AuthService
  ],
})
export class AppModule { }
