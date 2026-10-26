/* Vitrine — the build.
 *
 * Bundles src/newtab.ts into one file and copies the static half of the
 * extension over unchanged. dist/ is what Chrome loads and what ships; its
 * contents are disposable, and `npm run clean` empties it — but the folder
 * itself is kept, because the browser is pointed at it.
 *
 * Type checking is deliberately not part of this: esbuild strips types
 * without reading them, which is what makes it quick. `npm run check` runs
 * tsc, and `npm run package` will not build without it passing first.
 */

import * as esbuild from 'esbuild';
import { cp, rm, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');
const release = process.argv.includes('--release');

/** The half of the extension that is not TypeScript. */
async function copyStatic() {
  await cp('static', 'dist', { recursive: true });
}

/* An unpacked extension's ID is worked out from the folder it was loaded
   from, so re-adding it from anywhere else — or from the same folder under a
   new Flatpak portal path — makes it a new extension, with empty storage and
   none of the permissions it was granted. A public key in the manifest fixes
   the ID instead, so settings and feeds survive a remove and re-add.
   ID: halafbilchhpkgaaanbdnacmaafcpond. Only the public half exists; an
   unpacked load needs nothing more.

   Left out of a --release build: the Chrome Web Store rejects a manifest
   carrying a key and assigns its own. */
const DEV_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAykiy9CQvabzxa53V/LVf6e1Mq7JLjk5wC4a68ZiSNhpuY4d0NFE3Cv580YBq/1M0DMQffiykN0oESc+2Jb/xczFrzA3ofqYUckg5mIJI5nCjot244dQ4Jz127NkDz20jc9PVV2M03nG4jgGD/qykhtlqcRbncu9X/KzE0XEWHqIJQXNiJEHRgOI/AlMBcy17mrLxS87FI4Z2NF6ivNgDPN+v2VSymv8QwEcO8ukUlpyzg0A1IOjtW4oVh2aWLDqyNE/IVpivlnPfNBs9ABdLNk4AFGa5sWF+lmE5WEZX9F55EYt5W8PwadQKAZOYvOYabxA0WMN1lHYm19FVcNRI8wIDAQAB';

async function pinId() {
  const path = 'dist/manifest.json';
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...manifest, key: DEV_KEY }, null, 2) + '\n');
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

/* Empty dist/ rather than deleting it. The browser holds on to the folder it
   loaded the extension from, and under Flatpak it reaches that folder through
   a document portal link to that exact directory: delete it and the link
   dies, the extension vanishes, and re-adding it gives a new portal path. The
   folder itself has to outlive every build. */
async function emptyDist() {
  await mkdir('dist', { recursive: true });
  const names = await readdir('dist');
  await Promise.all(names.map((n) => rm(join('dist', n), { recursive: true, force: true })));
}

await emptyDist();
await copyStatic();
if (!release) await pinId();

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/ — ^C to stop');
} else {
  await esbuild.build(options);
}
