// Asset marks.
//
// Logos come from the Trustwallet asset repo, which this app already hotlinks
// for the EVM network logos in evm-assets.js. It is keyed on chain and contract
// address -- both of which the token list gives us -- so there is no id table
// to hand-maintain and let rot, which is what ruled out CoinMarketCap: nothing
// in our data yields their numeric coin id.
//
// The trade is that the CDN sees which assets an account holds. That was a
// deliberate decision, and it is the same exposure the EVM wallet already has.
//
// Every mark still renders without the network: a brand-coloured disc carrying
// a glyph or the symbol sits underneath, and the image covers it only once it
// loads. A 404 -- and that repo 404s for plenty of tokens -- leaves the disc,
// with no broken-image frame and no JavaScript involved.

import keccak256 from './external/keccak256.js';

const TRUSTWALLET = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

// Our chain ids against that repo's folder names. Verified by fetching each:
// the obvious guesses are wrong for three of them -- Dogecoin is `doge`,
// Gnosis is `xdai`, XRP is `ripple`. Chains absent here have no folder, and
// fall through to the drawn mark.
// What each chain's own coin is called. A chain's `info/logo.png` is the logo
// of that coin, so it may only be used when the asset *is* that coin --
// otherwise USDC held on Base would render with the Base logo.
const CHAIN_NATIVE = Object.freeze({
  btc: 'BTC', eth: 'ETH', sol: 'SOL', bsc: 'BNB', pol: 'POL', avax: 'AVAX',
  arb: 'ETH', op: 'ETH', base: 'ETH', scroll: 'ETH', zec: 'ZEC', ltc: 'LTC',
  doge: 'DOGE', bch: 'BCH', dash: 'DASH', tron: 'TRX', ton: 'TON',
  cardano: 'ADA', aptos: 'APT', sui: 'SUI', stellar: 'XLM', xrp: 'XRP',
  gnosis: 'XDAI', near: 'NEAR',
});

const CHAIN_FOLDER = Object.freeze({
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', bsc: 'smartchain',
  pol: 'polygon', avax: 'avalanchec', arb: 'arbitrum', op: 'optimism',
  base: 'base', zec: 'zcash', ltc: 'litecoin', doge: 'doge',
  bch: 'bitcoincash', dash: 'dash', tron: 'tron', ton: 'ton',
  cardano: 'cardano', aptos: 'aptos', sui: 'sui', stellar: 'stellar',
  xrp: 'ripple', gnosis: 'xdai', near: 'near', scroll: 'scroll',
});

const BRAND = Object.freeze({
  BTC: '#f7931a', WBTC: '#f09242', CBBTC: '#0052ff', NBTC: '#f7931a',
  ETH: '#627eea', WETH: '#627eea', SOL: '#9945ff', USDC: '#2775ca',
  USDT: '#26a17b', USDT0: '#26a17b', NEAR: '#1c1c21', WNEAR: '#1c1c21',
  DOGE: '#c2a633', XRP: '#23292f', LTC: '#345d9d', BNB: '#f3ba2f',
  POL: '#8247e5', AVAX: '#e84142', TRX: '#eb0029', TON: '#0098ea',
  ADA: '#0033ad', SUI: '#4da2ff', APT: '#1c1c21', ZEC: '#f4b728',
  BCH: '#8dc351', DASH: '#008ce7', ARB: '#213147', OP: '#ff0420',
  SHIB: '#f00500', PEPE: '#3d8130', LINK: '#2a5ada', UNI: '#ff007a',
  AAVE: '#b6509e', DAI: '#f5ac37', XLM: '#1c1c21', STRK: '#0c0c4f',
});

// A glyph only where the shape is the recognisable part.
const GLYPH = Object.freeze({
  BTC: '<path d="M15.1 10.7c.2-1.5-.9-2.3-2.5-2.8l.5-2.1-1.3-.3-.5 2q-.5-.1-1-.2l.5-2.1-1.3-.3-.5 2.1-2.6-.6-.3 1.4s.9.2.9.2c.5.1.6.5.6.7l-1.4 5.8c-.1.2-.3.4-.6.3 0 0-.9-.2-.9-.2l-.6 1.5 2.5.6-.5 2.1 1.3.3.5-2.1q.5.2 1 .3l-.5 2.1 1.3.3.5-2.1c2.2.4 3.9.2 4.6-1.8.6-1.6 0-2.6-1.2-3.2.9-.2 1.5-.8 1.7-2zm-3 4.3c-.4 1.6-3.1.7-4 .5l.7-2.8c.9.2 3.7.6 3.3 2.3zm.4-4.4c-.4 1.5-2.6.7-3.3.5l.6-2.6c.8.2 3.1.5 2.7 2.1z" fill="currentColor"/>',
  ETH: '<path d="M12 3 7 12l5 3 5-3zM7 13.2 12 21l5-7.8-5 3z" fill="currentColor"/>',
  SOL: '<path d="M6.5 15.3h11a.5.5 0 0 1 .35.85l-1.9 1.9a.6.6 0 0 1-.4.15h-11a.5.5 0 0 1-.35-.85l1.9-1.9a.6.6 0 0 1 .4-.15zm0-9.2h11a.5.5 0 0 1 .35.85l-1.9 1.9a.6.6 0 0 1-.4.15h-11a.5.5 0 0 1-.35-.85l1.9-1.9a.6.6 0 0 1 .4-.15zm9.1 4.6a.6.6 0 0 1 .4.15l1.9 1.9a.5.5 0 0 1-.35.85h-11a.5.5 0 0 1-.35-.85l1.9-1.9a.6.6 0 0 1 .4-.15z" fill="currentColor"/>',
});

