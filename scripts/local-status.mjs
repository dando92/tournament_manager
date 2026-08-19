import { execFileSync } from 'node:child_process';

const apiUrl = process.env.LOCAL_API_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? 3000}`;
const realtimeUrls = [
  process.env.LOCAL_REALTIME_URL ?? `http://127.0.0.1:${process.env.REALTIME_PORT ?? 3003}`,
  process.env.LOCAL_REALTIME_REPLICA_URL ?? `http://127.0.0.1:${process.env.REALTIME_REPLICA_PORT ?? 3004}`,
];

try {
  const response = await fetch(`${apiUrl}/health/ready`);
  const result = await response.json();
  console.log('\nAPI readiness and migration status:');
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(`\nAPI readiness unavailable at ${apiUrl}: ${error.message}`);
  process.exitCode = 1;
}

for (const [index, realtimeUrl] of realtimeUrls.entries()) {
  try {
    const response = await fetch(`${realtimeUrl}/health/ready`);
    const result = await response.json();
    console.log(`\nRealtime replica ${index + 1} readiness:`);
    console.log(JSON.stringify(result, null, 2));
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`\nRealtime replica ${index + 1} readiness unavailable at ${realtimeUrl}: ${error.message}`);
    process.exitCode = 1;
  }
}

try {
  const output = execFileSync(
    'docker',
    { encoding: 'utf8' },
  );
  const result = JSON.parse(output);
  console.log('\nProcessor readiness and migration status:');
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ready') process.exitCode = 1;
} catch (error) {
  console.error(`\nProcessor readiness unavailable: ${error.message}`);
  process.exitCode = 1;
}
