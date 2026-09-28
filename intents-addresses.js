// Whether a withdrawal address can belong to the chain it is being sent to.
//
// 1Click validates the recipient on every quote, so this is not the last line
// of defence -- but it is not only a convenience either. Seen on real dry
// quotes (2026-09-28): 1Click priced a Stellar address whose checksum was
// wrong, and accepted an XRP address carrying a destination tag, then failed
// on every quote to it. A checksum caught here is a typo that never reaches a
// bridge.
//
// One rule governs everything below: reject only what is certainly wrong. An
// address this module has no rule for passes, and 1Click decides. Refusing a
// valid address would be a bug with no workaround; letting an odd one through
// costs a quote.

import { base582bin, utf82bin } from './lib.js';
import keccak256 from './external/keccak256.js';
import { chainDisplayName } from './intents-assets.js';

const EVM_CHAINS = new Set([
  'eth', 'base', 'arb', 'op', 'pol', 'bsc', 'avax', 'gnosis', 'bera', 'monad',
  'plasma', 'scroll', 'abs', 'xlayer',
]);

/**
 * Chains where an exchange tells its customers apart by a tag or memo sent
 * alongside the address. 1Click has no field for one, and a tag encoded into
 * the address itself is not accepted (see above), so a withdrawal to an
 * exchange on these chains can arrive without the tag it needs.
 */
const TAG_CHAINS = Object.freeze({
  xrp: 'destination tag',
  stellar: 'memo',
  ton: 'memo',
});

export function tagNeededBy(blockchain) {
  return TAG_CHAINS[String(blockchain || '').toLowerCase()] || null;
}

// --- hashing and encodings ---------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/**
 * SHA-256, synchronously. Base58Check needs it, and WebCrypto's is async --
 * which would make "is this address plausible" a promise on every keystroke.
 */
export function sha256(bytes) {
  const length = bytes.length;
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[length] = 0x80;
  const bits = length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(padded.length - 4, bits >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  h.forEach((word, i) => outView.setUint32(i * 4, word));
  return out;
}

const BITCOIN_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const RIPPLE_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';

function base58(text, alphabet = BITCOIN_ALPHABET) {
  // XRP uses the same encoding over a reordered alphabet: map it across.
  const mapped = alphabet === BITCOIN_ALPHABET ? text : [...text]
    .map((char) => (alphabet.includes(char) ? BITCOIN_ALPHABET[alphabet.indexOf(char)] : '0'))
    .join('');
  try {
    return base582bin(mapped);
  } catch {
    return null;
  }
}

/** The payload of a Base58Check string, or null when it is not one. */
function base58check(text, alphabet) {
  const bytes = base58(text, alphabet);
  if (!bytes || bytes.length < 5) return null;
  const payload = bytes.subarray(0, -4);
  const check = sha256(sha256(payload));
  return bytes.subarray(-4).every((byte, i) => byte === check[i]) ? payload : null;
}

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values) {
  const generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let check = 1;
  for (const value of values) {
    const top = check >>> 25;
    check = ((check & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) check ^= generator[i];
  }
  return check >>> 0;
}

/**
 * A bech32 or bech32m string: { prefix, data, variant }, or null. Mixed case
 * is invalid by the spec, so it is refused rather than normalised.
 */
function bech32(text) {
  if (text !== text.toLowerCase() && text !== text.toUpperCase()) return null;
  const lower = text.toLowerCase();
  const split = lower.lastIndexOf('1');
  if (split < 1 || split + 7 > lower.length) return null;
  const prefix = lower.slice(0, split);
  const data = [];
  for (const char of lower.slice(split + 1)) {
    const value = BECH32_CHARSET.indexOf(char);
    if (value < 0) return null;
    data.push(value);
  }
  const expanded = [
    ...[...prefix].map((char) => char.charCodeAt(0) >> 5), 0,
    ...[...prefix].map((char) => char.charCodeAt(0) & 31),
  ];
  const check = bech32Polymod([...expanded, ...data]);
  const variant = check === 1 ? 'bech32' : check === 0x2bc830a3 ? 'bech32m' : null;
  return variant ? { prefix, data: data.slice(0, -6), variant } : null;
}

/** Five-bit groups back to bytes, or null when the padding is not zero. */
function fromWords(words) {
  let value = 0;
  let bits = 0;
  const out = [];
  for (const word of words) {
    value = (value << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  if (bits >= 5 || (value << (8 - bits)) & 0xff) return null;
  return out;
}

/** A segwit address for `prefix` (BIP 173 / 350). */
function isSegwit(text, prefix) {
  const decoded = bech32(text);
  if (!decoded || decoded.prefix !== prefix || !decoded.data.length) return false;
  const [version, ...words] = decoded.data;
  const program = fromWords(words);
  if (version > 16 || !program || program.length < 2 || program.length > 40) return false;
  // Version 0 is bech32 and exactly 20 or 32 bytes; later versions are bech32m.
  if (version === 0) return decoded.variant === 'bech32' && (program.length === 20 || program.length === 32);
  return decoded.variant === 'bech32m';
}

/** Base58Check with a one-byte version from `versions` and a 20-byte hash. */
function isBase58Hash(text, versions, alphabet) {
  const payload = base58check(text, alphabet);
  return Boolean(payload) && payload.length === 21 && versions.includes(payload[0]);
}

function crc16xmodem(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function base32(text) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let value = 0;
  let bits = 0;
  const out = [];
  for (const char of text) {
    const index = alphabet.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** A Stellar account (G…): version byte, 32-byte key, CRC16 little-endian. */
function isStellarAccount(text) {
  if (!/^G[A-Z2-7]{55}$/.test(text)) return false;
  const bytes = base32(text);
  if (!bytes || bytes.length !== 35 || bytes[0] !== 6 << 3) return false;
  const crc = crc16xmodem(bytes.subarray(0, 33));
  return bytes[33] === (crc & 0xff) && bytes[34] === crc >> 8;
}

/** TON, raw ("0:<hex>") or user-friendly (48 base64 chars, CRC16 big-endian). */
function isTonAddress(text) {
  if (/^-?\d+:[0-9a-fA-F]{64}$/.test(text)) return true;
  if (!/^[A-Za-z0-9_\-+/]{48}$/.test(text)) return false;
  const standard = text.replace(/-/g, '+').replace(/_/g, '/');
  let bytes;
  try {
    bytes = Uint8Array.from(atob(standard), (char) => char.charCodeAt(0));
  } catch {
    return false;
  }
  if (bytes.length !== 36) return false;
  const crc = crc16xmodem(bytes.subarray(0, 34));
  return bytes[34] === crc >> 8 && bytes[35] === (crc & 0xff);
}

/** EIP-55: all one case carries no checksum; mixed case must match it. */
function isEvmAddress(text) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(text)) return false;
  const hex = text.slice(2);
  if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) return true;
  const digest = keccak256(utf82bin(hex.toLowerCase()));
  for (let i = 0; i < 40; i++) {
    const nibble = i % 2 === 0 ? digest[i >> 1] >> 4 : digest[i >> 1] & 0x0f;
    const char = hex[i];
    if (/[a-f]/.test(char) && nibble >= 8) return false;
    if (/[A-F]/.test(char) && nibble < 8) return false;
  }
  return true;
}

/** Solana (and SVM chains): base58 of a 32-byte key. */
function isSolanaAddress(text) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) return false;
  return base58(text)?.length === 32;
}

