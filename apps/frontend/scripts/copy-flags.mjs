import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Puts the country flags where the application serves them from.
 *
 * `flag-icons` ships the SVGs and a stylesheet that maps a class to each one.
 * The stylesheet is what is not taken: it carries a rule per country, so every
 * visitor downloads twenty-eight kilobytes of `url()` to draw the dozen flags a
 * page actually shows. An `<img>` per flag costs one small request each, cached
 * after the first, and nothing at all for a page with no flags on it.
 *
 * Copied rather than committed, so the package stays the source of truth and two
 * hundred and seventy files stay out of the history. `public/flags` is ignored
 * by git; this runs before `dev` and before `build`.
 */
const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve('flag-icons/package.json')), 'flags', '4x3');
const target = fileURLToPath(new URL('../public/flags/', import.meta.url));

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`Copied country flags into ${target}`);
