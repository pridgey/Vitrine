/* Vitrine — the build.
 *
 * Bundles src/newtab.ts into one file and copies the static half of the
 * extension over unchanged. dist/ is what Chrome loads and what ships; it is
 * disposable, and `npm run clean` throws it away.
 *
 * Type checking is deliberately not part of this: esbuild strips types
 * without reading them, which is what makes it quick. `npm run check` runs
 * tsc, and `npm run package` will not build without it passing first.
 */

import * as esbuild from 'esbuild';
import { cp, rm, mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

/** The half of the extension that is not TypeScript. */
async function copyStatic() {
  await cp('static', 'dist', { recursive: true });
}

/** @type {esbuild.BuildOptions} */
const options = {
  entryPoints: ['src/newtab.ts'],
  bundle: true,
  outfile: 'dist/newtab.js',
  format: 'esm',
  target: 'chrome116',        // Manifest V3's floor is well below this
  charset: 'utf8',
  // A stack trace from a bundle is worth nothing without one, and it costs
  // only a file Chrome never loads unless devtools is open.
  sourcemap: true,
  minify,
  legalComments: 'none',
  logLevel: 'info'
};

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await copyStatic();

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/ — ^C to stop');
} else {
  await esbuild.build(options);
}
