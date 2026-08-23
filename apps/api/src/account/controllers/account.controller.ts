import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Request, UseGuards, ValidationPipe } from '@nestjs/common';

import { AccountProfileDto, AdminAccountDto } from '@tournament-manager/contracts';
import { AccountService } from '../services/account.service';
import { CreateAccountPlayerDto } from './account.requests';

import { JwtAuthGuard } from '@auth/guards/jwt-auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { CreatorOrAdminGuard } from '@auth/guards/owner-or-admin.guard';
import { Account } from '@tournament-manager/persistence';

@Controller('user')
export class AccountController {
    constructor(
        private readonly service: AccountService,
    ) { }

    private toCurrentAccountProfileDto(account: Account): AccountProfileDto {
        return {
            id: account.id,
            username: account.username,
            nationality: account.nationality,
            grooveStatsApi: account.grooveStatsApi,
            profilePicture: account.profilePicture,
            player: account.player ?? null,
        };
    }

    private toAdminAccountDto(account: Account): AdminAccountDto {
        return {
            id: account.id,
            username: account.username,
            isAdmin: account.isAdmin,
            isTournamentCreator: account.isTournamentCreator,
        };
    }

    @Post()
    async create(@Body(new ValidationPipe()) dto: CreateAccountPlayerDto) {
        const account = await this.service.create(dto);
        return this.toCurrentAccountProfileDto(account);
    }

    @UseGuards(JwtAuthGuard, CreatorOrAdminGuard)
    @Get()
    async findAll() {
        const accounts = await this.service.findAll();
        return accounts.map((account) => this.toAdminAccountDto(account));
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/profile')
    async updateProfile(
        @Param('id') id: string,
        @Body() body: { playerName?: string; nationality?: string; grooveStatsApi?: string; profilePicture?: string },
        @Request() req,
    ) {
        if (req.user.id !== id) throw new ForbiddenException();
        const account = await this.service.updateProfile(id, body);
        return this.toCurrentAccountProfileDto(account);
    }

    @UseGuards(JwtAuthGuard, AdminGuard)
    @Patch(':id/flags')
    async updateFlags(
        @Param('id') id: string,
        @Body() body: { isAdmin?: boolean; isTournamentCreator?: boolean },
    ) {
        const account = await this.service.updateFlags(id, body);
        return this.toAdminAccountDto(account);
    }
}
