export const LOCK_RECORD_VERSION = 2;
export const LOCK_KDF_ITERATIONS = 600_000;
export const MIN_LOCK_PASSWORD_LENGTH = 12;

const LOCK_SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 64;
const MAX_KDF_ITERATIONS = 2_000_000;

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function deriveLockMaterial(password, salt, iterations) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Secure password derivation is unavailable in this browser');

  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    DERIVED_KEY_BYTES * 8
  );
  const derived = new Uint8Array(bits);
  return {
    verifier: derived.slice(0, 32),
    encryptionKey: bytesToHex(derived.slice(32)),
  };
}

/**
 * Parses and validates a versioned lock record.
 * @param {unknown} storedValue
 * @returns {{version: number, kdf: string, iterations: number, salt: string, verifier: string}|null}
 */
export function parseLockRecord(storedValue) {
  if (typeof storedValue !== 'string' || !storedValue.startsWith('{')) return null;
  try {
    const record = JSON.parse(storedValue);
    const salt = base64ToBytes(record.salt);
    const verifier = base64ToBytes(record.verifier);
    if (
      record.version !== LOCK_RECORD_VERSION
      || record.kdf !== 'PBKDF2-SHA-256'
      || !Number.isInteger(record.iterations)
      || record.iterations < 100_000
      || record.iterations > MAX_KDF_ITERATIONS
      || salt?.length !== LOCK_SALT_BYTES
      || verifier?.length !== 32
    ) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

/**
 * Creates a new randomly salted lock record and a separate account-encryption key.
 * @param {string} password
 * @param {{iterations?: number, salt?: Uint8Array}} options
 * @returns {Promise<{record: string, encryptionKey: string}>}
 */
export async function createLockRecord(password, options = {}) {
  if (typeof password !== 'string' || password.length < MIN_LOCK_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_LOCK_PASSWORD_LENGTH} characters`);
  }
  const iterations = options.iterations ?? LOCK_KDF_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > MAX_KDF_ITERATIONS) {
    throw new Error('Invalid lock KDF work factor');
  }
  const salt = options.salt || globalThis.crypto.getRandomValues(new Uint8Array(LOCK_SALT_BYTES));
  if (!(salt instanceof Uint8Array) || salt.length !== LOCK_SALT_BYTES) {
    throw new Error('Invalid lock salt');
  }

  const derived = await deriveLockMaterial(password, salt, iterations);
  const record = JSON.stringify({
    version: LOCK_RECORD_VERSION,
    kdf: 'PBKDF2-SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(derived.verifier),
  });
  return { record, encryptionKey: derived.encryptionKey };
}

/**
 * Verifies a password against a versioned record and returns its encryption key.
 * @param {unknown} storedValue
 * @param {string} password
 * @returns {Promise<{encryptionKey: string}|null>}
 */
export async function unlockLockRecord(storedValue, password) {
  const record = parseLockRecord(storedValue);
  if (!record || typeof password !== 'string') return null;
  const salt = base64ToBytes(record.salt);
  const expectedVerifier = base64ToBytes(record.verifier);
  const derived = await deriveLockMaterial(password, salt, record.iterations);
  return constantTimeEqual(derived.verifier, expectedVerifier)
    ? { encryptionKey: derived.encryptionKey }
    : null;
}
