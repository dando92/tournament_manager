import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Persists where a match stands in its result lifecycle.
 *
 * Three predicates — progressed, settled, and the result status — were each
 * derived twice: once by `MatchAggregate` over the loaded graph, and once in SQL
 * by `TreeQueries`, which walked rounds, standings and the entrant join tables
 * to count them per pool. `MatchAggregate.state` is now the only definition and
 * `MatchStore` writes it here on every save, so the reads filter on a column.
 * See `PerformanceReadiness.md`, batch S.
 *
 * The column is not `active`, which stays where it is: that says a match is on a
 * cabinet now, and is true of open, partial and ready matches alike.
 *
 * The backfill classifies existing rows with the two predicates it retires, and
 * one distinction is beyond them. Whether a settled match is `ready` or
 * `tiebreak_required` depends on whether the advancement rules leaving it would
 * send tied players to different destinations, which is placement resolution
 * rather than a query; every settled row therefore backfills as `ready` and is
 * corrected by the first write that touches it. Nothing reads that distinction
 * from the column yet — the schedule runner still computes it — so this is a
 * starting value rather than a behaviour.
 */
export class MatchState1788900000000 implements MigrationInterface {
    name = "MatchState1788900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "match" ADD "state" character varying NOT NULL DEFAULT 'open'`);

        await queryRunner.query(`UPDATE "match" SET "state" = 'completed' WHERE "matchResultId" IS NOT NULL`);

        await queryRunner.query(`
            UPDATE "match" m
            SET    "state" = 'partial'
            WHERE  m."matchResultId" IS NULL
              AND  EXISTS (
                  SELECT 1
                  FROM   "round" r
                  JOIN   "standing" s ON s."roundId" = r."id"
                  WHERE  r."matchId" = m."id"
                    AND  (s."scoreId" IS NOT NULL OR s."points" > 0)
              )
        `);

        await queryRunner.query(`
            WITH open_match AS (
                SELECT m."id"
                FROM   "match" m
                WHERE  m."matchResultId" IS NULL
            ),
            match_player AS (
                SELECT DISTINCT om."id" AS "matchId", pa."playerId"
                FROM   open_match om
                JOIN   "match_entrants_entrant" me ON me."matchId" = om."id"
                JOIN   "entrant" e ON e."id" = me."entrantId" AND e."type" = 'player'
                JOIN   "entrant_participants_participant" ep ON ep."entrantId" = e."id"
                JOIN   "participant" pa ON pa."id" = ep."participantId"
            ),
            round_fill AS (
                SELECT r."matchId",
                       r."songId" IS NOT NULL AS "played",
                       COUNT(DISTINCT st."playerId") FILTER (WHERE mp."playerId" IS NOT NULL) AS "entered",
                       COUNT(*) FILTER (WHERE mp."playerId" IS NOT NULL AND st."points" > 0) AS "stated"
                FROM   "round" r
                JOIN   open_match om ON om."id" = r."matchId"
                LEFT JOIN "standing" st ON st."roundId" = r."id"
                LEFT JOIN match_player mp ON mp."matchId" = r."matchId" AND mp."playerId" = st."playerId"
                GROUP BY r."matchId", r."id", r."songId"
            ),
            match_fill AS (
                SELECT rf."matchId",
                       COUNT(*) FILTER (
                           WHERE (rf."played" AND rf."entered" < pc."players")
                              OR (NOT rf."played" AND rf."stated" = 0)
                       ) AS "unsettled"
                FROM   round_fill rf
                JOIN (
                    SELECT "matchId", COUNT(*) AS "players"
                    FROM   match_player
                    GROUP BY "matchId"
                ) pc ON pc."matchId" = rf."matchId"
                GROUP BY rf."matchId"
            )
            UPDATE "match" m
            SET    "state" = 'ready'
            FROM   match_fill mf
            WHERE  mf."matchId" = m."id" AND mf."unsettled" = 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "match" DROP COLUMN "state"`);
    }
}
