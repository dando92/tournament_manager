import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Teaches `node --test` the `@/` alias Vite and TypeScript already know.
 *
 * The suites run the source directly rather than a build, so a module under
 * test that imports a value — not just a type — through the alias would not
 * resolve. Without this, only files whose every import is `import type` could
 * be tested, which is a strange rule for what a test may cover.
 */
const sourceRoot = `${resolve(dirname(fileURLToPath(import.meta.url)), '../../src')}/`;
const EXTENSIONS = ['', '.ts', '.tsx', '.js'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) return nextResolve(specifier, context);

    const base = resolve(sourceRoot, specifier.slice('@/'.length));
    const found = EXTENSIONS.map((extension) => `${base}${extension}`).find(
      (candidate) => existsSync(candidate),
    );
    if (!found) throw new Error(`Cannot resolve ${specifier} under ${sourceRoot}`);

    return { url: pathToFileURL(found).href, shortCircuit: true };
  },
});
