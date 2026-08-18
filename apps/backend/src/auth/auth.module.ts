import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './controllers';
import { LocalAuthGuard, AdminGuard } from './guards';
import { AuthService } from './services';
import { LocalStrategy } from './strategies';

import { PersistenceModule } from '@persistence/persistence.module';

import { JwtStrategy } from './strategies/jwt.strategy';


@Module({
    imports: [
        PersistenceModule,
        PassportModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            global: true,
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '15m'},
            }),
        }),
    ],
    providers: [
        AuthService,
        LocalStrategy,
        JwtStrategy,
        AdminGuard,
    ],
    controllers: [AuthController],
    exports: [AuthService]
})
export class AuthModule {}
