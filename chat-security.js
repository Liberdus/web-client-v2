import { stringify } from './external/stringify-shardus.js';
import {
  ethHashMessage,
  generateAddress,
  hashBytes,
  verifyMessage,
} from './crypto.js';
import {
  bin2hex,
  hex2bin,
  longAddress,
  normalizeAddress,
  utf82bin,
} from './lib.js';

const SUPPORTED_CHAT_TRANSACTION_TYPES = new Set([
  'message',
  'transfer',
  'update_toll_required',
]);

/**
 * Computes the deterministic identifier of the unsigned transaction body.
 * @param {Object} transaction
 * @returns {string}
 */
export function getUnsignedTransactionId(transaction) {
  const unsignedTransaction = { ...transaction };
  delete unsignedTransaction.sign;
  return hashBytes(utf82bin(stringify(unsignedTransaction)));
}

/**
 * Computes the chat account shared by two addresses.
 * @param {string} firstAddress
 * @param {string} secondAddress
 * @returns {string}
 */
export function getExpectedChatId(firstAddress, secondAddress) {
  return hashBytes([longAddress(firstAddress), longAddress(secondAddress)].sort().join(''));
}

/**
 * Confirms that a public key derives to the claimed account address.
 * @param {unknown} publicKey
 * @param {string} address
 * @returns {boolean}
 */
export function isPublicKeyForAddress(publicKey, address) {
  if (typeof publicKey !== 'string' || !/^(?:0x)?[0-9a-f]{130}$/i.test(publicKey)) return false;
  try {
    const normalizedPublicKey = publicKey.replace(/^0x/i, '');
    return bin2hex(generateAddress(hex2bin(normalizedPublicKey))) === normalizeAddress(address);
  } catch {
    return false;
  }
}

function getCompactSignature(signature) {
  if (typeof signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(signature)) return null;
  const recovery = Number.parseInt(signature.slice(-2), 16);
  if (recovery !== 27 && recovery !== 28) return null;
  return hex2bin(signature.slice(2, 130));
}

function hasRequiredPrivateMessageEnvelope(transaction, currentAddress) {
  const payload = transaction.xmessage;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.encrypted !== true || payload.encryptionMethod !== 'xchacha20poly1305') return false;
  if (typeof payload.message !== 'string' || !payload.message) return false;

  const transactionFrom = normalizeAddress(transaction.from);
  const keyField = transactionFrom === normalizeAddress(currentAddress)
    ? payload.selfKey
    : payload.pqEncSharedKey;
  return typeof keyField === 'string' && keyField.length > 0;
}

/**
 * Validates the signed fields and private-message envelope before processing.
 * @param {Object} transaction
 * @param {{currentAddress: string, contactAddress: string, expectedChatId: string, networkId: unknown, publicKey: string}} context
 * @returns {{ok: boolean, reason?: string, txid?: string}}
 */
export function validateChatTransaction(transaction, context) {
  if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
    return { ok: false, reason: 'invalid_transaction' };
  }
  if (!SUPPORTED_CHAT_TRANSACTION_TYPES.has(transaction.type)) {
    return { ok: false, reason: 'unsupported_type' };
  }

  let transactionFrom;
  let transactionTo;
  let currentAddress;
  let contactAddress;
  try {
    transactionFrom = normalizeAddress(transaction.from);
    transactionTo = normalizeAddress(transaction.to);
    currentAddress = normalizeAddress(context.currentAddress);
    contactAddress = normalizeAddress(context.contactAddress);
  } catch {
    return { ok: false, reason: 'invalid_participant' };
  }

  const hasExpectedParticipants = (
    transactionFrom === currentAddress && transactionTo === contactAddress
  ) || (
    transactionFrom === contactAddress && transactionTo === currentAddress
  );
  if (!hasExpectedParticipants) return { ok: false, reason: 'participant_mismatch' };
  if (transaction.chatId !== context.expectedChatId) return { ok: false, reason: 'chat_mismatch' };
  if (transaction.networkId !== context.networkId) return { ok: false, reason: 'network_mismatch' };
  if (!Number.isFinite(Number(transaction.timestamp)) || Number(transaction.timestamp) <= 0) {
    return { ok: false, reason: 'invalid_timestamp' };
  }
  if (transaction.type === 'message' && !hasRequiredPrivateMessageEnvelope(transaction, currentAddress)) {
    return { ok: false, reason: 'unencrypted_message' };
  }

  const signatureOwner = transaction.sign?.owner;
  try {
    if (normalizeAddress(signatureOwner) !== transactionFrom) {
      return { ok: false, reason: 'signature_owner_mismatch' };
    }
  } catch {
    return { ok: false, reason: 'missing_signature' };
  }
  if (!isPublicKeyForAddress(context.publicKey, transactionFrom)) {
    return { ok: false, reason: 'public_key_mismatch' };
  }

  const compactSignature = getCompactSignature(transaction.sign?.sig);
  if (!compactSignature) return { ok: false, reason: 'invalid_signature_format' };

  const txid = getUnsignedTransactionId(transaction);
  const signedHash = hex2bin(ethHashMessage(txid));
  const publicKey = hex2bin(context.publicKey.replace(/^0x/i, ''));
  if (!verifyMessage(compactSignature, signedHash, publicKey)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true, txid };
}
