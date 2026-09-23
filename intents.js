// NEAR Intents protocol layer.
//
// The intents verifier accepts ERC-191 ("personal_sign") signatures and derives
// the account id from the recovered secp256k1 key exactly the way Ethereum
// derives an address. The Liberdus account key is already that key, so a
// Liberdus account *is* an intents account: no NEAR account, no NEAR gas, and
// no new signing primitive beyond base58.
//
// Every wire format below is taken from the verifier contract source rather
// than from prose docs (https://github.com/near/intents):
//   ERC-191 prehash .............. crates/signatures/erc191/src/lib.rs
//   65-byte recoverable signature  crates/crypto/src/secp256k1.rs
//   "<curve>:<base58>" encoding .. crates/crypto/src/fmt.rs
//   account id from secp256k1 .... contracts/defuse/core/src/public_key.rs
//   payload envelope ............. contracts/defuse/core/src/payload/mod.rs
//   versioned nonce layout ....... contracts/defuse/core/src/nonce/versioned.rs
//   simulate_intents ............. contracts/defuse/src/intents.rs

import { base582bin, bin2base58, bin2base64, bin2hex, bin2utf8, hex2bin, utf82bin } from './lib.js';
import { ethHashMessage, generateAddress, generateRandomBytes, getPublicKey, signMessage } from './crypto.js';

export const INTENTS_VERIFYING_CONTRACT = 'intents.near';

// Public endpoints for the Phase 0 spike. Phase 1 moves these behind the
// Liberdus proxy, which is why every one of them is overridable.
const DEFAULT_NEAR_RPC_URLS = Object.freeze([
  'https://free.rpc.fastnear.com',
  'https://rpc.mainnet.near.org',
]);
const DEFAULT_ONECLICK_BASE_URL = 'https://1click.chaindefuser.com/v0';

const INTENTS_REQUEST_TIMEOUT_MS = 20_000;
const INTENT_DEADLINE_MS = 120_000;

// contracts/defuse/core/src/nonce/versioned.rs
const VERSIONED_NONCE_MAGIC_PREFIX = Object.freeze([0x56, 0x28, 0xf6, 0xc6]);
const VERSIONED_NONCE_V1 = 0x00;

export class IntentsError extends Error {
  constructor(message, code = 'INTENTS_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsError';
    this.code = code;
    this.details = details;
  }
}

function overrideList(name) {
  const override = globalThis.window?.[name];
  if (typeof override === 'string' && override.trim()) return [override.trim().replace(/\/$/, '')];
  if (Array.isArray(override) && override.length) {
    return override.map((url) => String(url).trim().replace(/\/$/, '')).filter(Boolean);
  }
  return null;
}

export function getNearRpcUrls() {
  return overrideList('LIBERDUS_NEAR_RPC_URL') || [...DEFAULT_NEAR_RPC_URLS];
}

export function getOneClickBaseUrl() {
  return (overrideList('LIBERDUS_ONECLICK_BASE_URL') || [DEFAULT_ONECLICK_BASE_URL])[0];
}

function normalizeSecretKey(value) {
  const secret = String(value || '').trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(secret)) {
    throw new IntentsError('Account secret key must be a 32-byte hexadecimal value', 'INVALID_SECRET_KEY');
  }
  return secret;
}

/**
 * The intents account id for a Liberdus account: the same 20-byte address the
 * EVM wallet already shows, lowercase and 0x-prefixed.
 *
 * contracts/defuse/core/src/public_key.rs derives it as
 *   "0x" + hex(keccak256(uncompressed_public_key_without_tag)[12..32])
 * which is what generateAddress() in crypto.js computes.
 */
export function intentsAccountId(secretKey) {
  const publicKey = getPublicKey(hex2bin(normalizeSecretKey(secretKey)));
  return `0x${bin2hex(generateAddress(publicKey))}`;
}

function bigIntTo32Bytes(value, name) {
  let hex = BigInt(value).toString(16);
  if (hex.length > 64) {
    throw new IntentsError(`${name} does not fit in 32 bytes`, 'INVALID_SIGNATURE');
  }
  return hex2bin(hex.padStart(64, '0'));
}

