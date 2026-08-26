import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Player } from '@tournament-manager/persistence';

/** The form two names are compared in: trimmed, and ignoring case. */
export function normalizePlayerName(playerName: string): string {
    return playerName.trim().toLowerCase();
}

/**
 * The player catalogue as the write side sees it.
 *
 * A player is created as a consequence of somebody being registered, imported
 * or added to a division, so this store has no commands class of its own: the
 * writes that create people are the ones that had a reason to, and they go
 * through here for the rows.
 *
 * Every method answers for a whole list. Registering two hundred people used to
 * cost a query and an insert each, and the start.gg import loaded every player
 * in the application twice to find the handful of names its event held.
 */
@Injectable()
export class PlayerStore {
    constructor(
        @InjectRepository(Player)
        private readonly players: Repository<Player>,
    ) {}

    async byIds(ids: number[]): Promise<Map<number, Player>> {
        if (ids.length === 0) return new Map();

        const found = await this.players.find({ where: { id: In(ids) } });

        return new Map(found.map((player) => [player.id, player]));
    }

    /**
     * The players whose names match, keyed by the normalized name.
     *
     * `UQ_player_normalized_name` makes that key unique in the catalogue, so
     * one name answers with one player and the map cannot lose a row (FQ-029).
     */
    async byNormalizedNames(playerNames: string[]): Promise<Map<string, Player>> {
        const normalized = [...new Set(playerNames.map(normalizePlayerName).filter(Boolean))];
        if (normalized.length === 0) return new Map();

        const found = await this.players
            .createQueryBuilder('player')
            .where('LOWER(TRIM(player.playerName)) IN (:...normalized)', { normalized })
            .getMany();

        return new Map(found.map((player) => [normalizePlayerName(player.playerName), player]));
    }

    /** New people, in the order they were named, in one insert. */
    async createAll(playerNames: string[]): Promise<Player[]> {
        if (playerNames.length === 0) return [];

        return await this.players.save(playerNames.map((playerName) => this.players.create({ playerName })));
    }
}
