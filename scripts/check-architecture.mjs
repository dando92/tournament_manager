import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];
const apps = ['api', 'migrations', 'local-fixtures', 'syncstart', 'realtime', 'frontend'];

function filesBelow(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function packageJson(path) {
  return JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'));
}

function internalDependencies(pkg) {
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((name) =>
    name.startsWith('@tournament-manager/'),
  );
}

if (existsSync(join(root, 'apps', 'backend'))) {
  errors.push('apps/backend is obsolete; the HTTP service must live in apps/api');
}

for (const app of apps) {
  for (const directory of ['src', 'tests']) {
    if (!existsSync(join(root, 'apps', app, directory))) {
      errors.push(`apps/${app}/${directory} is required`);
    }
  }
  const nestedTests = filesBelow(join(root, 'apps', app, 'src')).filter((path) =>
    /\.(spec|test)\.[cm]?[jt]sx?$/.test(path),
  );
  for (const path of nestedTests) {
    errors.push(`app test must be under sibling tests/: ${relative(root, path)}`);
  }
}

const deploymentCompose = readFileSync(join(root, 'deploy', 'docker-compose.yml'), 'utf8');
for (const app of apps.filter((app) => app !== 'local-fixtures')) {
  const imageName = app === 'api' ? 'api' : app;
  if (!deploymentCompose.includes(`tournament-manager-${imageName}:\${RELEASE_SHA}`)) {
    errors.push(`deployment image for ${app} must use the immutable RELEASE_SHA tag`);
  }
}
if (/^\s+build:/m.test(deploymentCompose)) {
  errors.push('deployment Compose must consume published images instead of rebuilding source');
}

const deliveryWorkflow = readFileSync(join(root, '.github', 'workflows', 'delivery.yml'), 'utf8');
for (const required of [
  'npm run lint',
  'npm run test:contract',
  'npm run test:unit',
  'npm run test:e2e',
  'npm run build',
  'npm run verify:local',
  'type=raw,value=${{ github.sha }}',
  'Apply migrations once',
  'Smoke test release',
  'Roll back failed promotion',
]) {
  if (!deliveryWorkflow.includes(required)) {
    errors.push(`delivery workflow is missing required stage: ${required}`);
  }
}
if (/type=raw,value=(latest|testing)/.test(deliveryWorkflow)) {
  errors.push('delivery workflow must not publish mutable release tags');
}

const allowedDependencies = new Map([
  ['@tournament-manager/contracts', []],
  ['@tournament-manager/scoring', []],
  ['@tournament-manager/persistence', ['@tournament-manager/scoring']],
  ['@tournament-manager/live-messaging', ['@tournament-manager/contracts']],
  ['@tournament-manager/startgg', []],
  ['@tournament-manager/migrations', ['@tournament-manager/persistence']],
  ['@tournament-manager/local-fixtures', [
    '@tournament-manager/contracts',
    '@tournament-manager/live-messaging',
    '@tournament-manager/persistence',
  ]],
  ['@tournament-manager/api', [
    '@tournament-manager/scoring',
    '@tournament-manager/contracts',
    '@tournament-manager/live-messaging',
    '@tournament-manager/persistence',
    '@tournament-manager/startgg',
  ]],
  ['@tournament-manager/syncstart', [
    '@tournament-manager/contracts',
    '@tournament-manager/live-messaging',
  ]],
  ['@tournament-manager/realtime', [
    '@tournament-manager/contracts',
    '@tournament-manager/live-messaging',
  ]],
  ['tournament-viewer', []],
]);

for (const workspace of [
  'packages/contracts',
  'packages/scoring',
  'packages/persistence',
  'packages/live-messaging',
  'packages/startgg',
  ...apps.map((app) => `apps/${app}`),
]) {
  const pkg = packageJson(workspace);
  const allowed = new Set(allowedDependencies.get(pkg.name) ?? []);
  for (const dependency of internalDependencies(pkg)) {
    if (!allowed.has(dependency)) {
      errors.push(`${pkg.name} must not depend on ${dependency}`);
    }
  }
}

for (const path of [
  ...filesBelow(join(root, 'packages', 'contracts', 'src')),
  ...filesBelow(join(root, 'packages', 'scoring', 'src')),
]) {
  const source = readFileSync(path, 'utf8');
  if (/from\s+['"](?:typeorm|redis|@nestjs\/)/.test(source)) {
    errors.push(`domain contract/application code imports infrastructure: ${relative(root, path)}`);
  }
}

for (const app of apps) {
  for (const path of filesBelow(join(root, 'apps', app, 'src'))) {
    const source = readFileSync(path, 'utf8');
    for (const other of apps.filter((candidate) => candidate !== app)) {
      if (source.includes(`@${other}/`) || source.includes(`apps/${other}/src`)) {
        errors.push(`cross-app source import in ${relative(root, path)}: ${other}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Architecture boundaries verified.');
