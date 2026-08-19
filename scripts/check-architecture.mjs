import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];
const apps = ['api', 'processor', 'syncstart', 'realtime', 'frontend'];

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

const allowedDependencies = new Map([
  ['@tournament-manager/contracts', []],
  ['@tournament-manager/application', []],
  ['@tournament-manager/persistence', []],
  ['@tournament-manager/eventing', ['@tournament-manager/contracts']],
  ['@tournament-manager/api', [
    '@tournament-manager/application',
    '@tournament-manager/contracts',
    '@tournament-manager/eventing',
    '@tournament-manager/persistence',
  ]],
  ['@tournament-manager/processor', [
    '@tournament-manager/application',
    '@tournament-manager/contracts',
    '@tournament-manager/eventing',
    '@tournament-manager/persistence',
  ]],
  ['@tournament-manager/syncstart', [
    '@tournament-manager/contracts',
    '@tournament-manager/eventing',
  ]],
  ['@tournament-manager/realtime', [
    '@tournament-manager/contracts',
    '@tournament-manager/eventing',
  ]],
  ['tournament-viewer', []],
]);

for (const workspace of [
  'packages/contracts',
  'packages/application',
  'packages/persistence',
  'packages/eventing',
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
  ...filesBelow(join(root, 'packages', 'application', 'src')),
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
