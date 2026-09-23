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
const DEFAULT_BRIDGE_RPC_URL = 'https://bridge.chaindefuser.com/rpc';
const DEFAULT_SOLVER_RELAY_URL = 'https://solver-relay-v2.chaindefuser.com/rpc';

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

export function getBridgeRpcUrl() {
  return (overrideList('LIBERDUS_INTENTS_BRIDGE_URL') || [DEFAULT_BRIDGE_RPC_URL])[0];
}

export function getSolverRelayUrl() {
  return (overrideList('LIBERDUS_INTENTS_RELAY_URL') || [DEFAULT_SOLVER_RELAY_URL])[0];
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

// ---------------------------------------------------------------------------
// Deposits.
//
// The bridge derives a deposit address per (account, chain) and credits the
// intents balance once the transfer confirms on the origin chain. The address
// is stable: asking twice returns the same one, so it can be shown and reused
// like any receive address.
// ---------------------------------------------------------------------------

let bridgeRequestId = 0;

async function bridgeRpc(method, params) {
  const url = getBridgeRpcUrl();
  const id = ++bridgeRequestId;
  const body = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: [params ?? {}] }),
  });
  // The bridge reports failures as a plain string in `error`, not an object.
  if (body?.error) {
    const message = typeof body.error === 'string'
      ? body.error
      : body.error.message || 'The deposit service rejected the request';
    throw new IntentsError(message, 'BRIDGE_ERROR', { error: body.error, method });
  }
  if (!body?.result) {
    throw new IntentsError(`${method} returned no result`, 'INVALID_BRIDGE_RESPONSE', { body });
  }
  return body.result;
}

/**
 * Every asset the bridge can move, with the per-token deposit and withdrawal
 * minimums. Those minimums are not advisory: a deposit below one is not
 * credited, so the UI has to state them before someone sends funds.
 */
export async function fetchBridgeTokens() {
  const result = await bridgeRpc('supported_tokens', {});
  return Array.isArray(result?.tokens) ? result.tokens : [];
}

/** The chain part of a defuse asset identifier, e.g. "btc:mainnet:native" -> "btc:mainnet". */
export function bridgeChainOf(defuseAssetIdentifier) {
  const parts = String(defuseAssetIdentifier || '').split(':');
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : null;
}

/**
 * A deposit address for one chain.
 *
 * Some chains (Stellar among them) share one address and tell depositors apart
 * by memo. The service refuses a plain request for those, so the refusal is
 * used as the signal to ask again in MEMO mode rather than guessing per chain.
 * A memo in the result is mandatory for the depositor -- funds sent without it
 * are not credited.
 */
export async function requestDepositAddress(accountId, chain) {
  if (!accountId) throw new IntentsError('A deposit address needs an account id', 'MISSING_ACCOUNT');
  if (!chain) throw new IntentsError('A deposit address needs a chain', 'MISSING_CHAIN');

  let result;
  try {
    result = await bridgeRpc('deposit_address', { account_id: accountId, chain });
  } catch (error) {
    if (error instanceof IntentsError && /memo/i.test(error.message)) {
      result = await bridgeRpc('deposit_address', {
        account_id: accountId,
        chain,
        deposit_mode: 'MEMO',
      });
    } else {
      throw error;
    }
  }

  if (!result?.address) {
    throw new IntentsError('The deposit service returned no address', 'INVALID_BRIDGE_RESPONSE', { result });
  }
  return {
    address: String(result.address),
    chain: String(result.chain || chain),
    memo: result.memo ? String(result.memo) : null,
  };
}

/** Deposits the bridge has seen for this account and chain, newest first. */
export async function fetchRecentDeposits(accountId, chain, { limit = 20 } = {}) {
  const result = await bridgeRpc('recent_deposits', {
    account_id: accountId,
    chain,
    limit,
  });
  return Array.isArray(result?.deposits) ? result.deposits : [];
}

// ---------------------------------------------------------------------------
// Publishing.
//
// A signed intent still has to reach the verifier, and calling execute_intents
// costs NEAR. The solver relay does that submission and pays the gas, which is
// why the account never needs NEAR of its own.
//
// `quote_hashes` is only meaningful for a swap, where it names the solver
// quotes being accepted. A transfer or a withdrawal has no counterparty to
// quote, so it publishes with none.
// ---------------------------------------------------------------------------

