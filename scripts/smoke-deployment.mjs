const apiUrl = process.env.DEPLOY_API_URL ?? 'http://127.0.0.1:3000';
const realtimeUrl = process.env.DEPLOY_REALTIME_URL ?? 'http://127.0.0.1:3003';
const frontendUrl = process.env.DEPLOY_FRONTEND_URL ?? 'http://127.0.0.1:8080';

async function expectResponse(label, url, predicate) {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok || !predicate(body)) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }
  console.log(`PASS: ${label}`);
}

await expectResponse('API readiness', `${apiUrl}/health/ready`, (body) => {
  const result = JSON.parse(body);
  return result.status === 'ready'
    && result.dependencies.postgres.status === 'up'
    && result.dependencies.redis.status === 'up'
    && result.dependencies.migrations.status === 'up';
});
await expectResponse('Swagger document', `${apiUrl}/api-docs-json`, (body) =>
  JSON.parse(body).openapi !== undefined,
);
await expectResponse('realtime readiness', `${realtimeUrl}/health/ready`, (body) => {
  const result = JSON.parse(body);
  return result.status === 'ready' && result.dependencies.redis.status === 'up';
});
await expectResponse('frontend', frontendUrl, (body) =>
  body.includes('<div id="root"></div>') && body.includes('/runtime-config.js'),
);
