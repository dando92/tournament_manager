import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const errors = [];
const apps = [
  "api",
  "migrations",
  "local-fixtures",
  "syncstart",
  "realtime",
  "frontend",
];
const tools = ["syncstart-simulator", "legacy-syncstart-bridge"];

const prettierConfigPath = join(root, ".prettierrc.json");
if (!existsSync(prettierConfigPath)) {
  errors.push("the repository-root Prettier configuration is required");
} else {
  const prettierConfig = JSON.parse(readFileSync(prettierConfigPath, "utf8"));
  const expectedPrettierConfig = {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
  };
  if (
    JSON.stringify(prettierConfig) !== JSON.stringify(expectedPrettierConfig)
  ) {
    errors.push(
      "the repository-root Prettier configuration must keep the approved standard defaults",
    );
  }
}

if (existsSync(join(root, "apps", "api", ".prettierrc"))) {
  errors.push("workspace-specific Prettier overrides are forbidden");
}

function filesBelow(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "coverage"
    )
      return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function packageJson(path) {
  return JSON.parse(readFileSync(join(root, path, "package.json"), "utf8"));
}

function internalDependencies(pkg) {
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
    (name) => name.startsWith("@tournament-manager/"),
  );
}

if (existsSync(join(root, "apps", "backend"))) {
  errors.push(
    "apps/backend is obsolete; the HTTP service must live in apps/api",
  );
}

for (const app of apps) {
  for (const directory of ["src", "tests"]) {
    if (!existsSync(join(root, "apps", app, directory))) {
      errors.push(`apps/${app}/${directory} is required`);
    }
  }
  const nestedTests = filesBelow(join(root, "apps", app, "src")).filter(
    (path) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(path),
  );
  for (const path of nestedTests) {
    errors.push(
      `app test must be under sibling tests/: ${relative(root, path)}`,
    );
  }
}

const forbiddenApiPaths = [
  "apps/api/src/account/dtos.ts",
  "apps/api/src/account/controllers",
  "apps/api/src/account/services",
  "apps/api/src/auth/controllers",
  "apps/api/src/auth/dtos",
  "apps/api/src/auth/guards.ts",
  "apps/api/src/auth/services",
  "apps/api/src/auth/strategies.ts",
  "apps/api/src/tournament/dtos.ts",
  "apps/api/src/tournament/guards",
  "apps/api/src/tournament/competition/match/services",
  "apps/api/src/tournament/structure/controllers",
  "apps/api/src/tournament/structure/dtos",
  "apps/api/src/tournament/structure/services",
];

for (const path of forbiddenApiPaths) {
  if (existsSync(join(root, path))) {
    errors.push(`obsolete API refactoring path must be absent: ${path}`);
  }
}

