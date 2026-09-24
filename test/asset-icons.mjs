/**
 * Asset marks: the logo URL, and the checksum it depends on.
 *
 * The Trustwallet repo stores EVM tokens under their EIP-55 checksummed
 * address and 404s on a lowercase path, so a wrong checksum would silently
 * lose every token logo. The addresses below are published checksummed forms.
 *
 *   node test/asset-icons.mjs
 */
import {
  assetIconMarkup, assetLogoUrl, chainBrandColor, chainLogoUrl, toChecksumAddress,
} from '../asset-icons.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);
const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

section('EIP-55 checksum');
// The four vectors from the EIP itself.
ck('all caps', toChecksumAddress('0x52908400098527886e0f7030069857d2e4169ee7'),
  '0x52908400098527886E0F7030069857D2E4169EE7');
ck('all lower', toChecksumAddress('0xde709f2102306220921060314715629080e2fb77'),
  '0xde709f2102306220921060314715629080e2fb77');
ck('mixed 1', toChecksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
ck('mixed 2', toChecksumAddress('0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'),
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359');
// The one that matters in practice: USDC on Base.
ck('USDC on Base', toChecksumAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
ck('already checksummed is stable', toChecksumAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
ck('not an address', toChecksumAddress('nope'), null);
ck('nothing', toChecksumAddress(null), null);

section('logo urls');
ck('a native coin', assetLogoUrl({ blockchain: 'sol', symbol: 'SOL' }), `${TW}/solana/info/logo.png`);
// Three chains whose folder name is not the obvious guess.
ck('dogecoin is doge', assetLogoUrl({ blockchain: 'doge', symbol: 'DOGE' }), `${TW}/doge/info/logo.png`);
ck('gnosis is xdai', assetLogoUrl({ blockchain: 'gnosis', symbol: 'XDAI' }), `${TW}/xdai/info/logo.png`);
ck('xrp is ripple', assetLogoUrl({ blockchain: 'xrp', symbol: 'XRP' }), `${TW}/ripple/info/logo.png`);
// A chain's info logo is its own coin's, so it must not stand in for a token
// that happens to lack an address -- USDC on Base is not the Base logo.
ck('a token with no address gets no chain logo',
  assetLogoUrl({ blockchain: 'base', symbol: 'USDC' }), null);
ck('  while the chain coin still does',
  assetLogoUrl({ blockchain: 'base', symbol: 'ETH' }), `${TW}/base/info/logo.png`);
ck('a token is checksummed into the path',
  assetLogoUrl({ blockchain: 'base', contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' }),
  `${TW}/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png`);
// Non-EVM contract ids are not hex and must pass through untouched.
ck('a solana mint is left alone',
  assetLogoUrl({ blockchain: 'sol', contractAddress: 'So11111111111111111111111111111111111111112' }),
  `${TW}/solana/assets/So11111111111111111111111111111111111111112/logo.png`);
ck('a chain with no folder', assetLogoUrl({ blockchain: 'fogo', symbol: 'FOGO' }), null);
ck('no chain at all', assetLogoUrl({}), null);
ck('a malformed evm address', assetLogoUrl({ blockchain: 'base', contractAddress: '0x12' }), null);

section('network marks');
// A network row is the chain, not the asset: SOL on Aptos and SOL on Solana
// must not both wear the Solana logo.
ck('a chain logo ignores the asset', chainLogoUrl('aptos'), `${TW}/aptos/info/logo.png`);
ck('  and differs per chain', chainLogoUrl('sol'), `${TW}/solana/info/logo.png`);
ck('an unmapped chain has none', chainLogoUrl('fogo'), null);
ck('nothing at all', chainLogoUrl(undefined), null);
// Colour comes from the chain's own coin, so Base is ETH blue not a random hue.
ck('base borrows its coin colour', chainBrandColor('base'), chainBrandColor('eth'));
ck('an unmapped chain still gets a colour', /^hsl\(/.test(chainBrandColor('fogo')), true);

section('the mark itself');
{
  const withLogo = assetIconMarkup({ symbol: 'SOL', blockchain: 'sol' });  // native
  // The drawn disc is the base layer, so a 404 needs no error handling.
  ck('carries the drawn glyph', withLogo.includes('<svg'), true);
  ck('  and the image over it', withLogo.includes('asset-mark-image'), true);
  ck('  lazily', withLogo.includes('loading="lazy"'), true);

  const noLogo = assetIconMarkup({ symbol: 'FOGO', blockchain: 'fogo' });
  ck('an unmapped chain draws only', noLogo.includes('asset-mark-image'), false);
  ck('  falling back to letters', noLogo.includes('FOGO'), true);

  ck('a bare symbol still works', assetIconMarkup('BTC').includes('<svg'), true);
  // The url reaches an attribute, so it goes through the caller's escaper.
  let escaped = 0;
  assetIconMarkup({ symbol: 'USDC', blockchain: 'base', contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
    { escape: (v) => { escaped++; return v; } });
  ck('every interpolation is escaped', escaped > 0, true);
}

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
