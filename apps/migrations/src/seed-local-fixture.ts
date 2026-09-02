import { DataSource } from 'typeorm';

import { Tournament } from '@tournament-manager/persistence';

/**
 * Creates the deterministic tournament the local stack and its end-to-end
 * checks start from.
 *
 * This ran as a separate one-shot application until its only structural reason
 * to exist disappeared: it pushed the tournament's SyncStart configuration over
 * HTTP, which forced it to wait for SyncStart, while both the API and SyncStart
 * already reconcile that configuration when they start. What is left is one
 * create-if-missing row, so it runs here, in the process that already seeds the
 * first administrator, right after the migrations it depends on.
 *
 * The seed is off unless LOCAL_FIXTURE_ENABLED is exactly "true". A deployed
 * environment must never gain rows because a variable was left set somewhere.
 */
export async function seedLocalFixture(dataSource: DataSource): Promise<void> {
  if (process.env.LOCAL_FIXTURE_ENABLED !== 'true') return;

  const name =
    process.env.LOCAL_FIXTURE_TOURNAMENT_NAME?.trim() || 'Local E2E Tournament';
  const tournaments = dataSource.getRepository(Tournament);
  const existing = await tournaments.findOneBy({ name });
  if (existing) {
    console.log(`Local fixture tournament "${name}" already exists.`);
    return;
  }

  /*
   * The column is not nullable and carries a public GrooveStats default, so an
   * absent variable is written as the empty string rather than left to that
   * default. Empty means "created without SyncStart", which is what an operator
   * who leaves the variable blank asks for.
   */
  const tournament = tournaments.create({
    name,
    syncstartUrl: process.env.LOCAL_FIXTURE_SYNCSTART_URL ?? '',
    availableSetupsCount: 2,
    defaultScoringSystem: 'PlacementPointsWithFailZero',
  });
  const saved = await tournaments.save(tournament);
  console.log(`Created local fixture tournament "${name}" (id ${saved.id}).`);
}
