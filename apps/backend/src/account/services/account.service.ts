import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { genSalt, hash } from 'bcrypt';
import { Repository } from "typeorm";

import { Player, Account } from '@persistence/entities';
import { CreateAccountPlayerDto } from '../dtos';

@Injectable()
export class AccountService {
    constructor(
        @InjectRepository(Account)
        private accountRepo: Repository<Account>,
        @InjectRepository(Player)
        private playerRepo: Repository<Player>,
    ) { }

    async create(dto: CreateAccountPlayerDto) {
        const normalizedUsername = dto.username.toLowerCase();
        const existing = await this.accountRepo.findOneBy({ username: normalizedUsername });
        if (existing) {
            throw new UnprocessableEntityException();
        }

        const player = new Player();
        player.playerName = dto.playerName ?? dto.username;
        await this.playerRepo.save(player);

        const salt = await genSalt(10);
        const hashedPassword = await hash(dto.password, salt);

        const account = new Account();
        account.username = normalizedUsername;
        account.email = dto.email;
        account.password = hashedPassword;
        account.grooveStatsApi = dto.grooveStatsApi ?? '';
        account.player = player;

        await this.accountRepo.save(account);

        return account;
    }

    async findAll(): Promise<Account[]> {
        return this.accountRepo.find({ relations: ['player'] });
    }

    async findById(accountId: string): Promise<Account | null> {
        return this.accountRepo.findOneBy({ id: accountId });
    }

    async findByPlayerId(playerId: number): Promise<Account | null> {
        return this.accountRepo.findOne({
            where: { player: { id: playerId } },
            relations: ['player'],
        });
    }

    async findByIdWithPlayer(accountId: string): Promise<Account | null> {
        return this.accountRepo.findOne({ where: { id: accountId }, relations: ['player'] });
    }

    async ensurePlayer(accountId: string): Promise<Account> {
        const account = await this.findByIdWithPlayer(accountId);
        if (!account) throw new NotFoundException(`Account ${accountId} not found`);

        if (!account.player) {
            const player = new Player();
            player.playerName = account.username;
            account.player = await this.playerRepo.save(player);
            await this.accountRepo.save(account);
        }

        return account;
    }

    async updateProfile(accountId: string, profile: { playerName?: string; nationality?: string; grooveStatsApi?: string; profilePicture?: string }): Promise<Account> {
        const account = await this.accountRepo.findOne({ where: { id: accountId }, relations: ['player'] });
        if (profile.nationality !== undefined) account.nationality = profile.nationality;
        if (profile.grooveStatsApi !== undefined) account.grooveStatsApi = profile.grooveStatsApi;
        if (profile.profilePicture !== undefined) account.profilePicture = profile.profilePicture;
        if (profile.playerName !== undefined && account.player) {
            account.player.playerName = profile.playerName;
            await this.playerRepo.save(account.player);
        }
        return this.accountRepo.save(account);
    }

    async updateFlags(accountId: string, flags: { isAdmin?: boolean; isTournamentCreator?: boolean }): Promise<Account> {
        const account = await this.accountRepo.findOneBy({ id: accountId });
        if (flags.isAdmin !== undefined) account.isAdmin = flags.isAdmin;
        if (flags.isTournamentCreator !== undefined) account.isTournamentCreator = flags.isTournamentCreator;
        return this.accountRepo.save(account);
    }
}
