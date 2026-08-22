import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tournament } from '@tournament-manager/persistence';
import {
    MyTournamentRolesDto,
    TournamentConfigurationDto,
    TournamentDto,
    TournamentRefDto,
} from '@tournament-manager/contracts';

/** The rows `TOURNAMENT_ROLES_OF_ACCOUNT` produces. Changing one without the other is a bug. */
type TournamentRolesRow = {
    ownedTournamentIds: number[];
    staffTournamentIds: number[];
};

/**
 * Which tournaments an account owns and which it staffs, in one query.
 *
 * An account reaches a participation two ways: the participant carries the
 * account, or the player behind the participant does. The two used to be two
 * query-builder reads of the same join differing only in the role they matched.
 *
 * `roles` is a `simple-array` column, so a role is an element of the split
 * value rather than a substring of it. The previous form matched `LIKE
 * '%owner%'`, which would also have matched a role that merely contained the
 * word.
 */
const TOURNAMENT_ROLES_OF_ACCOUNT = `
    WITH membership AS (
        SELECT DISTINCT
                pa."tournamentId"                AS "tournamentId",
                string_to_array(pa."roles", ',') AS "roles"
        FROM        "participant" pa
        LEFT JOIN   "account" acc ON acc."playerId" = pa."playerId"
        WHERE       pa."tournamentId" IS NOT NULL
            AND     (pa."accountId" = $1 OR acc."id" = $1)
    )
    SELECT  COALESCE(json_agg(DISTINCT "tournamentId") FILTER (WHERE 'owner' = ANY("roles")), '[]'::json) AS "ownedTournamentIds",
            COALESCE(json_agg(DISTINCT "tournamentId") FILTER (WHERE 'staff' = ANY("roles")), '[]'::json) AS "staffTournamentIds"
    FROM    membership
`;

/**
 * Every read of a tournament record itself, in the shape the interface
 * consumes. The structure below it — divisions, phases and pools — is read
 * through `TreeQueries`, and the matches inside it through `MatchQueries`.
 *
 * It projects and nothing else: it does not write, does not publish, and does
 * not call a service. The write paths call `byId` for their response, so a
 * mutation answers with the projection its `GET` returns.
 */
@Injectable()
export class TournamentQueries {
    constructor(
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly config: ConfigService,
    ) {}

    async byId(id: number): Promise<TournamentDto | null> {
        const tournament = await this.tournamentRepository.findOne({
            where: { id },
            select: {
                id: true,
                name: true,
                status: true,
                closedAt: true,
                syncstartUrl: true,
                availableSetupsCount: true,
                defaultScoringSystem: true,
            },
        });
        if (!tournament) return null;

        return {
            id: tournament.id,
            name: tournament.name,
            status: tournament.status,
            closedAt: tournament.closedAt?.toISOString() ?? null,
            syncstartUrl: tournament.syncstartUrl,
            availableSetupsCount: tournament.availableSetupsCount,
            defaultScoringSystem: tournament.defaultScoringSystem,
        };
    }

    /**
     * The same record with its secrets, and the retention window the transport
     * applies. That last field is configuration rather than a column, which is
     * why this projection is not `byId` plus the key.
     */
    async configuration(id: number): Promise<TournamentConfigurationDto | null> {
        const tournament = await this.tournamentRepository.findOne({
            where: { id },
            select: {
                id: true,
                name: true,
                status: true,
                closedAt: true,
                syncstartUrl: true,
                startggApiKey: true,
                availableSetupsCount: true,
                defaultScoringSystem: true,
            },
        });
        if (!tournament) return null;

        return {
            id: tournament.id,
            name: tournament.name,
            status: tournament.status,
            closedAt: tournament.closedAt?.toISOString() ?? null,
            transportRetentionDays: Number(this.config.get('TOURNAMENT_TRANSPORT_RETENTION_DAYS') ?? 10),
            syncstartUrl: tournament.syncstartUrl,
            startggApiKey: tournament.startggApiKey,
            availableSetupsCount: tournament.availableSetupsCount,
            defaultScoringSystem: tournament.defaultScoringSystem,
        };
    }

    async publicList(): Promise<TournamentRefDto[]> {
        const tournaments = await this.tournamentRepository.find({
            select: { id: true, name: true },
            order: { id: 'ASC' },
        });

        return tournaments.map((tournament) => ({ id: tournament.id, name: tournament.name }));
    }

    /** `null` when no such tournament exists, so the caller can tell that apart from a missing key. */
    async hasStartggApiKey(id: number): Promise<boolean | null> {
        const tournament = await this.tournamentRepository.findOne({
            where: { id },
            select: { id: true, startggApiKey: true },
        });
        if (!tournament) return null;

        return Boolean(tournament.startggApiKey?.trim());
    }

    /** The tournament half of `MyTournamentRolesDto`; the account half comes from `AuthService`. */
    async rolesFor(accountId: string): Promise<Pick<MyTournamentRolesDto, 'ownedTournamentIds' | 'staffTournamentIds'>> {
        const [row]: TournamentRolesRow[] = await this.dataSource.query(TOURNAMENT_ROLES_OF_ACCOUNT, [accountId]);

        return {
            ownedTournamentIds: row?.ownedTournamentIds ?? [],
            staffTournamentIds: row?.staffTournamentIds ?? [],
        };
    }
}
