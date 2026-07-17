import { generateAddress, getPublicKey } from '../crypto.js';
import { bin2hex, hex2bin } from '../lib.js';

const PRIVATE_KEY_PATTERN = /^(?:0x)?([0-9a-fA-F]{64})$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export function normalizeEvmPrivateKey(privateKey) {
  const match = typeof privateKey === 'string' && privateKey.match(PRIVATE_KEY_PATTERN);
  if (!match) {
    throw new TypeError('EVM private key must be exactly 32 bytes of hexadecimal data');
  }
  return match[1].toLowerCase();
}

export function normalizeEvmAddress(address) {
  const normalized = typeof address === 'string'
    ? address.trim().toLowerCase()
    : '';

  if (!ADDRESS_PATTERN.test(normalized)) {
    throw new TypeError('EVM address must be a 20-byte 0x-prefixed hexadecimal value');
  }

  return normalized;
}

export function deriveEvmAddress(privateKey) {
  const normalizedKey = normalizeEvmPrivateKey(privateKey);
  const publicKey = getPublicKey(hex2bin(normalizedKey));
  return `0x${bin2hex(generateAddress(publicKey))}`;
}

export function getEvmIdentityFromAccount(account, { verifyPrivateKey = false } = {}) {
  const keys = account?.keys;
  const addressValue = keys?.address || account?.address;
  const address = normalizeEvmAddress(
    typeof addressValue === 'string' && addressValue.startsWith('0x')
      ? addressValue
      : `0x${addressValue || ''}`,
  );

  if (verifyPrivateKey) {
    if (!keys?.secret) {
      throw new TypeError('Account does not contain a private key to verify');
    }
    if (deriveEvmAddress(keys.secret) !== address) {
      throw new Error('The account private key does not derive its stored EVM address');
    }
  }

  return Object.freeze({
    address,
    keyType: keys?.type || 'secp256k1',
  });
}