for (const path of filesBelow(join(root, "apps", "api", "src"))) {
  const source = readFileSync(path, "utf8");
  if (/from\s+['"]@tournament\/dtos['"]/.test(source)) {
    errors.push(
      `API request DTO barrel import is forbidden: ${relative(root, path)}`,
    );
  }
  if (/from\s+['"]@auth\/(?:guards|strategies)['"]/.test(source)) {
    errors.push(`API auth barrel import is forbidden: ${relative(root, path)}`);
  }
}

for (const path of filesBelow(join(root, "apps", "frontend", "src"))) {
  const source = readFileSync(path, "utf8");
  const normalized = relative(
    join(root, "apps", "frontend", "src"),
    path,
  ).replaceAll("\\", "/");
  if (
    /from\s+['"]axios['"]/.test(source) &&
    normalized !== "app/providers.tsx" &&
    !/^features\/[^/]+\/api\//.test(normalized)
  ) {
    errors.push(
      `frontend axios import must live in a feature API module: ${relative(root, path)}`,
    );
  }
}

for (const directory of [
  join(root, "apps", "frontend", "src"),
  join(root, "apps", "realtime", "src"),
]) {
  for (const path of filesBelow(directory)) {
    const source = readFileSync(path, "utf8");
    if (/export\s+type\s+LiveMatch(?:State|Player)Dto\b/.test(source)) {
      errors.push(
        `realtime gateway DTO must be declared in contracts: ${relative(root, path)}`,
      );
    }
  }
}

for (const tool of tools) {
  const sourceFiles = filesBelow(join(root, "tools", tool, "src"));
  if (
    sourceFiles.some((path) =>
      /@tournament-manager\/syncstart-protocol/.test(
        readFileSync(path, "utf8"),
      ),
    )
  ) {
    errors.push(
      `tools/${tool} must remain independent from the protocol package`,
    );
  }
}

const deploymentCompose = readFileSync(
  join(root, "deploy", "docker-compose.yml"),
  "utf8",
);
for (const app of apps.filter((app) => app !== "local-fixtures")) {
  const imageName = app === "api" ? "api" : app;
  if (
    !deploymentCompose.includes(
      `tournament-manager-${imageName}:\${RELEASE_SHA}`,
    )
  ) {
    errors.push(
      `deployment image for ${app} must use the immutable RELEASE_SHA tag`,
    );
  }
}
if (/^\s+build:/m.test(deploymentCompose)) {
  errors.push(
    "deployment Compose must consume published images instead of rebuilding source",
  );
}

const localCompose = readFileSync(join(root, "docker-compose.yml"), "utf8");
const localRealtimeReplicas = (
  localCompose.match(/^ {2}realtime[a-z0-9-]*:$/gm) ?? []
).length;
if (localRealtimeReplicas < 2) {
  errors.push(
    "local Compose must run at least two realtime replicas; they verify that Pub/Sub fan-out converges without client affinity",
  );
}

const deliveryWorkflow = readFileSync(
  join(root, ".github", "workflows", "delivery.yml"),
  "utf8",
);
for (const required of [
  "npm run lint",
  "npm run test:contract",
  "npm run test:unit",
  "npm run test:e2e",
  "npm run build",
  "npm run verify:local",
  "type=raw,value=${{ github.sha }}",
  "Apply migrations once",
  "Smoke test release",
  "Roll back failed promotion",
]) {
  if (!deliveryWorkflow.includes(required)) {
    errors.push(`delivery workflow is missing required stage: ${required}`);
  }
}
if (/type=raw,value=(latest|testing)/.test(deliveryWorkflow)) {
  errors.push("delivery workflow must not publish mutable release tags");
}

const allowedDependencies = new Map([
  ["@tournament-manager/contracts", ["@tournament-manager/scoring"]],
  ["@tournament-manager/scoring", []],
  ["@tournament-manager/persistence", ["@tournament-manager/scoring"]],
  ["@tournament-manager/live-messaging", ["@tournament-manager/contracts"]],
  ["@tournament-manager/syncstart-protocol", ["@tournament-manager/contracts"]],
  ["@tournament-manager/startgg", []],
  ["@tournament-manager/migrations", ["@tournament-manager/persistence"]],
  [
    "@tournament-manager/local-fixtures",
    [
      "@tournament-manager/contracts",
      "@tournament-manager/live-messaging",
      "@tournament-manager/persistence",
    ],
  ],
  [
    "@tournament-manager/api",
    [
      "@tournament-manager/scoring",
      "@tournament-manager/contracts",
      "@tournament-manager/live-messaging",
      "@tournament-manager/persistence",
      "@tournament-manager/startgg",
    ],
  ],
  [
    "@tournament-manager/syncstart",
    [
      "@tournament-manager/contracts",
      "@tournament-manager/live-messaging",
      "@tournament-manager/syncstart-protocol",
    ],
  ],
  [
    "@tournament-manager/realtime",
    ["@tournament-manager/contracts", "@tournament-manager/live-messaging"],
  ],
  ["tournament-viewer", ["@tournament-manager/contracts"]],
]);

for (const workspace of [
  "packages/contracts",
  "packages/scoring",
  "packages/persistence",
  "packages/live-messaging",
  "packages/syncstart-protocol",
  "packages/startgg",
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

/*
 * An image builds its workspaces by a hand-written chain, so nothing forces
 * that chain to agree with the dependency graph. When contracts gained its
 * dependency on scoring, three Dockerfiles kept building contracts first and
 * every image stopped building — the graph and the images had drifted with no
 * failing check between them.
 */
const workspaceDirectories = [
  "packages/contracts",
  "packages/scoring",
  "packages/persistence",
  "packages/live-messaging",
  "packages/syncstart-protocol",
  "packages/startgg",
  ...apps.map((app) => `apps/${app}`),
];
const dependencyGraph = new Map(
  workspaceDirectories.map((directory) => {
    const pkg = packageJson(directory);
    return [pkg.name, internalDependencies(pkg)];
  }),
);

function transitiveDependencies(name, seen = new Set()) {
  for (const dependency of dependencyGraph.get(name) ?? []) {
    if (seen.has(dependency)) continue;
    seen.add(dependency);
    transitiveDependencies(dependency, seen);
  }
  return seen;
}

for (const app of apps) {
  const dockerfilePath = join(root, "apps", app, "Dockerfile");
  if (!existsSync(dockerfilePath)) {
    errors.push(`apps/${app}/Dockerfile is required`);
    continue;
  }

  const name = packageJson(`apps/${app}`).name;
  const built = readFileSync(dockerfilePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("npm run build"))
    .flatMap((line) =>
      [...line.matchAll(/--workspace=(\S+)/g)].map((match) => match[1]),
    );
  const position = new Map(built.map((workspace, index) => [workspace, index]));

  if (!position.has(name)) {
    errors.push(`apps/${app}/Dockerfile must build ${name}`);
    continue;
  }

  const required = transitiveDependencies(name);
  for (const dependency of required) {
    if (!position.has(dependency)) {
      errors.push(
        `apps/${app}/Dockerfile must build ${dependency}, which ${name} depends on`,
      );
    }
  }
  for (const dependent of [name, ...required]) {
    for (const dependency of dependencyGraph.get(dependent) ?? []) {
      if (!position.has(dependency) || !position.has(dependent)) continue;
      if (position.get(dependency) > position.get(dependent)) {
        errors.push(
          `apps/${app}/Dockerfile builds ${dependent} before its dependency ${dependency}`,
        );
      }
    }
  }
}

for (const path of [
  ...filesBelow(join(root, "packages", "contracts", "src")),
  ...filesBelow(join(root, "packages", "scoring", "src")),
]) {
  const source = readFileSync(path, "utf8");
  if (/from\s+['"](?:typeorm|redis|@nestjs\/)/.test(source)) {
    errors.push(
      `domain contract/application code imports infrastructure: ${relative(root, path)}`,
    );
  }
}

for (const app of apps) {
  for (const path of filesBelow(join(root, "apps", app, "src"))) {
    const source = readFileSync(path, "utf8");
    for (const other of apps.filter((candidate) => candidate !== app)) {
      if (
        source.includes(`@${other}/`) ||
        source.includes(`apps/${other}/src`)
      ) {
        errors.push(
          `cross-app source import in ${relative(root, path)}: ${other}`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Architecture boundaries verified.");
