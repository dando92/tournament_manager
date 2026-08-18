import { execFileSync } from 'node:child_process';

const apiUrl = process.env.LOCAL_API_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? 3000}`;

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

try {
  const output = execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'processor', 'wget', '--quiet', '--output-document=-', 'http://127.0.0.1:3001/health/ready'],
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
