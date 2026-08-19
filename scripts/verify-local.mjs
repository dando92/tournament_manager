import { execFileSync } from 'node:child_process';

const apiUrl = process.env.LOCAL_API_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? 3000}`;
const frontendUrl = process.env.LOCAL_FRONTEND_URL ?? `http://127.0.0.1:${process.env.FRONTEND_PORT ?? 80}`;
const realtimeUrls = [
  process.env.LOCAL_REALTIME_URL ?? `http://127.0.0.1:${process.env.REALTIME_PORT ?? 3003}`,
  process.env.LOCAL_REALTIME_REPLICA_URL ?? `http://127.0.0.1:${process.env.REALTIME_REPLICA_PORT ?? 3004}`,
];
const seedName = process.env.LOCAL_FIXTURE_TOURNAMENT_NAME ?? 'Local E2E Tournament';

async function expectResponse(label, url, predicate = () => true) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const body = await response.text();
  if (!predicate(body, response)) throw new Error(`${label} returned an unexpected response`);
  console.log(`PASS: ${label}`);
}

await expectResponse('API liveness', `${apiUrl}/health/live`, (body) => JSON.parse(body).status === 'ok');
await expectResponse('API readiness', `${apiUrl}/health/ready`, (body) => {
  const result = JSON.parse(body);
  return result.status === 'ready'
    && result.dependencies.postgres.status === 'up'
    && result.dependencies.redis.status === 'up'
    && result.dependencies.migrations.status === 'up';
});
function readSyncStartHealth(path) {
  return execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'syncstart', 'wget', '--quiet', '--output-document=-', `http://127.0.0.1:3002${path}`],
    { encoding: 'utf8' },
  );
}
const syncStartLiveness = JSON.parse(readSyncStartHealth('/health/live'));
if (syncStartLiveness.status !== 'ok') throw new Error('SyncStart liveness returned an unexpected response');
console.log('PASS: SyncStart liveness');
const syncStartReadiness = JSON.parse(readSyncStartHealth('/health/ready'));
if (!(syncStartReadiness.status === 'ready' && syncStartReadiness.dependencies.redis.status === 'up')) {
  throw new Error('SyncStart readiness returned an unexpected response');
}
console.log('PASS: SyncStart readiness');
for (const [index, realtimeUrl] of realtimeUrls.entries()) {
  await expectResponse(`realtime replica ${index + 1} liveness`, `${realtimeUrl}/health/live`, (body) => JSON.parse(body).status === 'ok');
  await expectResponse(`realtime replica ${index + 1} readiness`, `${realtimeUrl}/health/ready`, (body) => {
    const result = JSON.parse(body);
    return result.status === 'ready' && result.dependencies.redis.status === 'up';
  });
}
await expectResponse('Swagger document', `${apiUrl}/api-docs-json`, (body) => JSON.parse(body).openapi !== undefined);
await expectResponse('deterministic local seed', `${apiUrl}/tournaments/public`, (body) => {
  const tournaments = JSON.parse(body);
  return tournaments.some((tournament) => tournament.name === seedName);
});
await expectResponse('frontend', frontendUrl, (body) => body.includes('<div id="root">'));
