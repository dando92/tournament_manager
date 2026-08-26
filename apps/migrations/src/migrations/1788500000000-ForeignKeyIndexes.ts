import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Indexes every foreign key column a read joins on, or a cascade deletes
 * through.
 *
 * PostgreSQL indexes the parent side of a foreign key and never the child, so
 * until now `match."phaseGroupId"` — the column behind every scope predicate in
 * the match, tree and standings queries — was resolved by a sequential scan,
 * and deleting a tournament scanned `division`, `phase`, `phase_group`,
 * `match`, `round` and `standing` end to end.
 *
 * Three of these look covered by an existing composite and are not:
 * `standing."playerId"` sits second in `IDX_76a9cb5154ea8d65024989a39e`,
 * `match_tiebreak_standing."playerId"` second in
 * `UQ_match_tiebreak_standing_player`, and `round."songId"` second in
 * `IDX_dfa041d32ed2f7a150188a2da7`, so none of them can serve a lookup on that
 * column alone.
 *
 * `advancement_rule` carried no index at all. The two composites are the legs
 * of the `OR` that resolves the rules of a set of matches, which can now be a
 * bitmap OR instead of a sequential scan.
 *
 * The names are the ones the entity decorators declare, so schema and metadata
 * agree and no later `synchronize` diff sees a difference.
 */
export class ForeignKeyIndexes1788500000000 implements MigrationInterface {
    name = "ForeignKeyIndexes1788500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_match_phase_group" ON "match" ("phaseGroupId")`);
        await queryRunner.query(`CREATE INDEX "IDX_participant_tournament" ON "participant" ("tournamentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_participant_player" ON "participant" ("playerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_participant_account" ON "participant" ("accountId")`);
        await queryRunner.query(`CREATE INDEX "IDX_entrant_division" ON "entrant" ("divisionId")`);
        await queryRunner.query(`CREATE INDEX "IDX_phase_division" ON "phase" ("divisionId")`);
        await queryRunner.query(`CREATE INDEX "IDX_phase_group_phase" ON "phase_group" ("phaseId")`);
        await queryRunner.query(`CREATE INDEX "IDX_division_tournament" ON "division" ("tournamentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_song_tournament" ON "song" ("tournamentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_round_song" ON "round" ("songId")`);
        await queryRunner.query(`CREATE INDEX "IDX_standing_player" ON "standing" ("playerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_match_tiebreak_song" ON "match_tiebreak" ("songId")`);
        await queryRunner.query(`CREATE INDEX "IDX_match_tiebreak_standing_player_lookup" ON "match_tiebreak_standing" ("playerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_control_room_flow_tournament" ON "control_room_flow" ("tournamentId")`);
        await queryRunner.query(`CREATE INDEX "IDX_control_room_flow_current_entry" ON "control_room_flow" ("currentEntryId")`);
        await queryRunner.query(`CREATE INDEX "IDX_phase_group_entrant_phase_group" ON "phase_group_entrant" ("phaseGroupId")`);
        await queryRunner.query(`CREATE INDEX "IDX_phase_group_entrant_entrant" ON "phase_group_entrant" ("entrantId")`);
        await queryRunner.query(`CREATE INDEX "IDX_phase_group_entrant_source_advancement_rule" ON "phase_group_entrant" ("sourceAdvancementRuleId")`);
        await queryRunner.query(`CREATE INDEX "IDX_advancement_rule_source" ON "advancement_rule" ("sourceKind", "sourceId")`);
        await queryRunner.query(`CREATE INDEX "IDX_advancement_rule_target" ON "advancement_rule" ("targetKind", "targetId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_advancement_rule_target"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advancement_rule_source"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_phase_group_entrant_source_advancement_rule"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_phase_group_entrant_entrant"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_phase_group_entrant_phase_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_control_room_flow_current_entry"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_control_room_flow_tournament"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_match_tiebreak_standing_player_lookup"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_match_tiebreak_song"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_standing_player"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_round_song"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_song_tournament"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_division_tournament"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_phase_group_phase"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_phase_division"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_entrant_division"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_participant_account"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_participant_player"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_participant_tournament"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_match_phase_group"`);
    }
}