function uint64ToLeBytes(value) {
  const bytes = new Uint8Array(8);
  let remaining = BigInt(value);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

export function intentDeadline(fromMs = Date.now(), lifetimeMs = INTENT_DEADLINE_MS) {
  return new Date(fromMs + lifetimeMs).toISOString();
}

/**
 * Versioned (V1) nonce:
 *   magic prefix (4) | version (1) | salt (4) | deadline ns LE (8) | random (15)
 *
 * The contract rejects a nonce whose salt is not in its registry, and requires
 * the nonce deadline to be at or after the intent deadline -- so the intent
 * deadline is what we embed. Legacy nonces (32 random bytes) still work today
 * but the contract source says they are on the way out.
 */
export function buildVersionedNonce(salt, deadline, randomBytes = null) {
  const saltHex = String(salt || '').trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(saltHex)) {
    throw new IntentsError('Intents salt must be a 4-byte hexadecimal value', 'INVALID_SALT');
  }
  const saltBytes = hex2bin(saltHex);
  const deadlineMs = Date.parse(deadline);
  if (!Number.isFinite(deadlineMs)) {
    throw new IntentsError('Intent deadline must be an RFC 3339 timestamp', 'INVALID_DEADLINE');
  }
  const random = randomBytes || generateRandomBytes(15);
  if (random.length !== 15) {
    throw new IntentsError('Versioned nonce requires 15 random bytes', 'INVALID_NONCE');
  }

  const nonce = new Uint8Array(32);
  nonce.set(VERSIONED_NONCE_MAGIC_PREFIX, 0);
  nonce[4] = VERSIONED_NONCE_V1;
  nonce.set(saltBytes, 5);
  nonce.set(uint64ToLeBytes(BigInt(deadlineMs) * 1_000_000n), 9);
  nonce.set(random, 17);
  return bin2base64(nonce);
}

export function buildIntentPayload({ signerId, intents, deadline, nonce }) {
  if (!signerId) throw new IntentsError('An intent needs a signer id', 'MISSING_SIGNER');
  if (!Array.isArray(intents) || intents.length === 0) {
    throw new IntentsError('An intent payload needs at least one intent', 'EMPTY_INTENTS');
  }
  if (!nonce) throw new IntentsError('An intent needs a nonce', 'MISSING_NONCE');

  return {
    signer_id: signerId,
    verifying_contract: INTENTS_VERIFYING_CONTRACT,
    deadline,
    nonce,
    intents,
  };
}

/**
 * Sign a payload as ERC-191. The signed bytes are the *serialized* payload, so
 * the exact string we hash is the one we hand over -- never re-serialize it.
 *
 * noble normalizes to low-S, which the verifier requires
 * (crates/crypto/src/secp256k1.rs guards against malleability).
 */
export async function signIntentPayload(payload, secretKey) {
  const secret = normalizeSecretKey(secretKey);
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signature = await signMessage(hex2bin(ethHashMessage(serialized)), hex2bin(secret));

  const recoverable = new Uint8Array(65);
  recoverable.set(bigIntTo32Bytes(signature.r, 'signature r'), 0);
  recoverable.set(bigIntTo32Bytes(signature.s, 'signature s'), 32);
  recoverable[64] = signature.recovery;

  return {
    standard: 'erc191',
    payload: serialized,
    signature: `secp256k1:${bin2base58(recoverable)}`,
  };
}