let relayRequestId = 0;

async function solverRelayRpc(method, params) {
  const url = getSolverRelayUrl();
  const id = ++relayRequestId;
  const body = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: [params ?? {}] }),
  });
  if (body?.error) {
    const message = typeof body.error === 'string'
      ? body.error
      : body.error.message || 'The solver relay rejected the request';
    throw new IntentsError(message, 'RELAY_ERROR', { error: body.error, method });
  }
  return body?.result ?? null;
}

/**
 * Submit a signed intent for execution.
 *
 * This is the one call in this module that moves money. Everything else reads
 * or simulates.
 */
export async function publishIntent(signedPayload, { quoteHashes = null } = {}) {
  const result = await solverRelayRpc('publish_intent', {
    quote_hashes: quoteHashes,
    signed_data: signedPayload,
  });

  if (result?.status !== 'OK') {
    throw new IntentsError(
      result?.reason || result?.message || 'The solver relay did not accept the intent',
      'INTENT_REJECTED',
      { result },
    );
  }
  if (!result.intent_hash) {
    throw new IntentsError('The solver relay returned no intent hash', 'INVALID_RELAY_RESPONSE', { result });
  }
  return String(result.intent_hash);
}

/** PENDING until the relayer lands it, then SETTLED with the NEAR transaction. */
export async function getIntentStatus(intentHash) {
  const result = await solverRelayRpc('get_status', { intent_hash: intentHash });
  return {
    status: String(result?.status || 'UNKNOWN'),
    transactionHash: result?.data?.hash ? String(result.data.hash) : null,
    raw: result,
  };
}

/**
 * Poll until the intent settles or stops being pending.
 *
 * Resolves with the final status rather than throwing on failure: a settled
 * failure is an outcome the caller has to show, not an exception.
 */
export async function waitForIntentSettlement(intentHash, {
  timeoutMs = 60_000,
  pollMs = 2_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = { status: 'PENDING', transactionHash: null, raw: null };

  while (Date.now() < deadline) {
    last = await getIntentStatus(intentHash);
    if (last.status !== 'PENDING') return last;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { ...last, status: last.status === 'PENDING' ? 'TIMED_OUT' : last.status };
}

// ---------------------------------------------------------------------------
// Swaps and withdrawals, through 1Click.
//
// Getting an asset back onto its own chain is not one mechanism but several:
// some tokens leave through the PoA bridge, others through Omni, and the split
// is a hand-maintained list that moves. Omni withdrawals also derive a storage
// account by a hash where letter case matters, and charge a fee in wNEAR.
//
// 1Click owns all of that. We ask it what a withdrawal would cost, and it
// answers with a deposit address inside the verifier; funding that address with
// an ordinary transfer intent is the whole withdrawal on our side.
//
// A dry quote validates the destination address and the minimum before anything
// exists, so it doubles as the pre-flight check -- and its numbers are live,
// where the ones in supported_tokens are not always.
// ---------------------------------------------------------------------------

async function oneClickRequest(path, { method = 'GET', body = null } = {}) {
  const url = `${getOneClickBaseUrl()}${path}`;
  try {
    return await fetchJson(url, {
      method,
      headers: body
        ? { 'content-type': 'application/json', accept: 'application/json' }
        : { accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // 1Click explains refusals in a `message` field, and those explanations are
    // worth showing verbatim: "Amount is too low for bridge, try at least N".
    const raw = error?.details?.body;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.message) {
          throw new IntentsError(String(parsed.message), 'QUOTE_REFUSED', { cause: error });
        }
      } catch (parseError) {
        if (parseError instanceof IntentsError) throw parseError;
      }
    }
    throw error;
  }
}

/**
 * Price a swap or withdrawal.
 *
 * `dry` decides whether this is a question or a commitment: a dry quote prices
 * it and validates the inputs, while a real one allocates the deposit address
 * that funds it.
 */
export function requestSwapQuote(params) {
  return oneClickRequest('/quote', { method: 'POST', body: params });
}

/** Where a swap or withdrawal has got to, keyed by the deposit address. */
export function getSwapStatus(depositAddress, depositMemo = null) {
  const query = new URLSearchParams({ depositAddress });
  if (depositMemo) query.set('depositMemo', depositMemo);
  return oneClickRequest(`/status?${query.toString()}`);
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