// NEAR account ids: named ("alice.near") or implicit (64 hex, or 0x + 40 hex).
const NEAR_ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

// Per chain: true when the address fits. Chains missing here are not checked.
const RULES = {
  btc: (text) => isSegwit(text, 'bc') || isBase58Hash(text, [0x00, 0x05]),
  ltc: (text) => isSegwit(text, 'ltc') || isBase58Hash(text, [0x30, 0x32, 0x05]),
  doge: (text) => isBase58Hash(text, [0x1e, 0x16]),
  dash: (text) => isBase58Hash(text, [0x4c, 0x10]),
  tron: (text) => /^T/.test(text) && isBase58Hash(text, [0x41]),
  xrp: (text) => /^r/.test(text) && isBase58Hash(text, [0x00], RIPPLE_ALPHABET),
  // Transparent addresses carry a two-byte version; shielded ones pass.
  zec: (text) => {
    if (!/^t/.test(text)) return true;
    const payload = base58check(text);
    return Boolean(payload) && payload.length === 22 && payload[0] === 0x1c
      && (payload[1] === 0xb8 || payload[1] === 0xbd);
  },
  sol: isSolanaAddress,
  fogo: isSolanaAddress,
  stellar: isStellarAccount,
  ton: isTonAddress,
  near: (text) => text.length >= 2 && text.length <= 64 && NEAR_ACCOUNT.test(text),
  sui: (text) => /^0x[0-9a-fA-F]{64}$/.test(text),
  aptos: (text) => /^0x[0-9a-fA-F]{1,64}$/.test(text),
  movement: (text) => /^0x[0-9a-fA-F]{1,64}$/.test(text),
  starknet: (text) => /^0x[0-9a-fA-F]{1,64}$/.test(text),
};

/**
 * What is wrong with `address` as a payout on `blockchain`: '' while nothing
 * is typed, a sentence when it cannot be used, null when it can (or when this
 * chain has no rule here, which leaves it to 1Click). The same three answers
 * as checkAmount, so a screen can treat the two alike.
 */
export function checkAddress(blockchain, address) {
  const text = String(address ?? '').trim();
  if (!text) return '';
  const chain = String(blockchain || '').toLowerCase();
  const name = chainDisplayName(chain);

  // A tag folded into the address. 1Click takes these and then fails on them.
  if (chain === 'xrp' && /^[XT][1-9A-HJ-NP-Za-km-z]{46}$/.test(text)) {
    return 'Addresses with a built-in destination tag cannot be used here. Use a plain r… address.';
  }
  if (chain === 'stellar' && /^M[A-Z2-7]{68}$/.test(text)) {
    return 'Addresses starting with M cannot be used here. Use a plain G… address.';
  }

  const rule = EVM_CHAINS.has(chain) ? isEvmAddress : RULES[chain];
  if (!rule || rule(text)) return null;
  return `That is not ${/^[AEIOUX]/.test(name) ? 'an' : 'a'} ${name} address.`;
}