/** Move tokens between two intents accounts, inside the verifier. No gas, no chain. */
export function buildTransferIntent({ receiverId, tokens, memo = null }) {
  const intent = { intent: 'transfer', receiver_id: receiverId, tokens };
  if (memo) intent.memo = memo;
  return intent;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INTENTS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new IntentsError(`${url} returned HTTP ${response.status}`, 'HTTP_ERROR', {
        status: response.status,
        body: await response.text().catch(() => ''),
      });
    }
    return await response.json();
  } catch (error) {
    if (error instanceof IntentsError) throw error;
    throw new IntentsError(
      controller.signal.aborted ? `${url} timed out` : `${url} failed`,
      controller.signal.aborted ? 'TIMEOUT' : 'UNAVAILABLE',
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

let viewRequestId = 0;

async function nearViewCallOnce(rpcUrl, contractId, methodName, args) {
  const id = ++viewRequestId;
  const body = await fetchJson(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'optimistic',
        account_id: contractId,
        method_name: methodName,
        args_base64: bin2base64(utf82bin(JSON.stringify(args ?? {}))),
      },
    }),
  });

  if (body?.error) {
    const data = body.error.data;
    const message = (typeof data === 'string' && data)
      || body.error.message
      || 'NEAR RPC rejected the query';
    throw new IntentsError(message, 'RPC_RESPONSE_ERROR', { error: body.error });
  }
  // A panicking view call comes back as a successful envelope with .error set.
  if (body?.result?.error) {
    throw new IntentsError(String(body.result.error), 'CONTRACT_ERROR', { error: body.result.error });
  }
  if (!Array.isArray(body?.result?.result)) {
    throw new IntentsError('NEAR RPC returned no view result', 'INVALID_RPC_RESPONSE', { body });
  }

  const raw = bin2utf8(Uint8Array.from(body.result.result));
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new IntentsError(`${methodName} returned invalid JSON`, 'INVALID_VIEW_RESULT', {
      cause: error,
      raw,
    });
  }
}

export async function nearViewCall(contractId, methodName, args, { rpcUrls = null } = {}) {
  const endpoints = rpcUrls || getNearRpcUrls();
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      return await nearViewCallOnce(endpoint, contractId, methodName, args);
    } catch (error) {
      // A contract-level failure is the same from every endpoint; only keep
      // trying when the endpoint itself is the problem.
      if (error instanceof IntentsError && error.code === 'CONTRACT_ERROR') throw error;
      errors.push(error);
    }
  }
  throw new IntentsError(
    errors.at(-1)?.message
      ? `NEAR RPC failed: ${errors.at(-1).message}`
      : 'All NEAR RPC endpoints failed',
    'ALL_RPC_ENDPOINTS_FAILED',
    { cause: new AggregateError(errors) },
  );
}

/** Current salt from the verifier's registry, as a 4-byte hex string. */
export function getCurrentSalt(options = {}) {
  return nearViewCall(INTENTS_VERIFYING_CONTRACT, 'current_salt', {}, options);
}

/**
 * The whole multichain portfolio in one read: the verifier holds every asset as
 * a NEP-245 multi-token, so there is no per-chain indexer to run.
 */
export async function getIntentsBalances(accountId, tokenIds, options = {}) {
  const ids = [...tokenIds];
  const balances = await nearViewCall(
    INTENTS_VERIFYING_CONTRACT,
    'mt_batch_balance_of',
    { account_id: accountId, token_ids: ids },
    options,
  );
  return Object.fromEntries(ids.map((tokenId, index) => [tokenId, String(balances?.[index] ?? '0')]));
}

/**
 * Ask the verifier what a signed intent would do, without executing it.
 * Read-only, so it costs nothing and risks nothing -- which is how we verify
 * signatures given that intents has no testnet.
 */
export function simulateIntents(signedPayloads, options = {}) {
  return nearViewCall(
    INTENTS_VERIFYING_CONTRACT,
    'simulate_intents',
    { signed: Array.isArray(signedPayloads) ? signedPayloads : [signedPayloads] },
    options,
  );
}

/** Token catalog: ids, chains, decimals and prices for everything intents supports. */
export function fetchIntentsTokens({ baseUrl = null } = {}) {
  return fetchJson(`${baseUrl || getOneClickBaseUrl()}/tokens`, {
    headers: { accept: 'application/json' },
  });
}

/** Decode a "secp256k1:<base58>" signature back to its 65 bytes. */
export function parseIntentSignature(value) {
  const [curve, encoded] = String(value || '').split(':');
  if (curve !== 'secp256k1' || !encoded) {
    throw new IntentsError('Expected a secp256k1 intent signature', 'INVALID_SIGNATURE');
  }
  const bytes = base582bin(encoded);
  if (bytes.length !== 65) {
    throw new IntentsError('A recoverable signature must be 65 bytes', 'INVALID_SIGNATURE');
  }
  return bytes;
}