function hueFor(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

export function assetBrandColor(symbol) {
  const key = String(symbol || '').toUpperCase();
  return BRAND[key] || `hsl(${hueFor(key)} 58% 46%)`;
}

/**
 * EIP-55 mixed-case checksum.
 *
 * Not cosmetic here: the asset repo stores EVM tokens under the checksummed
 * address, and a lowercase path 404s.
 */
export function toChecksumAddress(address) {
  const hex = String(address || '').trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(hex)) return null;

  const bytes = new Uint8Array(hex.length);
  for (let i = 0; i < hex.length; i++) bytes[i] = hex.charCodeAt(i);
  const digest = keccak256(bytes);

  let out = '';
  for (let i = 0; i < hex.length; i++) {
    // One hex character of the digest per character of the address.
    const nibble = i % 2 === 0 ? digest[i >> 1] >> 4 : digest[i >> 1] & 0x0f;
    out += nibble >= 8 ? hex[i].toUpperCase() : hex[i];
  }
  return `0x${out}`;
}

/** Where the logo lives, or null when we have no path worth trying. */
export function assetLogoUrl({ blockchain, contractAddress, symbol } = {}) {
  const chain = String(blockchain || '').toLowerCase();
  const folder = CHAIN_FOLDER[chain];
  if (!folder) return null;

  if (contractAddress) {
    // EVM tokens are filed under the checksummed address; everything else
    // (an SPL mint, say) is filed under its own id and must pass through.
    const address = String(contractAddress).startsWith('0x')
      ? toChecksumAddress(contractAddress)
      : String(contractAddress);
    return address ? `${TRUSTWALLET}/${folder}/assets/${address}/logo.png` : null;
  }

  // No address, so the only path available is the chain's own coin. Use it
  // only when that is what this asset is; a wrong logo is worse than none.
  const native = CHAIN_NATIVE[chain];
  if (!native || native !== String(symbol || '').toUpperCase()) return null;
  return `${TRUSTWALLET}/${folder}/info/logo.png`;
}

/**
 * A network's own mark: the logo of the coin that chain runs on.
 *
 * Distinct from an asset's mark on purpose. In a network picker the rows are
 * chains, so SOL-on-Aptos and SOL-on-Solana must show Aptos and Solana -- the
 * asset's logo would make every row identical.
 */
export function chainLogoUrl(blockchain) {
  const folder = CHAIN_FOLDER[String(blockchain || '').toLowerCase()];
  return folder ? `${TRUSTWALLET}/${folder}/info/logo.png` : null;
}

export function chainBrandColor(blockchain) {
  const chain = String(blockchain || '').toLowerCase();
  return assetBrandColor(CHAIN_NATIVE[chain] || chain);
}

/**
 * The mark for an asset.
 *
 * The drawn disc is the base layer and the logo is laid over it, so a missing
 * logo needs no error handling: the image simply never covers what is already
 * there. `escape` is passed in so this module stays free of the app's helpers.
 */
export function assetIconMarkup(asset, { size = 40, escape = (v) => v } = {}) {
  const spec = typeof asset === 'string' ? { symbol: asset } : (asset || {});
  const key = String(spec.symbol || '').toUpperCase();
  const glyph = GLYPH[key];
  const label = key.slice(0, 4);
  const url = assetLogoUrl(spec);

  const base = glyph
    ? `<svg viewBox="0 0 24 24" aria-hidden="true">${glyph}</svg>`
    : `<span class="asset-mark-label">${escape(label)}</span>`;
  const image = url
    ? `<img class="asset-mark-image" src="${escape(url)}" alt="" loading="lazy" decoding="async">`
    : '';

  return `<span class="asset-mark" style="--mark-bg:${assetBrandColor(key)};--mark-size:${size}px"`
    + ` data-len="${label.length}">${base}${image}</span>`;
}
