import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './controllers/auth.controller';
import { LocalAuthGuard, AdminGuard } from './guards';
import { AuthService } from './services/auth.service';
import { LocalStrategy } from './strategies';

import { PersistenceModule } from '@tournament-manager/persistence';

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
                signOptions: { expiresIn: '12h'},
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
