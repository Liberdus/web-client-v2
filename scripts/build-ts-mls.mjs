/**
 * Builds external/ts-mls.js — the vendored MLS bundle used by group chat.
 *
 *   npm install && npm run build:mls
 *
 * The client has no build step for application code; third-party libraries are
 * committed under external/ (see noble-*.js). This script produces that
 * artifact so the vendored file is reproducible rather than mystery bytes.
 *
 * Pinned to the hybrid post-quantum ciphersuite
 * MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519 (X25519 + ML-KEM-768), which
 * matches the KDF(ECDH || ML-KEM) construction already used for 1:1 chat.
 *
 * Deliberately does NOT bundle ML-KEM, HKDF or ChaCha: crypto.js already
 * provides those (generatePQKeys / pqSharedKey / deriveDhKey / encryptChacha),
 * and reusing them means the post-quantum PSK is sealed to exactly the same
 * ML-KEM-1024 identity as 1:1 chat rather than a second, parallel
 * implementation. Only ed25519 is re-exported, for deriving the MLS signature
 * key from the account's existing pqSeed.
 *
 * NOTE ON VERSIONS: ts-mls pins several peer dependencies to EXACT versions
 * (@noble/ciphers 2.1.1 among them), so package.json pins them to match — do
 * not loosen those to ^ranges or `npm install` will fail to resolve.
 * @noble/hashes is imported by ts-mls but not declared by it, so we depend on
 * it directly.
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outfile = path.join(root, 'external', 'ts-mls.js');
const entry = path.join(root, 'scripts', '.ts-mls-entry.mjs');

// Re-export only what mlsEngine.js needs, so the bundle carries no dead API.
fs.writeFileSync(
  entry,
  `
export * from 'ts-mls';
import '@hpke/chacha20poly1305';
import '@hpke/hybridkem-x-wing';
export { ed25519 } from '@noble/curves/ed25519.js';
// The ratchet tree codec is not in ts-mls's public index, but it is the only
// safe thing to publish for a joiner: encodeGroupState carries the key
// schedule, the secret tree and the signature private key.
export { encodeRatchetTree, decodeRatchetTree } from 'ts-mls/ratchetTree.js';
// Per-node codec. The ratchet tree is published to the chain as a DELTA of
// individual nodes addressed by index, so the server can apply it without
// parsing MLS; these are what encode and decode one node of that delta.
export { encodeNode, decodeNode } from 'ts-mls/ratchetTree.js';
// RFC-correct tree math. The FILTERED direct path already drops levels whose
// copath resolution is empty, which is exactly the "blank node that costs
// nothing" case our path-update trigger must not chase.
export { filteredDirectPath } from 'ts-mls/ratchetTree.js';
// decodeRatchetTree applies this after decoding; treeFromWire must too, or the
// array is short and every width-derived calculation (and therefore every tree
// hash) comes out wrong.
export { extendRatchetTree } from 'ts-mls/ratchetTree.js';
`,
);

/**
 * PATCH: RFC 9420 §12.4 — a Commit MUST carry an UpdatePath when it covers at
 * least one Update or Remove proposal.
 *
 * ts-mls 1.6.2 tests `> 1` instead of `> 0`, so a commit removing exactly ONE
 * member — the only kind our UI produces — omits the UpdatePath entirely. The
 * tree is never rekeyed, the commit secret stays all-zeroes, and the next epoch
 * derives from the previous initSecret plus the PSK. A removed member holds the
 * first and can ratchet the second, so they keep deriving group secrets after
 * removal. test/removal-effective.mjs demonstrates this and is the regression
 * test for this patch.
 *
 * Applied at build time rather than in node_modules so that `npm ci` cannot
 * silently drop it, and so the change is visible in this script rather than in
 * a file nobody reads. Remove once fixed upstream.
 */
const rfc9420UpdatePath = {
  name: 'rfc9420-update-path',
  setup(b) {
    b.onLoad({ filter: /ts-mls[\\/]dist[\\/]src[\\/]clientState\.js$/ }, async (args) => {
      const src = await fs.promises.readFile(args.path, 'utf8');
      const from =
        'Object.values(grouped.update).length > 1 || Object.values(grouped.remove).length > 1';
      const to =
        'Object.values(grouped.update).length > 0 || Object.values(grouped.remove).length > 0';
      if (!src.includes(from)) {
        // Fail loudly: a silently unapplied security patch is worse than none.
        throw new Error(
          'build-ts-mls: needsUpdatePath patch target not found in clientState.js. ' +
            'ts-mls may have fixed or refactored this — re-check RFC 9420 §12.4 ' +
            'and run test/removal-effective.mjs before removing this patch.',
        );
      }
      return { contents: src.replace(from, to), loader: 'js' };
    });
  },
};

const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile,
  // NOT minified, on purpose. Every other file in external/ is readable source,
  // and crypto.js states the rule this follows: security code in this client
  // must be auditable as shipped, not merely reproducible from a build script.
  //
  // This is not free: 318 KB -> 675 KB on disk, and 96 KB -> 143 KB gzipped,
  // which is what the wire actually carries. We accept ~47 KB of transfer for a
  // bundle a reviewer can read.
  //
  // Note that app.js -> groupManager.js -> mlsEngine.js imports this statically,
  // so every page load pays it, not just users who open group chat. Making that
  // import dynamic would confine the cost to group-chat users.
  minify: false,
  // Keep upstream license headers rather than stripping them.
  legalComments: 'inline',
  metafile: true,
  plugins: [rfc9420UpdatePath],
  logLevel: 'error',
});

fs.unlinkSync(entry);

/**
 * Provenance header: the exact upstream packages this bundle was built from,
 * with the integrity hashes npm recorded when it fetched them. A reviewer can
 * check these against package-lock.json and against the npm registry without
 * trusting this machine.
 */
function provenance() {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const names = new Set();
  for (const input of Object.keys(result.metafile.inputs)) {
    // node_modules/@scope/name/dist/x.js -> @scope/name
    const m = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
    if (m) names.add(m[1]);
  }
  const lines = [...names].sort().map((name) => {
    const pkg = lock.packages[`node_modules/${name}`] || {};
    return ` *   ${name.padEnd(30)} ${(pkg.version || '?').padEnd(10)} ${pkg.integrity || ''}`;
  });
  return [
    '/*',
    ' * ts-mls + X-Wing + ML-KEM-1024 — vendored MLS bundle for group chat.',
    ' *',
    ' * GENERATED FILE. Do not edit; run `npm run build:mls` instead.',
    ' * Deliberately unminified so it can be read and audited as shipped.',
    ' *',
    ' * Built from these packages (name, version, npm integrity):',
    ...lines,
    ' *',
    ' * To verify: `npm ci && npm run build:mls` reproduces this file byte for',
    ' * byte, header included — the header is derived from package-lock.json and',
    ' * the bundler input list, so it carries no timestamps or machine state.',
    ' */',
    '',
  ].join('\n');
}

fs.writeFileSync(outfile, provenance() + fs.readFileSync(outfile, 'utf8'));

const raw = fs.readFileSync(outfile);
console.log(
  `external/ts-mls.js  ${(raw.length / 1024).toFixed(1)} KB raw, ` +
    `${(gzipSync(raw).length / 1024).toFixed(1)} KB gzip, ` +
    `${raw.toString().split('\n').length} lines`,
);
