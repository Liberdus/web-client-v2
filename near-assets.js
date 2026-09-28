// Multichain wallet and chat payments, organized as one feature module.
// Services come before their screens; app.js supplies account and persistence
// callbacks through the controllers, following the evm-assets.js pattern.

import {
  base582bin,
  bin2base58,
  bin2base64,
  bin2hex,
  bin2utf8,
  hex2bin,
  utf82bin,
  BUTTON_COOLDOWN_MS,
  escapeHtml,
  openModal,
  withButtonCooldown,
} from './lib.js';
import {
  ethHashMessage,
  generateAddress,
  generateRandomBytes,
  getPublicKey,
  signMessage,
} from './crypto.js';
import keccak256 from './external/keccak256.js';

// === Protocol, signing and network requests ===

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

export const INTENTS_VERIFYING_CONTRACT = 'intents.near';

// Public endpoints for the Phase 0 spike. Phase 1 moves these behind the
// Liberdus proxy, which is why every one of them is overridable.
const DEFAULT_NEAR_RPC_URLS = Object.freeze([
  'https://free.rpc.fastnear.com',
  'https://rpc.mainnet.near.org',
]);
// Archival nodes keep every transaction; ordinary ones drop them after a few
// days. A payment receipt is checked against its settlement transaction for
// as long as the chat keeps it, so it has to be read from one of these.
const DEFAULT_NEAR_ARCHIVAL_RPC_URLS = Object.freeze([
  'https://archival-rpc.mainnet.fastnear.com',
  'https://archival-rpc.mainnet.near.org',
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

export function getNearArchivalRpcUrls() {
  return overrideList('LIBERDUS_NEAR_ARCHIVAL_RPC_URL') || [...DEFAULT_NEAR_ARCHIVAL_RPC_URLS];
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
 * The transfers a settlement transaction carried, as the verifier logged them.
 *
 * The verifier emits a dip4 `transfer` event per transfer intent it executes:
 * the intent's hash, who sent, who received, and the tokens with their raw
 * amounts. That one event is what binds a chat receipt to what actually
 * moved -- and unlike the relay, which forgets an intent within days, an
 * archival node keeps the transaction for good.
 *
 * Resolves with [] for a transaction that exists but carries no transfers;
 * throws when no endpoint could answer, which is not evidence either way.
 */
export async function fetchIntentTransfers(transactionHash, {
  signerId = INTENTS_VERIFYING_CONTRACT,
  rpcUrls = null,
} = {}) {
  const endpoints = rpcUrls || getNearArchivalRpcUrls();
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const body = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++viewRequestId,
          method: 'tx',
          params: { tx_hash: transactionHash, sender_account_id: signerId, wait_until: 'FINAL' },
        }),
      });
      if (body?.error) {
        throw new IntentsError(body.error.data?.message || body.error.message || 'NEAR RPC rejected the lookup',
          'RPC_RESPONSE_ERROR', { error: body.error });
      }
      return intentTransfersFromOutcomes(body?.result?.receipts_outcome || []);
    } catch (error) {
      errors.push(error);
    }
  }
  throw new IntentsError('No NEAR archival endpoint could read the transaction', 'ALL_RPC_ENDPOINTS_FAILED',
    { cause: new AggregateError(errors) });
}

/** Pull the verifier's dip4 transfer events out of receipt outcomes. */
export function intentTransfersFromOutcomes(outcomes) {
  const transfers = [];
  for (const receipt of outcomes) {
    // Only the verifier's own logs count: any contract can print JSON.
    if (receipt?.outcome?.executor_id !== INTENTS_VERIFYING_CONTRACT) continue;
    for (const log of receipt.outcome.logs || []) {
      if (!log.startsWith('EVENT_JSON:')) continue;
      let event;
      try {
        event = JSON.parse(log.slice('EVENT_JSON:'.length));
      } catch {
        continue;
      }
      if (event?.standard !== 'dip4' || event.event !== 'transfer' || !Array.isArray(event.data)) continue;
      for (const entry of event.data) {
        transfers.push({
          intentHash: String(entry.intent_hash || ''),
          from: String(entry.account_id || ''),
          to: String(entry.receiver_id || ''),
          tokens: entry.tokens && typeof entry.tokens === 'object' ? { ...entry.tokens } : {},
          memo: entry.memo ?? null,
        });
      }
    }
  }
  return transfers;
}

/**
 * Poll until the intent settles or stops being pending.
 *
 * Resolves with the final status rather than throwing on failure: a settled
 * failure is an outcome the caller has to show, not an exception.
 */
// Relay states that mean "not landed yet". TX_BROADCASTED -- sent to NEAR,
// not yet settled -- is one of them; treating it as final would report a
// transfer that is about to land as one that did not.
export const INTENT_IN_FLIGHT = Object.freeze(['PENDING', 'TX_BROADCASTED']);

export async function waitForIntentSettlement(intentHash, {
  timeoutMs = 60_000,
  pollMs = 2_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = { status: 'PENDING', transactionHash: null, raw: null };

  while (Date.now() < deadline) {
    last = await getIntentStatus(intentHash);
    if (!INTENT_IN_FLIGHT.includes(last.status)) return last;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { ...last, status: INTENT_IN_FLIGHT.includes(last.status) ? 'TIMED_OUT' : last.status };
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

// === Portfolio discovery and balances ===

// Read-only portfolio for the account's NEAR Intents balances.
//
// Shaped deliberately like WalletDiscoveryService in evm-assets.js -- same
// lifecycle (reset / activate / refresh with a cache TTL and a deduped pending
// request), same frozen asset and network shapes -- so that merging these rows
// into the wallet catalog later is mechanical rather than a rewrite.
//
// Two things are different on purpose:
//
//   1. There is no per-chain discovery. The verifier holds every asset as a
//      NEP-245 multi-token, so one view call returns the whole multichain
//      portfolio. Bitcoin, Solana and the rest cost no extra requests.
//   2. These balances are claims held by intents.near, not coins held on their
//      home chain. They are grouped under one network rather than presented as
//      per-chain wallets, because pretending otherwise would misstate custody.
//
// Portfolio discovery is read-only; the transfer and withdrawal services below
// handle signing and moving these balances.

export const INTENTS_NETWORK_ID = 'intents';

const BALANCE_CACHE_TTL_MS = 5_000;
const TOKEN_CATALOG_TTL_MS = 300_000;

const CHAIN_NAMES = Object.freeze({
  btc: 'Bitcoin', sol: 'Solana', eth: 'Ethereum', near: 'NEAR', base: 'Base',
  arb: 'Arbitrum', op: 'Optimism', pol: 'Polygon', bsc: 'BNB Chain', avax: 'Avalanche',
  doge: 'Dogecoin', ltc: 'Litecoin', bch: 'Bitcoin Cash', zec: 'Zcash', xrp: 'XRP Ledger',
  ton: 'TON', tron: 'Tron', sui: 'Sui', aptos: 'Aptos', stellar: 'Stellar',
  cardano: 'Cardano', gnosis: 'Gnosis', starknet: 'Starknet', scroll: 'Scroll',
  bera: 'Berachain', monad: 'Monad', plasma: 'Plasma', dash: 'Dash', aleo: 'Aleo',
});

// Tokens held on NEAR that stand for another chain's coin -- deposited from
// that chain and withdrawn back to it. They are named for that chain, the one
// people actually send from: "BTC · NEAR" named a network the person had
// never touched. Bitcoin deposits are credited to nBTC, not to btc.omft.near
// (seen on a real deposit, 2026-09-28).
//
// Only the name moves. `blockchain` stays NEAR, because it is what decides
// where a payout lands: choosing nBTC as a withdrawal's destination pays out
// on NEAR, and the Withdraw network list must say so.
const HOME_CHAIN = Object.freeze({ 'nep141:nbtc.bridge.near': 'btc' });

export function chainDisplayName(blockchain) {
  const key = String(blockchain || '').toLowerCase();
  return CHAIN_NAMES[key] || (key ? key.toUpperCase() : 'Unknown');
}

/**
 * The intents account id for a Liberdus account.
 *
 * Liberdus stores addresses both as 20 bytes and as a 64-character form padded
 * with 24 zeros; evm-assets.js unpads the same way before using one as an EVM
 * address, and the intents account id is that EVM address.
 */
export function intentsAccountIdForAddress(address) {
  let normalized = String(address || '').trim().toLowerCase().replace(/^0x/, '');
  if (/^[0-9a-f]{64}$/.test(normalized) && normalized.endsWith('0'.repeat(24))) {
    normalized = normalized.slice(0, 40);
  }
  return /^[0-9a-f]{40}$/.test(normalized) ? `0x${normalized}` : null;
}

// Mirrors formatUnits() in evm-assets.js, which is private to that module.
// Shared so deposit addresses can format minimums the same way rather than
// keeping a third copy of it.
export function formatUnits(value, decimals = 18) {
  const amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function toRawAmount(value) {
  try {
    const amount = BigInt(value ?? 0);
    return amount < 0n ? 0n : amount;
  } catch {
    return 0n;
  }
}

export function normalizeIntentsToken(token, rawBalance) {
  const decimals = Number.isInteger(token?.decimals) ? token.decimals : 18;
  const rawAmount = toRawAmount(rawBalance);
  const tokenAmount = formatUnits(rawAmount, decimals);

  // Number(null) is 0, so an absent price has to be rejected before coercion --
  // otherwise an unpriced asset reads as "worth $0.00" rather than "unknown".
  const rawPrice = token?.price;
  const price = Number(rawPrice);
  const hasPrice = rawPrice !== null && rawPrice !== undefined && rawPrice !== ''
    && Number.isFinite(price) && price >= 0;
  const tokenPriceUsd = hasPrice ? String(price) : null;
  const tokenValueUsd = hasPrice ? String(Number(tokenAmount) * price) : null;

  return Object.freeze({
    key: `${INTENTS_NETWORK_ID}:${token.assetId}`,
    networkId: INTENTS_NETWORK_ID,
    chainId: null,
    assetId: token.assetId,
    contractAddress: token?.contractAddress || null,
    tokenType: 'intents',
    tokenName: `${token?.symbol || 'Unknown'} on ${chainDisplayName(token?.blockchain)}`,
    tokenSymbol: token?.symbol || '???',
    tokenPriceUsd,
    tokenAmount,
    tokenValueUsd,
    tokenDecimals: decimals,
    rawAmount: rawAmount.toString(),
    logoUrl: null,
    blockchain: String(token?.blockchain || '').toLowerCase(),
    chainName: chainDisplayName(HOME_CHAIN[token?.assetId] || token?.blockchain),
    source: 'intents',
    walletAsset: null,
  });
}

function sortAssets(assets) {
  return assets.slice().sort((left, right) => {
    const leftValue = Number(left.tokenValueUsd);
    const rightValue = Number(right.tokenValueUsd);
    const leftHas = Number.isFinite(leftValue) && leftValue > 0;
    const rightHas = Number.isFinite(rightValue) && rightValue > 0;
    if (leftHas !== rightHas) return leftHas ? -1 : 1;
    if (leftHas && rightHas && leftValue !== rightValue) return rightValue - leftValue;
    return left.tokenSymbol.localeCompare(right.tokenSymbol)
      || left.chainName.localeCompare(right.chainName);
  });
}

/**
 * Keep an asset when it holds something, or when it was held before and has
 * since gone to zero -- that row explains where the money went. Nothing is
 * listed for its own sake: two pinned zero rows on a new account read as a
 * balance sheet with nothing on it, and 190-odd would be worse.
 */
function isWorthShowing(asset, alsoShow) {
  return asset.rawAmount !== '0' || alsoShow.includes(asset.assetId);
}

export function buildIntentsNetwork(tokens, balances, { alsoShow = [] } = {}) {
  const assets = sortAssets(
    tokens
      .map((token) => normalizeIntentsToken(token, balances?.[token.assetId]))
      .filter((asset) => isWorthShowing(asset, alsoShow)),
  );

  const totalValueUsd = assets.reduce((total, asset) => {
    const value = Number(asset.tokenValueUsd);
    return Number.isFinite(value) ? total + value : total;
  }, 0);

  return Object.freeze({
    id: INTENTS_NETWORK_ID,
    name: 'NEAR Intents',
    shortName: 'Intents',
    chainId: null,
    nativeSymbol: null,
    source: 'intents',
    // Held by the verifier contract on the account's behalf, not on the home
    // chain of each asset. The UI must not imply self-custody.
    custody: 'verifier',
    connected: assets.some((asset) => asset.rawAmount !== '0'),
    totalValueUsd: String(totalValueUsd),
    assets: Object.freeze(assets),
  });
}

export class IntentsDiscoveryService {
  constructor({
    getAccount = () => null,
    balanceCacheTtlMs = BALANCE_CACHE_TTL_MS,
    tokenCatalogTtlMs = TOKEN_CATALOG_TTL_MS,
  } = {}) {
    if (typeof getAccount !== 'function') {
      throw new TypeError('Intents discovery state providers must be functions');
    }
    this.getAccount = getAccount;
    this.balanceCacheTtlMs = balanceCacheTtlMs;
    this.tokenCatalogTtlMs = tokenCatalogTtlMs;
    this.tokens = [];
    this.tokensFetchedAt = 0;
    this.reset();
  }

  /**
   * `getHeldBefore`/`saveHeldBefore` keep the ids of every asset this
   * account has held, with the account's own saved state. The verifier only
   * reports balances, so an asset spent to zero is otherwise indistinguishable
   * from one never touched.
   */
  configure({ getAccount, getHeldBefore, saveHeldBefore } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
    if (typeof getHeldBefore === 'function') this.getHeldBefore = getHeldBefore;
    if (typeof saveHeldBefore === 'function') this.saveHeldBefore = saveHeldBefore;
  }

  heldBefore() {
    try {
      const ids = this.getHeldBefore?.();
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }

  /** Note any asset held now that was not held before. */
  rememberHeld() {
    const known = this.heldBefore();
    const fresh = Object.entries(this.balances || {})
      .filter(([assetId, raw]) => String(raw) !== '0' && !known.includes(assetId))
      .map(([assetId]) => assetId);
    if (fresh.length) this.saveHeldBefore?.([...known, ...fresh]);
  }

  reset() {
    this.balances = null;
    this.network = buildIntentsNetwork([], {});
    this.status = 'idle';
    this.updatedAt = 0;
    this.pendingRequest = null;
    this.accountId = null;
  }

  rebuildNetwork() {
    this.network = buildIntentsNetwork(this.tokens, this.balances || {}, { alsoShow: this.heldBefore() });
    return this.network;
  }

  getNetwork() { return this.network; }
  getCatalog() { return Object.freeze([this.network]); }
  getAssets() { return this.network.assets; }
  getStatus() { return this.status; }
  getUpdatedAt() { return this.updatedAt; }
  getAccountId() { return this.accountId; }

  getAsset(assetKey) {
    return this.network.assets.find((asset) => asset.key === assetKey) || null;
  }

  /**
   * Every asset the catalog knows, held or not.
   *
   * The portfolio deliberately shows only what you hold; swapping needs the
   * opposite, because you swap into things you do not have yet.
   */
  listCatalogAssets() {
    return this.tokens
      .map((token) => normalizeIntentsToken(token, this.balances?.[token.assetId]))
      .sort((left, right) => left.tokenSymbol.localeCompare(right.tokenSymbol)
        || left.chainName.localeCompare(right.chainName));
  }

  /** Look one up by key, whether or not there is a balance behind it. */
  getCatalogAsset(assetKey) {
    return this.listCatalogAssets().find((asset) => asset.key === assetKey) || null;
  }

  getTotalUsd() {
    const total = Number(this.network.totalValueUsd);
    return Number.isFinite(total) ? total : 0;
  }

  activateAccount(accountId) {
    if (this.accountId === accountId) return;
    this.balances = null;
    this.network = buildIntentsNetwork([], {});
    this.status = 'idle';
    this.updatedAt = 0;
    this.pendingRequest = null;
    this.accountId = accountId;
  }

  /** The token catalog barely moves, so it is cached well past the balances. */
  async loadTokens({ force = false } = {}) {
    const now = Date.now();
    if (!force && this.tokens.length && now - this.tokensFetchedAt < this.tokenCatalogTtlMs) {
      return this.tokens;
    }
    const body = await fetchIntentsTokens();
    const tokens = (Array.isArray(body) ? body : body?.tokens || [])
      .filter((token) => token && typeof token.assetId === 'string');
    if (!tokens.length) {
      throw new TypeError('Intents token catalog came back empty');
    }
    this.tokens = tokens;
    this.tokensFetchedAt = now;
    return this.tokens;
  }

  async refresh({ force = false } = {}) {
    const account = this.getAccount();
    const accountId = intentsAccountIdForAddress(account?.keys?.address);
    if (!accountId) {
      return this.getNetwork();
    }
    this.activateAccount(accountId);

    const now = Date.now();
    if (!force && this.updatedAt && now - this.updatedAt < this.balanceCacheTtlMs) {
      return this.getNetwork();
    }
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    this.status = 'loading';
    const request = this.fetchPortfolio(accountId);
    this.pendingRequest = request;
    try {
      return await request;
    } finally {
      if (this.pendingRequest === request) {
        this.pendingRequest = null;
      }
    }
  }

  /**
   * Never throws: like the EVM discovery service, an unreachable endpoint
   * leaves the wallet rendering a placeholder rather than an error screen.
   */
  async fetchPortfolio(accountId) {
    try {
      const tokens = await this.loadTokens();
      const balances = await getIntentsBalances(accountId, tokens.map((token) => token.assetId));

      // The account can change while this is in flight.
      if (this.accountId !== accountId) {
        return this.rebuildNetwork();
      }

      this.balances = balances;
      this.status = 'connected';
      this.updatedAt = Date.now();
      this.rememberHeld();
      return this.rebuildNetwork();
    } catch (error) {
      if (this.accountId === accountId) {
        this.status = 'unavailable';
        console.warn('Intents portfolio unavailable:', error);
      }
      return this.rebuildNetwork();
    }
  }
}

export const intentsAssets = new IntentsDiscoveryService();

// === Destination address validation ===

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

// === Asset and network icons ===

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

const TRUSTWALLET = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';

// Our chain ids against that repo's folder names. Verified by fetching each:
// the obvious guesses are wrong for three of them -- Dogecoin is `doge`,
// Gnosis is `xdai`, XRP is `ripple`. Chains absent here have no folder, and
// fall through to the drawn mark.
// What each chain's own coin is called. The coin's logo may only be used when
// the asset *is* that coin -- otherwise USDC held on Base would render with a
// logo that is not USDC's.
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

// A chain's `info/logo.png` is usually its coin's logo, but a rollup's folder
// carries the rollup's own mark: `base/info/logo.png` is Base's blue square,
// not ETH. Coins that run on chains other than their own are drawn from home.
const COIN_FOLDER = Object.freeze({ ETH: 'ethereum' });

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

// Tokens whose own logo the repo does not carry, drawn with the coin they
// stand for. nBTC is Bitcoin held on NEAR; its own path 404s.
const LOGO_ALIAS = Object.freeze({
  'near:nbtc.bridge.near': `${TRUSTWALLET}/bitcoin/info/logo.png`,
});

/** Where the logo lives, or null when we have no path worth trying. */
export function assetLogoUrl({ blockchain, contractAddress, symbol } = {}) {
  const chain = String(blockchain || '').toLowerCase();
  const alias = LOGO_ALIAS[`${chain}:${String(contractAddress || '').toLowerCase()}`];
  if (alias) return alias;
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
  return `${TRUSTWALLET}/${COIN_FOLDER[native] || folder}/info/logo.png`;
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
 * A network's mark as markup, for choosing between chains: the chain's logo
 * over a disc lettered with the start of its name, as assetIconMarkup does
 * for an asset.
 */
export function chainIconMarkup(blockchain, { name = '', size = 20, escape = (v) => v } = {}) {
  const label = String(name || blockchain || '').slice(0, 3).toUpperCase();
  const url = chainLogoUrl(blockchain);
  const image = url
    ? `<img class="asset-mark-image" src="${escape(url)}" alt="" loading="lazy" decoding="async">`
    : '';
  return `<span class="asset-mark" aria-hidden="true" style="--mark-bg:${chainBrandColor(blockchain)};--mark-size:${size}px"`
    + ` data-len="${label.length}"><span class="asset-mark-label">${escape(label)}</span>${image}</span>`;
}

/**
 * Take a logo that failed to load off the page, leaving the drawn disc; and
 * mark one that loaded, so the disc and letters beneath it stop showing.
 *
 * With alt="" Chrome draws nothing for a broken image, but Safari and some
 * WebViews draw a thin grey frame -- a dark ring bleeding round the disc.
 * A logo that loaded is the whole mark: most cover the disc anyway, but
 * Base's is a small square in transparent padding, and it sat on a purple
 * disc with "BAS" showing round it. Neither event bubbles, so both are heard
 * in the capture phase, once.
 */
let logoFallbackInstalled = false;
export function installLogoFallback(root = globalThis.document) {
  if (logoFallbackInstalled || !root) return;
  logoFallbackInstalled = true;
  root.addEventListener('error', (event) => {
    const image = event.target;
    if (image?.matches?.('.asset-mark-image, .popup-select__option-icon img')) image.remove();
  }, true);
  root.addEventListener('load', (event) => {
    const image = event.target;
    if (image?.matches?.('.asset-mark-image')) image.parentElement?.classList.add('has-logo');
  }, true);
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

  // Hidden from assistive tech: a mark always sits beside the name it shows,
  // and its fallback label would otherwise be read out a second time.
  return `<span class="asset-mark" aria-hidden="true" style="--mark-bg:${assetBrandColor(key)};--mark-size:${size}px"`
    + ` data-len="${label.length}">${base}${image}</span>`;
}

// === Transfers between accounts ===

// Sending an intents balance to another Liberdus account.
//
// This is the part that makes multichain assets a messaging feature rather
// than a wallet tab. Both sides of a Liberdus chat already have an intents
// account -- it is their account address -- so a transfer inside the verifier
// settles between them directly: no chain fee, no bridge, no waiting on
// confirmations, and nothing to see on Bitcoin or Solana.
//
// What it is not: a withdrawal. This moves a claim from one account to another
// inside intents.near. Getting the asset onto its home chain is a separate
// intent and a separate phase.

export class IntentsTransferError extends Error {
  constructor(message, code = 'TRANSFER_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsTransferError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Decimal amount to the token's smallest unit, exactly.
 *
 * Never via Number: 0.1 BTC through a float is 0.1000000000000000055511151231,
 * and at eight decimals that is a different amount of money. Everything here
 * stays in strings and BigInt.
 */
export function parseTokenAmount(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new IntentsTransferError('Token decimals are out of range', 'INVALID_DECIMALS');
  }

  const text = String(value ?? '').trim();
  if (!/^\d*(\.\d*)?$/.test(text) || text === '' || text === '.') {
    throw new IntentsTransferError('Enter an amount using digits only', 'INVALID_AMOUNT');
  }

  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) {
    throw new IntentsTransferError(
      decimals === 0
        ? 'This asset cannot be split into fractions'
        : `This asset supports at most ${decimals} decimal places`,
      'TOO_PRECISE',
    );
  }

  const raw = BigInt(`${whole || '0'}${fraction.padEnd(decimals, '0')}`);
  if (raw <= 0n) {
    throw new IntentsTransferError('Enter an amount greater than zero', 'AMOUNT_NOT_POSITIVE');
  }
  return raw;
}

export class IntentsTransferService {
  constructor({ getAccount = () => null } = {}) {
    this.getAccount = getAccount;
  }

  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
  }

  /**
   * Everything that can be checked before anyone signs anything.
   *
   * Returns a frozen description of the transfer. Nothing here talks to the
   * network except the salt, which the nonce needs.
   */
  async prepare({ asset, recipientAddress, amount, memo = null }) {
    const account = this.getAccount();
    const senderId = intentsAccountIdForAddress(account?.keys?.address);
    if (!senderId) {
      throw new IntentsTransferError('No account is signed in', 'NO_ACCOUNT');
    }
    if (!asset?.assetId) {
      throw new IntentsTransferError('Choose an asset to send', 'NO_ASSET');
    }

    const recipientId = intentsAccountIdForAddress(recipientAddress);
    if (!recipientId) {
      throw new IntentsTransferError('That recipient address is not valid', 'INVALID_RECIPIENT');
    }
    // The verifier refuses a self-transfer as an invalid intent, before it
    // looks at balances, so catch it here where the message can be useful.
    if (recipientId === senderId) {
      throw new IntentsTransferError('You cannot send this to yourself', 'SELF_TRANSFER');
    }

    const rawAmount = parseTokenAmount(amount, asset.tokenDecimals);
    const available = BigInt(asset.rawAmount || '0');
    if (rawAmount > available) {
      throw new IntentsTransferError(
        `You only have ${asset.tokenAmount} ${asset.tokenSymbol}`,
        'INSUFFICIENT_BALANCE',
        { available: available.toString(), requested: rawAmount.toString() },
      );
    }

    const deadline = intentDeadline();
    const salt = await getCurrentSalt();

    return Object.freeze({
      senderId,
      recipientId,
      assetId: asset.assetId,
      symbol: asset.tokenSymbol,
      chainName: asset.chainName,
      amount: String(amount).trim(),
      rawAmount: rawAmount.toString(),
      memo: memo ? String(memo) : null,
      payload: buildIntentPayload({
        signerId: senderId,
        deadline,
        nonce: buildVersionedNonce(salt, deadline),
        intents: [buildTransferIntent({
          receiverId: recipientId,
          tokens: { [asset.assetId]: rawAmount.toString() },
          memo: memo || null,
        })],
      }),
    });
  }

  /** Sign a prepared transfer. Signing alone publishes nothing. */
  sign(prepared, secretKey) {
    return signIntentPayload(prepared.payload, secretKey);
  }

  /**
   * Ask the verifier what this transfer would do, without doing it.
   *
   * Worth running before publishing: it catches a bad signature, a spent
   * nonce, a stale salt or an expired deadline for free, where publishing
   * would spend the relayer's gas to discover the same thing.
   */
  async simulate(signed) {
    try {
      const simulation = await simulateIntents(signed);
      return { ok: true, simulation, reason: null };
    } catch (error) {
      return { ok: false, simulation: null, reason: error.message || String(error) };
    }
  }

  /**
   * Publish, then wait for the relayer to land it.
   *
   * The only call in this file with consequences.
   */
  async send(prepared, secretKey, { waitMs = 60_000 } = {}) {
    const signed = await this.sign(prepared, secretKey);
    const intentHash = await publishIntent(signed);
    const settlement = await waitForIntentSettlement(intentHash, { timeoutMs: waitMs });
    return {
      intentHash,
      status: settlement.status,
      transactionHash: settlement.transactionHash,
      settled: settlement.status === 'SETTLED',
    };
  }
}

export const intentsTransfers = new IntentsTransferService();

// === Deposit addresses and history ===

// Funding an intents account from another chain.
//
// The bridge derives one deposit address per (account, chain) and credits the
// intents balance once the transfer confirms. Sending BTC to that address is
// the whole deposit: no NEAR, no signature, no transaction from this client.
//
// Two rules the UI cannot soften, because breaking either loses the money:
//
//   - A deposit below the token's min_deposit_amount is not credited.
//   - On a memo chain, a transfer without the memo is not credited.
//
// So both are part of the deposit target rather than presentational extras,
// and requestDepositTarget throws rather than degrading quietly: unlike a
// background balance refresh, this is an explicit action whose failure the
// person must see before they send funds anywhere.

const BRIDGE_TOKEN_TTL_MS = 300_000;

// The bridge names chains as "<family>:<network>", and every EVM chain shares
// the "eth" family: Base is eth:8453, BNB Chain is eth:56. Naming them by the
// family alone would label ten different chains "Ethereum" and invite someone
// to send Base funds to a mainnet address, so the key is the whole chain id.
//
// Unmapped chains fall back to the raw id rather than a guess. "eth:36900" is
// unhelpful, but it is not wrong, and on this screen being wrong loses money.
const BRIDGE_CHAIN_NAMES = Object.freeze({
  'btc:mainnet': 'Bitcoin', 'sol:mainnet': 'Solana', 'near:mainnet': 'NEAR',
  'eth:1': 'Ethereum', 'eth:8453': 'Base', 'eth:42161': 'Arbitrum', 'eth:10': 'Optimism',
  'eth:56': 'BNB Chain', 'eth:137': 'Polygon', 'eth:100': 'Gnosis', 'eth:43114': 'Avalanche',
  'eth:534352': 'Scroll', 'eth:196': 'X Layer', 'eth:143': 'Monad', 'eth:80094': 'Berachain',
  'eth:9745': 'Plasma',
  'doge:mainnet': 'Dogecoin', 'ltc:mainnet': 'Litecoin', 'bch:mainnet': 'Bitcoin Cash',
  'dash:mainnet': 'Dash', 'zec:mainnet': 'Zcash', 'xrp:mainnet': 'XRP Ledger',
  'ton:mainnet': 'TON', 'tron:mainnet': 'Tron', 'sui:mainnet': 'Sui', 'aptos:mainnet': 'Aptos',
  'stellar:mainnet': 'Stellar', 'cardano:mainnet': 'Cardano', 'starknet:mainnet': 'Starknet',
  'aleo:mainnet': 'Aleo', 'movement:mainnet': 'Movement', 'fogo:mainnet': 'Fogo',
  'hypercore:mainnet': 'Hypercore',
});

export function bridgeChainDisplayName(chain) {
  return BRIDGE_CHAIN_NAMES[chain] || chain || 'Unknown';
}

export class IntentsDepositService {
  constructor({ bridgeTokenTtlMs = BRIDGE_TOKEN_TTL_MS } = {}) {
    this.bridgeTokenTtlMs = bridgeTokenTtlMs;
    this.bridgeTokens = [];
    this.bridgeTokensFetchedAt = 0;
    this.addresses = new Map();
  }

  reset() {
    this.addresses.clear();
  }

  async loadBridgeTokens({ force = false } = {}) {
    const now = Date.now();
    if (!force && this.bridgeTokens.length && now - this.bridgeTokensFetchedAt < this.bridgeTokenTtlMs) {
      return this.bridgeTokens;
    }
    const tokens = await fetchBridgeTokens();
    if (!tokens.length) {
      throw new TypeError('The deposit service listed no supported tokens');
    }
    this.bridgeTokens = tokens;
    this.bridgeTokensFetchedAt = now;
    return this.bridgeTokens;
  }

  /**
   * What it takes to fund one asset: which chain to send on, and the smallest
   * amount that will actually arrive.
   *
   * Several intents assets share a chain -- every SPL token deposits to the
   * same Solana address -- so the chain alone does not identify what gets
   * credited. `siblings` counts the other tokens the bridge carries on this
   * chain under the same name, which is what makes a deposit ambiguous.
   */
  describeDepositTarget(assetId) {
    const token = this.bridgeTokens.find((entry) => entry.intents_token_id === assetId);
    if (!token) return null;

    const chain = bridgeChainOf(token.defuse_asset_identifier);
    const decimals = Number.isInteger(token.decimals) ? token.decimals : 18;
    const siblings = this.bridgeTokens.filter((entry) => (
      entry.intents_token_id !== assetId
      && entry.asset_name === token.asset_name
      && bridgeChainOf(entry.defuse_asset_identifier) === chain
    )).length;

    return Object.freeze({
      assetId,
      chain,
      chainName: bridgeChainDisplayName(chain),
      assetName: token.asset_name || null,
      decimals,
      minDepositRaw: String(token.min_deposit_amount ?? '0'),
      minDeposit: formatUnits(token.min_deposit_amount ?? 0, decimals),
      minWithdrawalRaw: String(token.min_withdrawal_amount ?? '0'),
      minWithdrawal: formatUnits(token.min_withdrawal_amount ?? 0, decimals),
      withdrawalFeeRaw: String(token.withdrawal_fee ?? '0'),
      withdrawalFee: formatUnits(token.withdrawal_fee ?? 0, decimals),
      siblings,
    });
  }

  /** Whether the bridge takes deposits of this asset at all. */
  isDepositable(assetId) {
    return Boolean(this.describeDepositTarget(assetId)?.chain);
  }

  /** Chains this account can be funded on at all. */
  listDepositChains() {
    const chains = new Map();
    for (const token of this.bridgeTokens) {
      const chain = bridgeChainOf(token.defuse_asset_identifier);
      if (!chain || chains.has(chain)) continue;
      chains.set(chain, {
        chain,
        chainName: bridgeChainDisplayName(chain),
      });
    }
    return Object.freeze([...chains.values()]);
  }

  /**
   * The address to send to, plus everything that must be said alongside it.
   *
   * Addresses are stable per account and chain, so they are cached and reused
   * the way a receive address is.
   */
  async requestDepositTarget(accountId, assetId, { force = false } = {}) {
    await this.loadBridgeTokens();

    const target = this.describeDepositTarget(assetId);
    if (!target?.chain) {
      throw new Error(`The deposit service does not carry ${assetId}`);
    }

    const cacheKey = `${accountId}|${target.chain}`;
    if (!force && this.addresses.has(cacheKey)) {
      return Object.freeze({ ...target, ...this.addresses.get(cacheKey) });
    }

    const address = await requestDepositAddress(accountId, target.chain);
    this.addresses.set(cacheKey, address);
    return Object.freeze({ ...target, ...address });
  }

  /** Deposits the bridge has seen, newest first, for the pending-state UI. */
  async listRecentDeposits(accountId, chain, options = {}) {
    return fetchRecentDeposits(accountId, chain, options);
  }
}

export const intentsDeposits = new IntentsDepositService();

/**
 * Payment URI for a deposit address, so a wallet app opens prefilled.
 *
 * Only for chains with a settled URI scheme. Anything else returns null and
 * the QR carries the bare address -- a made-up scheme would produce a code
 * that silently fails to scan in the wallet someone actually uses.
 */
export function depositUri(chain, address, { amount = null } = {}) {
  const scheme = {
    'btc:mainnet': 'bitcoin',
    'ltc:mainnet': 'litecoin',
    'doge:mainnet': 'dogecoin',
    'bch:mainnet': 'bitcoincash',
    'dash:mainnet': 'dash',
  }[chain];
  if (!scheme || !address) return null;
  const query = amount ? `?amount=${encodeURIComponent(amount)}` : '';
  return `${scheme}:${address}${query}`;
}

// === Shared swap and withdrawal funding ===

// The machinery shared by withdrawals and swaps.
//
// Both are the same shape: ask 1Click what it would cost, take a live quote to
// get a deposit address inside the verifier, fund that address with an ordinary
// transfer intent, then follow the order out. Only three fields differ --
// what you end up holding, who receives it, and whether the payout lands on a
// foreign chain or stays in intents.
//
// It lives in one place because the parts that are easy to get wrong are the
// shared ones: refusing an expired deposit address, insisting the funding
// transfer actually settled before watching for a payout, and not mistaking a
// status-endpoint hiccup for a failed order. Two copies of that would drift.

export const QUOTE_LIFETIME_MS = 10 * 60_000;
export const DEPOSIT_DEADLINE_MARGIN_MS = 30_000;
export const STATUS_POLL_MS = 3_000;
export const STATUS_TIMEOUT_MS = 10 * 60_000;

/** Statuses 1Click will not move on from. */
export const SETTLED_STATUSES = new Set(['SUCCESS', 'REFUNDED', 'FAILED']);

/**
 * The quote request.
 *
 * `refundType` is always INTENTS: if the order cannot be filled, the asset
 * should come back to the account that paid, not be pushed onto a foreign
 * chain the person may not have meant to touch.
 */
export function buildQuoteRequest({
  accountId,
  originAssetId,
  destinationAssetId,
  rawAmount,
  recipient,
  recipientType,
  dry,
  slippageBps,
}) {
  return {
    dry,
    swapType: 'EXACT_INPUT',
    slippageTolerance: slippageBps,
    originAsset: originAssetId,
    depositType: 'INTENTS',
    destinationAsset: destinationAssetId,
    amount: rawAmount,
    refundTo: accountId,
    refundType: 'INTENTS',
    recipient,
    recipientType,
    deadline: new Date(Date.now() + QUOTE_LIFETIME_MS).toISOString(),
  };
}

/**
 * The transfer that funds an order.
 *
 * Built here from values the caller chose, never from a payload 1Click
 * composed: this client signs only what it built itself, so no remote service
 * can hand it something to sign whose recipient or amount differs from what
 * was agreed. 1Click supplies the destination account and nothing else.
 */
export async function buildFundingTransfer({ accountId, assetId, rawAmount, depositAddress, depositMemo = null }) {
  const deadline = intentDeadline();
  const salt = await getCurrentSalt();
  return buildIntentPayload({
    signerId: accountId,
    deadline,
    nonce: buildVersionedNonce(salt, deadline),
    intents: [buildTransferIntent({
      receiverId: depositAddress,
      tokens: { [assetId]: rawAmount },
      memo: depositMemo || null,
    })],
  });
}

/** Ask the verifier whether the funding transfer would go through. */
export async function simulateFunding(signed) {
  try {
    return { ok: true, simulation: await simulateIntents(signed), reason: null };
  } catch (error) {
    return { ok: false, simulation: null, reason: error.message || String(error) };
  }
}

/** True when the quote's deposit address is gone or about to be. */
export function isQuoteExpired(depositDeadline) {
  if (!depositDeadline) return false;
  const expiresAt = Date.parse(depositDeadline);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() > expiresAt - DEPOSIT_DEADLINE_MARGIN_MS;
}

/**
 * Fund an order and wait for the funding transfer to land.
 *
 * Returns only once the transfer has settled, because watching for a payout
 * that was never paid for would report a timeout instead of the real failure.
 */
export async function fundOrder(prepared, secretKey, { signed = null } = {}) {
  // A caller that simulated first passes the signature it checked, so the
  // payload published is the one the verifier approved.
  const payload = signed || await signIntentPayload(prepared.payload, secretKey);
  const intentHash = await publishIntent(payload);
  const settlement = await waitForIntentSettlement(intentHash);
  return { intentHash, settlement, settled: settlement.status === 'SETTLED' };
}

/** Poll 1Click until the order reaches a resting state. */
export async function followOrder({
  getStatus,
  depositAddress,
  depositMemo = null,
  onStatus = null,
  timeoutMs = STATUS_TIMEOUT_MS,
}) {
  const deadline = Date.now() + timeoutMs;
  let last = { status: 'PENDING', detail: null };

  while (Date.now() < deadline) {
    let response;
    try {
      response = await getStatus(depositAddress, depositMemo);
    } catch {
      // A status endpoint hiccup is not a failed order.
      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
      continue;
    }

    last = { status: String(response?.status || 'PENDING'), detail: response };
    onStatus?.(last);
    if (SETTLED_STATUSES.has(last.status)) return last;

    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
  }
  return { ...last, status: last.status === 'PENDING' ? 'TIMED_OUT' : last.status };
}

// === Withdrawals to destination chains ===

// Taking an asset out of intents and back onto its own chain.
//
// The mechanics of leaving differ per asset -- PoA bridge for some, Omni for
// others, with a migration list between them that is maintained by hand, a
// storage account derived by a case-sensitive hash, and a fee charged in wNEAR.
// Reimplementing that split is the highest-risk code in this project, and there
// is no testnet on which to get it wrong safely.
//
// So we do not. 1Click prices the withdrawal and hands back a deposit address
// inside the verifier; funding it with an ordinary transfer intent is the whole
// of our side. The bridge choice, the fee maths and the storage derivation stay
// where they are maintained.
//
// The quote/fund/follow machinery is shared with swaps and lives in
// the shared funding helpers, including the rule that we sign only payloads we built
// ourselves. What is specific here is that the asset does not change: only
// where it lives does.

export class IntentsWithdrawError extends Error {
  constructor(message, code = 'WITHDRAW_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsWithdrawError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 1Click's refusals, in the person's units and words.
 *
 * Its minimum arrives as a raw integer -- "Amount is too low for bridge, try
 * at least 988022" -- in the units of the asset being withdrawn (checked on
 * dry quotes: 10256106572808952 for USDT on BNB Chain is 0.0103 at its 18
 * decimals). The figure is live and moves between quotes.
 *
 * Shown to four significant digits, rounded up: eighteen decimals of minimum
 * is not a number anyone types, and rounding up is the one direction that is
 * safe here -- an amount typed from it clears the minimum, where one rounded
 * down would be refused again. It also leaves room for the figure to creep up
 * before the next quote.
 */
export function roundUpRaw(raw, significant = 4) {
  const value = BigInt(raw);
  const digits = value.toString().length;
  if (digits <= significant) return value;
  const step = 10n ** BigInt(digits - significant);
  return ((value + step - 1n) / step) * step;
}

export function explainRefusal(error, asset, chain) {
  if (error?.code !== 'QUOTE_REFUSED') return error;
  const message = String(error.message || '');
  const minimum = /try at least (\d+)/i.exec(message)?.[1];
  if (minimum) {
    return new IntentsWithdrawError(
      `The smallest amount you can withdraw to ${chain} right now is ${formatUnits(roundUpRaw(minimum), asset.tokenDecimals)} ${asset.tokenSymbol}.`,
      'BELOW_MINIMUM',
      { cause: error, minimumRaw: minimum },
    );
  }
  if (/recipient is not valid/i.test(message)) {
    return new IntentsWithdrawError(`That address cannot receive on ${chain}.`, 'INVALID_ADDRESS', { cause: error });
  }
  return error;
}

export class IntentsWithdrawService {
  /**
   * `requestQuote` and `getStatus` are injectable so the request this builds
   * can be asserted without a network: the difference between refundType
   * INTENTS and DESTINATION_CHAIN is the difference between a refund coming
   * back and a refund going somewhere else.
   */
  constructor({
    getAccount = () => null,
    slippageBps = 100,
    requestQuote = requestSwapQuote,
    getStatus = getSwapStatus,
  } = {}) {
    this.getAccount = getAccount;
    this.slippageBps = slippageBps;
    this.requestQuote = requestQuote;
    this.getStatus = getStatus;
  }

  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
  }

  /**
   * The quote fields that make this a withdrawal rather than a swap.
   *
   * `destinationAsset` defaults to the asset being spent -- the same coin, on
   * its own chain. It differs when the same symbol exists on several chains:
   * ETH held on Base can leave to Ethereum or Arbitrum, and the person has to
   * say which, because an address is not enough to tell them apart.
   */
  quoteFor({ accountId, asset, destinationAsset = null, destinationAddress, rawAmount, dry }) {
    return buildQuoteRequest({
      accountId,
      originAssetId: asset.assetId,
      destinationAssetId: (destinationAsset || asset).assetId,
      rawAmount,
      recipient: destinationAddress,
      recipientType: 'DESTINATION_CHAIN',
      dry,
      slippageBps: this.slippageBps,
    });
  }

  /**
   * Checked before any quote, and again before the one that commits: an
   * address this can tell is wrong for the chain never reaches 1Click.
   */
  checkDestination({ asset, destinationAsset = null, destinationAddress }) {
    const chain = (destinationAsset || asset).blockchain;
    const problem = checkAddress(chain, destinationAddress);
    if (problem === '') {
      throw new IntentsWithdrawError('Enter an address to withdraw to', 'NO_DESTINATION');
    }
    if (problem) throw new IntentsWithdrawError(problem, 'INVALID_ADDRESS');
  }

  async quote(request, { asset, destinationAsset = null }) {
    try {
      return await this.requestQuote(request);
    } catch (error) {
      throw explainRefusal(error, asset, chainDisplayName((destinationAsset || asset).blockchain));
    }
  }

  /**
   * What this withdrawal would cost, without creating one.
   *
   * Also the validation step: a dry quote is where 1Click rejects a malformed
   * destination address or an amount below the bridge minimum, and its
   * explanations are better than anything we could compute locally -- the
   * minimums it quotes are live, where the cached ones are not always.
   */
  async preview({ accountId, asset, destinationAsset = null, destinationAddress, amount }) {
    const rawAmount = parseTokenAmount(amount, asset.tokenDecimals).toString();
    this.checkDestination({ asset, destinationAsset, destinationAddress });

    const response = await this.quote(
      this.quoteFor({ accountId, asset, destinationAsset, destinationAddress, rawAmount, dry: true }),
      { asset, destinationAsset },
    );

    const quote = response?.quote;
    if (!quote) {
      throw new IntentsWithdrawError('No quote came back for that withdrawal', 'NO_QUOTE', { response });
    }

    return Object.freeze({
      rawAmount,
      amountIn: quote.amountInFormatted,
      amountOut: quote.amountOutFormatted,
      minAmountOut: quote.minAmountOut,
      amountOutUsd: quote.amountOutUsd,
      withdrawFee: quote.withdrawFee,
      timeEstimateSeconds: quote.timeEstimate,
      symbol: asset.tokenSymbol,
      destinationAddress,
      // Where the payout lands, not an asset's display name (see HOME_CHAIN).
      destinationChain: chainDisplayName((destinationAsset || asset).blockchain),
    });
  }

  /**
   * Commit to the withdrawal: take a real quote, and build the transfer that
   * funds it. Nothing is signed or published here.
   */
  async prepare({ accountId, asset, destinationAsset = null, destinationAddress, amount }) {
    if (!accountId) {
      throw new IntentsWithdrawError('No account is signed in', 'NO_ACCOUNT');
    }
    const rawAmount = parseTokenAmount(amount, asset.tokenDecimals).toString();
    const available = BigInt(asset.rawAmount || '0');
    if (BigInt(rawAmount) > available) {
      throw new IntentsWithdrawError(
        `You only have ${asset.tokenAmount} ${asset.tokenSymbol}`,
        'INSUFFICIENT_BALANCE',
      );
    }
    this.checkDestination({ asset, destinationAsset, destinationAddress });

    const response = await this.quote(
      this.quoteFor({ accountId, asset, destinationAsset, destinationAddress, rawAmount, dry: false }),
      { asset, destinationAsset },
    );

    const quote = response?.quote;
    const depositAddress = quote?.depositAddress;
    if (!depositAddress) {
      throw new IntentsWithdrawError(
        'The quote did not come with a deposit address',
        'NO_DEPOSIT_ADDRESS',
        { response },
      );
    }

    const payload = await buildFundingTransfer({
      accountId,
      assetId: asset.assetId,
      rawAmount,
      depositAddress,
      depositMemo: quote.depositMemo,
    });

    return Object.freeze({
      accountId,
      assetId: asset.assetId,
      symbol: asset.tokenSymbol,
      amount: String(amount).trim(),
      rawAmount,
      destinationAddress,
      // Where the payout lands, not an asset's display name (see HOME_CHAIN).
      destinationChain: chainDisplayName((destinationAsset || asset).blockchain),
      depositAddress,
      depositMemo: quote.depositMemo || null,
      depositDeadline: quote.deadline || null,
      amountOut: quote.amountOutFormatted,
      withdrawFee: quote.withdrawFee,
      timeEstimateSeconds: quote.timeEstimate,
      payload,
    });
  }

  /** Ask the verifier whether the funding transfer would go through. */
  simulate(signed) {
    return simulateFunding(signed);
  }

  /**
   * Sign the funding transfer, publish it, and follow the withdrawal out.
   *
   * The deposit address expires; past that 1Click says funds sent to it may be
   * lost, so an expired quote is refused here rather than published hopefully.
   */
  /**
   * `onFunded` fires once the funding transfer has settled -- the moment the
   * asset has left the account. What follows is 1Click's payout, which can
   * take minutes; a caller need not hold the person on a spinner through it.
   */
  async execute(prepared, secretKey, { onStatus = null, onFunded = null, signed = null } = {}) {
    if (isQuoteExpired(prepared.depositDeadline)) {
      throw new IntentsWithdrawError(
        'This quote has expired. Get a new one before withdrawing.',
        'QUOTE_EXPIRED',
      );
    }

    const { intentHash, settlement, settled } = await fundOrder(prepared, secretKey, { signed });
    if (!settled) {
      throw new IntentsWithdrawError(
        `The funding transfer did not settle (${settlement.status})`,
        'FUNDING_FAILED',
        { intentHash, settlement },
      );
    }
    onFunded?.({ intentHash });

    const final = await this.followStatus(prepared, { onStatus });
    return {
      intentHash,
      transactionHash: settlement.transactionHash,
      status: final.status,
      detail: final.detail,
    };
  }

  /** Poll 1Click until the withdrawal reaches a resting state. */
  followStatus(prepared, { onStatus = null, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
    return followOrder({
      getStatus: (address, memo) => this.getStatus(address, memo),
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
      onStatus,
      timeoutMs,
    });
  }
}

export const intentsWithdrawals = new IntentsWithdrawService();

// === Swaps between balances ===

// Exchanging one intents balance for another.
//
// Mechanically this is the withdrawal flow with the payout pointed back at
// yourself: quote, fund the deposit address with a transfer intent, follow the
// order. The difference is that the asset changes and nothing leaves intents,
// so there is no destination chain, no address to get wrong, and no bridge
// minimum -- only the price.
//
// Which makes the price the thing to be careful about. A swap is the one
// operation here where the amount you receive is not known in advance: solvers
// compete, the quote moves, and slippage is the gap the person is agreeing to.
// So the worst case is what gets shown, not the headline number.

export class IntentsSwapError extends Error {
  constructor(message, code = 'SWAP_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsSwapError';
    this.code = code;
    this.details = details;
  }
}

/** Scale a raw amount to a decimal string without going through a float. */
function formatRaw(raw, decimals) {
  const amount = BigInt(raw || '0');
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

export class IntentsSwapService {
  constructor({
    getAccount = () => null,
    slippageBps = 100,
    requestQuote = requestSwapQuote,
    getStatus = getSwapStatus,
  } = {}) {
    this.getAccount = getAccount;
    this.slippageBps = slippageBps;
    this.requestQuote = requestQuote;
    this.getStatus = getStatus;
  }

  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
  }

  /**
   * The quote fields that make this a swap: a different asset out, and a
   * payout that stays inside intents rather than landing on a chain.
   */
  quoteFor({ accountId, fromAsset, toAsset, rawAmount, dry }) {
    return buildQuoteRequest({
      accountId,
      originAssetId: fromAsset.assetId,
      destinationAssetId: toAsset.assetId,
      rawAmount,
      recipient: accountId,
      recipientType: 'INTENTS',
      dry,
      slippageBps: this.slippageBps,
    });
  }

  /**
   * Price the swap without creating one.
   *
   * `minAmountOut` is the number that matters: solvers compete and the rate
   * moves between quoting and filling, so the guarantee is the floor, not the
   * estimate. Both are returned and the UI is expected to show the floor.
   */
  async preview({ accountId, fromAsset, toAsset, amount }) {
    if (!fromAsset?.assetId || !toAsset?.assetId) {
      throw new IntentsSwapError('Choose what to swap from and to', 'NO_ASSETS');
    }
    if (fromAsset.assetId === toAsset.assetId) {
      throw new IntentsSwapError('Choose two different assets', 'SAME_ASSET');
    }

    const rawAmount = parseTokenAmount(amount, fromAsset.tokenDecimals).toString();
    const response = await this.requestQuote(
      this.quoteFor({ accountId, fromAsset, toAsset, rawAmount, dry: true }),
    );

    const quote = response?.quote;
    if (!quote) {
      throw new IntentsSwapError('No quote came back for that swap', 'NO_QUOTE', { response });
    }

    const toDecimals = Number.isInteger(toAsset.tokenDecimals) ? toAsset.tokenDecimals : 18;
    return Object.freeze({
      rawAmount,
      amountIn: quote.amountInFormatted,
      amountOut: quote.amountOutFormatted,
      // The worst case the person is agreeing to.
      minAmountOut: quote.minAmountOut ? formatRaw(quote.minAmountOut, toDecimals) : null,
      amountInUsd: quote.amountInUsd,
      amountOutUsd: quote.amountOutUsd,
      timeEstimateSeconds: quote.timeEstimate,
      fromSymbol: fromAsset.tokenSymbol,
      toSymbol: toAsset.tokenSymbol,
      slippageBps: this.slippageBps,
    });
  }

  /** Take a live quote and build the transfer that funds it. */
  async prepare({ accountId, fromAsset, toAsset, amount }) {
    if (!accountId) {
      throw new IntentsSwapError('No account is signed in', 'NO_ACCOUNT');
    }
    if (!fromAsset?.assetId || !toAsset?.assetId) {
      throw new IntentsSwapError('Choose what to swap from and to', 'NO_ASSETS');
    }
    if (fromAsset.assetId === toAsset.assetId) {
      throw new IntentsSwapError('Choose two different assets', 'SAME_ASSET');
    }

    const rawAmount = parseTokenAmount(amount, fromAsset.tokenDecimals).toString();
    const available = BigInt(fromAsset.rawAmount || '0');
    if (BigInt(rawAmount) > available) {
      throw new IntentsSwapError(
        `You only have ${fromAsset.tokenAmount} ${fromAsset.tokenSymbol}`,
        'INSUFFICIENT_BALANCE',
      );
    }

    const response = await this.requestQuote(
      this.quoteFor({ accountId, fromAsset, toAsset, rawAmount, dry: false }),
    );

    const quote = response?.quote;
    const depositAddress = quote?.depositAddress;
    if (!depositAddress) {
      throw new IntentsSwapError(
        'The quote did not come with a deposit address',
        'NO_DEPOSIT_ADDRESS',
        { response },
      );
    }

    const payload = await buildFundingTransfer({
      accountId,
      assetId: fromAsset.assetId,
      rawAmount,
      depositAddress,
      depositMemo: quote.depositMemo,
    });

    const toDecimals = Number.isInteger(toAsset.tokenDecimals) ? toAsset.tokenDecimals : 18;
    return Object.freeze({
      accountId,
      fromAssetId: fromAsset.assetId,
      toAssetId: toAsset.assetId,
      fromSymbol: fromAsset.tokenSymbol,
      toSymbol: toAsset.tokenSymbol,
      amount: String(amount).trim(),
      rawAmount,
      depositAddress,
      depositMemo: quote.depositMemo || null,
      depositDeadline: quote.deadline || null,
      amountOut: quote.amountOutFormatted,
      minAmountOut: quote.minAmountOut ? formatRaw(quote.minAmountOut, toDecimals) : null,
      timeEstimateSeconds: quote.timeEstimate,
      payload,
    });
  }

  simulate(signed) {
    return simulateFunding(signed);
  }

  /** Fund the swap and follow it until it fills, refunds or fails. */
  /**
   * `onFunded` fires once the funding transfer has settled -- the moment the
   * asset has left the account. What follows is 1Click's payout, which can
   * take minutes; a caller need not hold the person on a spinner through it.
   */
  async execute(prepared, secretKey, { onStatus = null, onFunded = null, signed = null } = {}) {
    if (isQuoteExpired(prepared.depositDeadline)) {
      throw new IntentsSwapError(
        'This quote has expired. Get a new one before swapping.',
        'QUOTE_EXPIRED',
      );
    }

    const { intentHash, settlement, settled } = await fundOrder(prepared, secretKey, { signed });
    if (!settled) {
      throw new IntentsSwapError(
        `The funding transfer did not settle (${settlement.status})`,
        'FUNDING_FAILED',
        { intentHash, settlement },
      );
    }
    onFunded?.({ intentHash });

    const final = await this.followStatus(prepared, { onStatus });
    return {
      intentHash,
      transactionHash: settlement.transactionHash,
      status: final.status,
      // A refund is not a failure: the asset came back because the swap could
      // not be filled on the agreed terms, which is the protection working.
      refunded: final.status === 'REFUNDED',
      detail: final.detail,
    };
  }

  followStatus(prepared, { onStatus = null, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
    return followOrder({
      getStatus: (address, memo) => this.getStatus(address, memo),
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
      onStatus,
      timeoutMs,
    });
  }
}

export const intentsSwaps = new IntentsSwapService();

// === Chat payment receipts and verification ===

// Paying someone inside a conversation.
//
// Both sides of a Liberdus chat already have an intents account -- it is their
// account address -- so the value moves between them inside the verifier: no
// chain fee, no bridge, no confirmations, nothing visible on Bitcoin or Solana.
//
// The value and the message travel separately, because they settle on different
// networks. The transfer settles on NEAR; the chat message is a Liberdus
// transaction that announces it. Two consequences shape everything here:
//
//   1. The money moves first. If the announcement then fails to send, the
//      sender is told the funds moved but the receipt did not -- a missing
//      receipt is recoverable, a receipt for a payment that never happened is
//      not.
//
//   2. An incoming payment message is a claim, not proof. Anyone can send a
//      chat message saying they paid you. So the message names the intent and
//      the NEAR transaction that settled it, and the recipient reads that
//      transaction for themselves: the verifier logs who paid whom, which
//      token and how much. The UI never states a payment as received until
//      what was logged matches what was claimed.

export const INTENTS_CHAT_MESSAGE_TYPE = 'intents_transfer';

export class IntentsChatError extends Error {
  constructor(message, code = 'INTENTS_CHAT_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsChatError';
    this.code = code;
    this.details = details;
  }
}

/**
 * The announcement that travels through chat.
 *
 * Deliberately small: what was sent, and the hash that proves it. Anything the
 * recipient could derive for themselves is not worth trusting a peer for.
 */
export function buildTransferMessage({
  assetId, symbol, chainName, amount, decimals, intentHash, transactionHash = null, note = null,
}) {
  const message = {
    type: INTENTS_CHAT_MESSAGE_TYPE,
    assetId,
    symbol,
    chainName,
    amount,
    decimals,
    intentHash,
  };
  // The NEAR transaction that settled it: what the recipient checks, for as
  // long as the chat keeps the message. Absent when settlement was not seen.
  if (transactionHash) message.transactionHash = transactionHash;
  if (note) message.note = String(note).slice(0, 140);
  return message;
}

/**
 * Read a payment message that arrived from someone else.
 *
 * Every field is treated as hostile: a peer controls all of it, and a payment
 * bubble is a persuasive thing to be able to forge. Anything malformed is
 * rejected outright rather than rendered with defaults, because a bubble
 * reading "0 SOL" from a broken claim still looks like a payment happened.
 */
export function parseTransferMessage(raw) {
  if (!raw || raw.type !== INTENTS_CHAT_MESSAGE_TYPE) return null;

  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim() : '';
  const amount = typeof raw.amount === 'string' ? raw.amount.trim() : '';
  const intentHash = typeof raw.intentHash === 'string' ? raw.intentHash.trim() : '';

  // An amount must be a plain positive decimal. No exponents, no signs, no
  // stray text that a renderer might pass through.
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) return null;
  if (!assetId || assetId.length > 200) return null;
  if (!symbol || symbol.length > 16) return null;
  if (!intentHash || intentHash.length > 120 || !/^[A-Za-z0-9]+$/.test(intentHash)) return null;

  const chainName = typeof raw.chainName === 'string' ? raw.chainName.trim().slice(0, 32) : '';
  const decimals = Number.isInteger(raw.decimals) && raw.decimals >= 0 && raw.decimals <= 36
    ? raw.decimals
    : null;
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 140) : null;
  // Base58, like every NEAR transaction hash. Anything else is dropped rather
  // than rejecting the claim: without it the claim is simply checked the
  // older way, through the relay.
  const transactionHash = typeof raw.transactionHash === 'string'
    && /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(raw.transactionHash.trim())
    ? raw.transactionHash.trim()
    : null;

  return Object.freeze({
    type: INTENTS_CHAT_MESSAGE_TYPE,
    assetId,
    symbol,
    chainName,
    amount,
    decimals,
    intentHash,
    transactionHash,
    note: note || null,
  });
}

/**
 * Does a transfer the verifier logged say what the claim says?
 *
 * Returns null when it does, or the reason it does not. Addresses compare
 * case-insensitively; the amount compares exactly, in base units, so a
 * claim of 0.25 is not satisfied by a transfer of 0.250059.
 */
export function transferMismatch(transfer, claim, { expectedFrom = null, expectedTo = null } = {}) {
  const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  if (transfer.intentHash !== claim.intentHash) return 'a different intent';
  if (expectedFrom && !same(transfer.from, expectedFrom)) return 'a different sender';
  if (expectedTo && !same(transfer.to, expectedTo)) return 'a different recipient';
  const moved = transfer.tokens?.[claim.assetId];
  if (moved === undefined) return 'a different token';
  if (!Number.isInteger(claim.decimals)) return 'an amount that cannot be checked';
  let claimed;
  try {
    claimed = parseTokenAmount(claim.amount, claim.decimals);
  } catch {
    return 'an amount that cannot be checked';
  }
  if (BigInt(moved) !== claimed) return 'a different amount';
  return null;
}

// How long the relay can be relied on to remember an intent. It knew a
// payment made hours earlier and had forgotten ones from three days before
// (seen 2026-09-28), so past this "not found" stops meaning "never happened".
// Kept short: a genuine payment wrongly marked "Not confirmed" is the worse
// mistake, and a forged hash is unknown from its first moment anyway.
export const RELAY_MEMORY_MS = 6 * 60 * 60 * 1000;

/**
 * Did the claimed payment happen, as claimed?
 *
 * Reads the NEAR transaction that settled the intent -- named in the claim,
 * or, for claims from before it was, the one the relay names while it still
 * remembers -- and checks the verifier's own record of the transfer against
 * the claim: this intent, from this sender, to this recipient, this token,
 * this exact amount. A settled hash alone proves only that *some* transfer
 * happened; anyone could quote someone else's.
 *
 * `expectedFrom` / `expectedTo` are the intents accounts of the chat's two
 * sides. States: settled (checked and matching), failed (checked and not),
 * pending, expired (too old for the relay and never checked while it knew),
 * unverifiable (nothing could be asked -- not evidence either way).
 */
export async function verifyTransferClaim(claim, {
  getStatus = getIntentStatus,
  getTransfers = fetchIntentTransfers,
  expectedFrom = null,
  expectedTo = null,
  sentAt = null,
  now = Date.now(),
} = {}) {
  if (!claim?.intentHash) return { state: 'unverifiable', reason: 'No intent hash' };

  let transactionHash = claim.transactionHash || null;
  if (!transactionHash) {
    let status;
    try {
      status = await getStatus(claim.intentHash);
    } catch (error) {
      return { state: 'unverifiable', reason: error.message || String(error) };
    }
    if (INTENT_IN_FLIGHT.includes(status.status)) return { state: 'pending', transactionHash: null };
    if (status.status !== 'SETTLED') {
      // Unknown to the relay: damning for a fresh claim, which a genuine
      // payment never is, but only forgetfulness for an old one.
      if (status.status === 'NOT_FOUND_OR_NOT_VALID' && Number(sentAt) > 0 && now - Number(sentAt) > RELAY_MEMORY_MS) {
        return { state: 'expired', reason: status.status };
      }
      return { state: 'failed', reason: status.status };
    }
    transactionHash = status.transactionHash;
    if (!transactionHash) return { state: 'unverifiable', reason: 'Settled, but no transaction to check' };
  }

  let transfers;
  try {
    transfers = await getTransfers(transactionHash);
  } catch (error) {
    return { state: 'unverifiable', reason: error.message || String(error) };
  }
  const logged = transfers.find((transfer) => transfer.intentHash === claim.intentHash);
  if (!logged) return { state: 'failed', reason: 'The transaction carries no such transfer', transactionHash };
  const mismatch = transferMismatch(logged, claim, { expectedFrom, expectedTo });
  if (mismatch) return { state: 'failed', reason: `The transfer went to ${mismatch}`, transactionHash };
  return { state: 'settled', transactionHash };
}

/**
 * What a payment bubble says about the transfer behind it. One table, read by
 * the renderer and by the verifier that updates bubbles in place, so the two
 * cannot drift.
 *
 * Outcomes, not mechanism: "Confirmed", never "confirmed on chain".
 */
export function paymentStatusLabel(state) {
  return {
    settled: 'Confirmed',
    pending: 'Confirming…',
    failed: 'Not confirmed',
    // Too old for the relay to remember, and never checked while it did.
    // Neither a verdict nor a problem to fix.
    expired: 'Too old to check',
    unverifiable: 'Could not check yet',
    unchecked: 'Checking…',
  }[state] || 'Could not check yet';
}

export class IntentsChatPayments {
  constructor({ getAccount = () => null, transfers = null } = {}) {
    this.getAccount = getAccount;
    this.transfers = transfers || new IntentsTransferService({ getAccount });
  }

  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') {
      this.getAccount = getAccount;
      this.transfers.configure({ getAccount });
    }
  }

  /** Everything checkable before anything moves. */
  prepare({ asset, recipientAddress, amount, note = null }) {
    return this.transfers.prepare({
      asset,
      recipientAddress,
      amount,
      memo: note ? `liberdus:${String(note).slice(0, 100)}` : 'liberdus chat payment',
    });
  }

  /**
   * Move the value, then hand back the announcement to send.
   *
   * Publishing and announcing are separate on purpose: the caller sends the
   * chat message, and if that fails it still knows the funds moved.
   */
  async send(prepared, secretKey, { asset, note = null } = {}) {
    const signed = await this.transfers.sign(prepared, secretKey);

    // Rehearse first. A refusal here costs nothing; discovering the same
    // problem after publishing costs the relay's gas and confuses the sender.
    const check = await this.transfers.simulate(signed);
    if (!check.ok) {
      throw new IntentsChatError(
        `This payment would fail: ${check.reason}`,
        'WOULD_FAIL',
        { reason: check.reason },
      );
    }

    const intentHash = await publishIntent(signed);

    // Wait for it to land before announcing it: the receipt then names the
    // transaction the recipient will check, and no receipt is ever sent for
    // a transfer that visibly failed. Seconds, usually. Still unsettled after
    // the wait, the receipt goes without it and is checked through the relay.
    let settlement = null;
    try {
      settlement = await waitForIntentSettlement(intentHash, { timeoutMs: 30_000 });
    } catch {
      settlement = null;
    }
    if (settlement && !['SETTLED', 'TIMED_OUT'].includes(settlement.status)) {
      throw new IntentsChatError(
        `The transfer did not go through (${settlement.status}).`,
        'NOT_SETTLED',
        { intentHash, settlement },
      );
    }
    const transactionHash = settlement?.status === 'SETTLED' ? settlement.transactionHash : null;

    return {
      intentHash,
      transactionHash,
      message: buildTransferMessage({
        assetId: prepared.assetId,
        symbol: prepared.symbol,
        chainName: asset?.chainName || '',
        amount: prepared.amount,
        decimals: asset?.tokenDecimals ?? null,
        intentHash,
        transactionHash,
        note,
      }),
    };
  }
}

export const intentsChatPayments = new IntentsChatPayments();

// === Wallet activity ===

// What happened to an intents balance: deposits, payments, swaps, withdrawals.
//
// There is no single public history for an intents account -- the verifier
// keeps balances, not events, and 1Click's account history is invite-only --
// so the list is assembled from three sources, each authoritative for its
// own kind:
//
//   deposits    the bridge's recent_deposits, per account and chain. Public,
//               and complete: it includes deposits sent from anywhere.
//   payments    chat payment messages, sent and received, which the app
//               already keeps and which travel with the conversation.
//   swaps,      a record this device writes when it places the order, whose
//   withdrawals state is then read back from 1Click by deposit address.
//               Orders placed on another device do not appear -- a known,
//               accepted gap.
//
// Activity entries are data; the wallet screens below render them.

// A record per order is small, but a long-lived account would otherwise grow
// its saved state without bound.
const MAX_ORDERS = 200;

// Enough history for an asset screen; the bridge pages beyond this.
const DEPOSIT_LIMIT = 20;

const shortAddress = (address) => {
  const text = String(address || '');
  return text.length <= 14 ? text : `${text.slice(0, 6)}…${text.slice(-4)}`;
};

/** 1Click's order states, reduced to what a row needs to say. */
export function orderStatusFrom(status) {
  switch (status) {
    case 'SUCCESS': return 'done';
    case 'REFUNDED': return 'refunded';
    case 'FAILED': return 'failed';
    default: return 'pending';
  }
}

const FINAL = new Set(['done', 'refunded', 'failed']);

/**
 * Which intents asset a bridge deposit credited.
 *
 * Taken from the bridge's own token list, never built by hand: a record's
 * `near_token_id` is a NEP-141 contract for some tokens ("sol.omft.near")
 * and "<contract>:<token>" for multi-tokens ("v2_1.omni.hot.tg:56_2CM…",
 * USDT on BNB Chain), whose asset id is nep245. Prefixing nep141 to every
 * one silently dropped the multi-token deposits from the list.
 *
 * Matched on the NEAR-side token, not `defuse_asset_identifier`: two tokens
 * can share one origin asset -- Bitcoin has two on btc:mainnet:native -- and
 * the NEAR-side token is what tells them apart.
 */
export function depositAssetId(record, bridgeTokens = []) {
  const nearToken = String(record?.near_token_id || '');
  if (!nearToken) return null;
  const known = bridgeTokens.find((token) => (
    token.multi_token_id ? `${token.near_token_id}:${token.multi_token_id}` : token.near_token_id
  ) === nearToken);
  if (known?.intents_token_id) return known.intents_token_id;
  // Not in the list we hold: infer the standard from the id's shape.
  return nearToken.includes(':') ? `nep245:${nearToken}` : `nep141:${nearToken}`;
}

/**
 * One bridge deposit record, as a row.
 *
 * `amount` arrives as a JSON number of base units, so above 2^53 it is
 * already rounded by the time it is parsed. It is displayed to a few
 * significant digits, so the loss never shows -- but it is not exact, and
 * nothing here may treat it as a balance.
 */
export function depositEntry(record, bridgeTokens = []) {
  const decimals = Number.isInteger(record?.decimals) ? record.decimals : 18;
  let amount = '0';
  try {
    amount = formatUnits(BigInt(Math.trunc(Number(record?.amount) || 0)), decimals);
  } catch {
    amount = '0';
  }
  const status = { COMPLETED: 'done', PENDING: 'pending', FAILED: 'failed' }[record?.status] || 'pending';
  return {
    id: `deposit:${record?.tx_hash}`,
    kind: 'deposit',
    assetId: depositAssetId(record, bridgeTokens),
    title: 'Deposit',
    detail: record?.from ? `From ${shortAddress(record.from)}` : null,
    amount,
    direction: 1,
    time: Date.parse(record?.created_at) || 0,
    status,
  };
}

/**
 * A chat payment, as a row. Our own sends are settled by definition -- we
 * published them. A received one is a claim until the intent is checked.
 */
export function paymentEntry(payment) {
  const mine = Boolean(payment.my);
  return {
    id: `payment:${payment.intentHash}`,
    kind: mine ? 'sent' : 'received',
    assetId: payment.assetId,
    title: `${mine ? 'To' : 'From'} ${payment.peer || 'a contact'}`,
    detail: payment.note || null,
    amount: String(payment.amount),
    direction: mine ? -1 : 1,
    time: Number(payment.time) || 0,
    status: mine || payment.verified === 'settled' ? 'done'
      : payment.verified === 'failed' ? 'unconfirmed'
        : payment.verified === 'expired' ? 'expired' : 'checking',
    intentHash: payment.intentHash,
    // What the check compares against the verifier's record of the transfer.
    claim: {
      intentHash: payment.intentHash,
      transactionHash: payment.transactionHash || null,
      assetId: payment.assetId,
      amount: String(payment.amount),
      decimals: payment.decimals ?? null,
    },
    peerAccount: payment.peerAccount || null,
  };
}

/**
 * A swap or withdrawal, as seen from one asset. A swap belongs to two assets
 * and reads differently from each: money out of one, into the other.
 */
export function orderEntry(order, assetId) {
  const base = { id: `order:${order.id}:${assetId}`, time: order.time, status: order.status || 'pending' };
  if (order.kind === 'withdraw') {
    return {
      ...base,
      kind: 'withdraw',
      assetId: order.assetId,
      title: `Withdrawn to ${order.destinationChain || 'another network'}`,
      detail: order.destinationAddress ? `To ${shortAddress(order.destinationAddress)}` : null,
      amount: order.amount,
      direction: -1,
    };
  }
  if (assetId === order.toAssetId) {
    return {
      ...base,
      kind: 'swap',
      assetId,
      title: `Swapped from ${order.fromSymbol}`,
      detail: null,
      // What actually arrived once 1Click reports it; the quote until then.
      amount: order.amountReceived || order.amountOut,
      estimated: !order.amountReceived,
      direction: 1,
    };
  }
  return {
    ...base,
    kind: 'swap',
    assetId: order.fromAssetId,
    title: `Swapped to ${order.toSymbol}`,
    detail: null,
    amount: order.amount,
    direction: -1,
  };
}

export class IntentsActivity {
  constructor({
    fetchDeposits = fetchRecentDeposits,
    fetchOrderStatus = getSwapStatus,
    verifyClaim = verifyTransferClaim,
  } = {}) {
    this.fetchDeposits = fetchDeposits;
    this.fetchOrderStatus = fetchOrderStatus;
    this.verifyClaim = verifyClaim;
    this.getOrders = () => [];
    this.saveOrders = () => {};
    this.listPayments = () => [];
    this.claims = new Map();
  }

  configure({ getOrders, saveOrders, listPayments, fetchDeposits, fetchOrderStatus, verifyClaim } = {}) {
    if (typeof getOrders === 'function') this.getOrders = getOrders;
    if (typeof saveOrders === 'function') this.saveOrders = saveOrders;
    if (typeof listPayments === 'function') this.listPayments = listPayments;
    if (typeof fetchDeposits === 'function') this.fetchDeposits = fetchDeposits;
    if (typeof fetchOrderStatus === 'function') this.fetchOrderStatus = fetchOrderStatus;
    if (typeof verifyClaim === 'function') this.verifyClaim = verifyClaim;
  }

  /**
   * Note an order this device is about to send. Written before sending, not
   * after: a send whose outcome is unknown is exactly the one that most needs
   * a record, and 1Click can settle it later by its deposit address.
   */
  recordOrder(order) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const orders = [{ ...order, id, time: Date.now(), status: 'pending' }, ...this.getOrders()]
      .slice(0, MAX_ORDERS);
    this.saveOrders(orders);
    return id;
  }

  updateOrder(id, patch) {
    const orders = this.getOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return;
    const next = orders.slice();
    next[index] = { ...orders[index], ...patch };
    this.saveOrders(next);
  }

  /**
   * Addresses this account has withdrawn to on `blockchain`, newest first and
   * each once. Orders recorded before the chain id was kept carry only its
   * display name, so those are matched on that.
   */
  recentDestinations(blockchain, { limit = 3 } = {}) {
    const chain = String(blockchain || '').toLowerCase();
    const name = chainDisplayName(chain);
    const seen = new Set();
    const recent = [];
    for (const order of this.getOrders()) {
      if (order.kind !== 'withdraw' || !order.destinationAddress) continue;
      const onChain = order.destinationBlockchain
        ? order.destinationBlockchain === chain
        : order.destinationChain === name;
      if (!onChain || seen.has(order.destinationAddress)) continue;
      seen.add(order.destinationAddress);
      recent.push({ address: order.destinationAddress, time: order.time });
      if (recent.length >= limit) break;
    }
    return recent;
  }

  /** For an order that was never sent after all -- a quote that expired first. */
  forgetOrder(id) {
    this.saveOrders(this.getOrders().filter((order) => order.id !== id));
  }

  /** Ask 1Click where each unsettled order stands, and keep the answer. */
  async settleOrders(orders) {
    await Promise.all(orders.filter((order) => !FINAL.has(order.status) && order.depositAddress)
      .map(async (order) => {
        try {
          const response = await this.fetchOrderStatus(order.depositAddress, order.depositMemo || null);
          const status = orderStatusFrom(response?.status);
          const received = response?.swapDetails?.amountOutFormatted || null;
          if (status !== order.status || (received && status === 'done')) {
            this.updateOrder(order.id, {
              status,
              ...(received && status === 'done' ? { amountReceived: received } : {}),
            });
          }
        } catch {
          // Unreachable now is not a verdict; the next look may answer.
        }
      }));
  }

  /**
   * Everything known about one asset, newest first.
   *
   * Never throws: each source that fails is reported and the rest are still
   * shown, because a list that blanks when one service is down reads as the
   * money having gone.
   */
  async forAsset(accountId, asset) {
    const assetId = asset?.assetId;
    if (!assetId) return { entries: [], depositsUnavailable: false };

    let depositsUnavailable = false;
    const deposits = [];
    try {
      await intentsDeposits.loadBridgeTokens();
      const chain = intentsDeposits.describeDepositTarget(assetId)?.chain;
      if (chain && accountId) {
        const records = await this.fetchDeposits(accountId, chain, { limit: DEPOSIT_LIMIT });
        for (const record of records) {
          const entry = depositEntry(record, intentsDeposits.bridgeTokens);
          if (entry.assetId === assetId) deposits.push(entry);
        }
      }
    } catch (error) {
      console.warn('Deposit history unavailable:', error);
      depositsUnavailable = true;
    }

    let payments = [];
    try {
      payments = this.listPayments()
        .filter((payment) => payment?.assetId === assetId && payment.intentHash)
        .map(paymentEntry)
        .map((entry) => {
          const known = this.claims.get(entry.intentHash);
          return known ? { ...entry, status: known } : entry;
        });
    } catch (error) {
      console.warn('Payment history unavailable:', error);
    }

    const mine = this.getOrders().filter((order) => (
      order.assetId === assetId || order.fromAssetId === assetId || order.toAssetId === assetId
    ));
    await this.settleOrders(mine);
    const orders = this.getOrders()
      .filter((order) => mine.some((before) => before.id === order.id))
      // A swap that never filled delivered nothing to the asset it targeted.
      .filter((order) => !(order.toAssetId === assetId && order.status !== 'done' && order.status !== 'pending'))
      .map((order) => orderEntry(order, assetId));

    const entries = [...deposits, ...payments, ...orders].sort((a, b) => b.time - a.time);
    return { entries, depositsUnavailable };
  }

  /**
   * Check a received payment's claim. Only resting answers are remembered;
   * "pending" and "unverifiable" are asked again next time.
   */
  /** Check a received payment row: its claim against the logged transfer. */
  async verifyPayment(entry, accountId = null) {
    const intentHash = entry?.intentHash;
    const known = this.claims.get(intentHash);
    if (known) return known;
    try {
      const result = await this.verifyClaim(entry.claim || { intentHash }, {
        sentAt: entry.time,
        expectedFrom: entry.peerAccount,
        expectedTo: accountId,
      });
      const status = result?.state === 'settled' ? 'done'
        : result?.state === 'failed' ? 'unconfirmed'
          : result?.state === 'expired' ? 'expired' : 'checking';
      if (status !== 'checking') this.claims.set(intentHash, status);
      return status;
    } catch {
      return 'checking';
    }
  }
}

export const intentsActivity = new IntentsActivity();

// === Multichain wallet screens ===

// The Multichain screens: the wallet surface for balances the verifier holds
// for the account rather than on each asset's own chain.
//
// Shaped after the EVM Assets modal in evm-assets.js -- own menu entry, own
// screens, tap an asset for detail -- because that is the pattern this wallet
// already uses for assets that are not the native Liberdus balance.
//
// Receive, Withdraw and Swap are separate screens rather than panels that open
// underneath the balance. Each is a task with its own focus, and stacking them
// under a shared hero made the asset screen grow a third form every time one
// opened.
//
// Follows DESIGN.md: tokens only, the 8/16/32/48 scale, diagonal action icons
// (a chevron is an expand/collapse glyph), and no protocol nouns in product
// copy -- what the verifier is called belongs in the code, not on the screen.

// What a new account is offered first: the largest coins, each on the one
// network its chip names. Six, so they sit in two even rows of three.
//
// USDT is the one that exists on many chains, so its chip -- like every
// chip -- carries its network, and its receive screen says the same: USDT on
// Tron sent to this address is lost.
//
// The same coins head the token picker's Popular section, with a few more:
// one list, so the two screens cannot disagree about what the big coins are.
// 1Click publishes prices but no volume, so this is chosen, not computed.
const POPULAR = Object.freeze([
  'nep141:nbtc.bridge.near', // BTC, shown as Bitcoin; see DEPOSIT_CREDITS
  'nep141:eth.omft.near',
  'nep141:sol.omft.near',
  'nep141:xrp.omft.near',
  'nep245:v2_1.omni.hot.tg:56_11111111111111111111', // BNB on BNB Chain
  'nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near', // USDT on Ethereum
  'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near', // USDC on Ethereum
  'nep141:zec.omft.near',
]);
const QUICK_RECEIVE = POPULAR.slice(0, 6);

// Where a deposit to an asset's address is actually credited, when that is
// not the asset itself. Bitcoin sent to the btc:mainnet address lands as nBTC
// -- both real test deposits did, 2026-09-28 -- so receiving "BTC" must mean
// nBTC: the screen whose balance will move, and whose Activity will show it.
const DEPOSIT_CREDITS = Object.freeze({
  'nep141:btc.omft.near': 'nep141:nbtc.bridge.near',
});

/** The asset a deposit for `assetKey` will credit. */
function receivingKey(assetKey) {
  const assetId = String(assetKey || '').replace(/^intents:/, '');
  return DEPOSIT_CREDITS[assetId] ? `intents:${DEPOSIT_CREDITS[assetId]}` : assetKey;
}

/** Superseded for receiving, and a duplicate "BTC · Bitcoin" row anywhere
 *  else it is not already held. */
const isSuperseded = (asset) => Boolean(DEPOSIT_CREDITS[asset.assetId]) && asset.rawAmount === '0';

// The hero total: thousands separated, always two decimals. formatUsd has
// neither separator nor grouping, and "$12345.67" is hard to read at 44px.
const heroUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// A skeleton row stands in for an asset while the first balances load. Three
// is enough to read as "a list is coming" without promising how long it is.
const SKELETON_ROW = `
  <div class="multichain-row is-skeleton" aria-hidden="true">
    <span class="multichain-skeleton is-mark"></span>
    <span class="multichain-row-main">
      <span class="multichain-skeleton is-name"></span>
      <span class="multichain-skeleton is-sub"></span>
    </span>
    <span class="multichain-row-values">
      <span class="multichain-skeleton is-name"></span>
      <span class="multichain-skeleton is-sub"></span>
    </span>
  </div>`;

// Once an order has been published its outcome can be unknown -- a settlement
// check that throws does not mean nothing was sent. Saying so, and pointing at
// the balance, is the only honest answer; offering the button again is how a
// second copy of the same order gets sent.
export const UNCONFIRMED = 'We could not confirm this went through. Check your balance before trying again.';
const SLOW = 'This is taking longer than usual. Check your balance in a few minutes before trying again.';
const NOT_THROUGH = 'This did not go through. Check your balance before trying again.';

// A deposit lands a minute or two after it is sent, long after the balance was
// last read. Without this the screen sits on a stale zero and looks broken --
// which is exactly how it looked the first time somebody deposited to it.
const DEPOSIT_WATCH_INTERVAL_MS = 10_000;
const DEPOSIT_WATCH_TIMEOUT_MS = 10 * 60_000;

export function formatUsd(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/A';
  return `$${amount.toFixed(2)}`;
}

export const assetMark = (asset, size) => assetIconMarkup({
  symbol: asset.tokenSymbol,
  blockchain: asset.blockchain,
  contractAddress: asset.contractAddress,
}, { size, escape: escapeHtml });

/**
 * Eighteen decimals is a machine's answer, not a person's. Amounts are cut to
 * a few significant digits wherever they are read rather than typed.
 *
 * Significant rather than fixed decimals: at four decimal places 0.00008510
 * renders as 0.0000, which is not a smaller number but a wrong one.
 */
export function formatDisplayAmount(value, significant = 4) {
  const text = String(value ?? '0');
  if (!text.includes('.')) return text;
  const [whole, fraction] = text.split('.');
  if (whole !== '0') {
    const cut = fraction.slice(0, significant).replace(/0+$/, '');
    return cut ? `${whole}.${cut}` : whole;
  }
  const lead = fraction.search(/[1-9]/);
  if (lead === -1) return '0';
  const cut = fraction.slice(0, lead + significant).replace(/0+$/, '');
  return `0.${cut}`;
}

/**
 * A raw token amount as a decimal string, never via Number: at eighteen
 * decimals a fee comes back from Number as "5.6e-7", which is not a number
 * anyone can check against their wallet.
 */
function formatRawAmount(raw, decimals, significant = 4) {
  if (raw === null || raw === undefined || raw === '') return '0';
  try {
    return formatDisplayAmount(formatUnits(raw, decimals), significant);
  } catch {
    return '0';
  }
}

/**
 * What is wrong with an amount typed against a balance: '' while there is
 * nothing to judge yet, a message when it cannot be sent, null when it can.
 *
 * Checked on the device rather than left to a quote or a simulation: an
 * amount over the balance would still price, and a figure for money you do
 * not have is a promise the next screen would have to take back.
 */
export function checkAmount(asset, value) {
  const text = String(value ?? '').trim();
  // Nothing typed yet, or only the start of a decimal, is not a mistake.
  if (!asset || !text || text === '.') return '';
  let raw;
  try {
    raw = parseTokenAmount(text, asset.tokenDecimals);
  } catch (error) {
    return error.message;
  }
  if (raw <= 0n) return '';
  if (raw > BigInt(asset.rawAmount)) return `That is more than your ${asset.tokenSymbol} balance.`;
  return null;
}

export const priceOf = (asset) => {
  const price = Number(asset?.tokenPriceUsd);
  return price > 0 ? price : null;
};

/**
 * Dollars typed, as a token amount.
 *
 * Six significant digits, rounded down: short enough to read back on a
 * confirmation -- a raw quotient at nine or eighteen decimals is not -- and
 * never more than the dollars typed. Returns '' when there is nothing to use.
 */
export function usdToTokenAmount(usd, asset) {
  const price = priceOf(asset);
  const dollars = Number(usd);
  if (!price || !(dollars > 0)) return '';
  const exact = dollars / price;
  const magnitude = Math.floor(Math.log10(exact));
  const places = Math.max(0, Math.min(asset.tokenDecimals, 5 - magnitude));
  const units = Math.floor(exact * 10 ** places);
  if (units <= 0) return '';
  const text = (units / 10 ** places).toFixed(places);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

// Inline so it takes the control's colour (DESIGN.md §6).
const FLIP_ICON = '<svg class="multichain-amount-flip-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" '
  + 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/></svg>';

/**
 * An amount you can type in the token or in dollars.
 *
 * One control for every screen that spends an asset -- send and swap -- so
 * the rules below cannot drift between them:
 *
 *  - The figure under the field is the other unit, and tapping it switches.
 *  - What is spent is always a token amount. Dollars convert through
 *    usdToTokenAmount, rounded down.
 *  - A figure derived from a token amount (Max, or switching to dollars) is
 *    only a view: the exact token amount behind it is what gets spent, until
 *    the person types. Flipping 0.005 SOL to $0.59 and back must give 0.005,
 *    not a cents-rounded 0.00499153; Max must mean the whole balance.
 *  - No price, no dollars: the switch is hidden rather than guessing.
 */
export class AmountField {
  constructor({ input, currency, flip, balance, max, getAsset, onChange = () => {} }) {
    Object.assign(this, { input, currency, flip, balance, max, getAsset, onChange });
    this.unit = 'token';
    this.exactToken = null;
    input.addEventListener('input', () => {
      this.exactToken = null;
      this.changed();
    });
    flip.addEventListener('click', () => this.flipUnit());
    max.addEventListener('click', () => this.fillMax());
  }

  reset() {
    this.unit = 'token';
    this.exactToken = null;
    this.input.value = '';
    this.render();
  }

  /** A new asset: typed dollars stay put and convert at the new price. */
  assetChanged() {
    this.exactToken = null;
    this.changed();
  }

  changed() {
    this.render();
    this.onChange();
  }

  /**
   * The token amount this field describes, whichever unit it is typed in.
   * '' when nothing is typed; null when what is typed cannot be read.
   */
  tokenAmount() {
    const asset = this.getAsset();
    if (!asset) return '';
    if (this.exactToken !== null) return this.exactToken;
    const text = this.input.value.trim();
    if (this.unit === 'token') return text;
    if (!/^\d*\.?\d*$/.test(text)) return null;
    return usdToTokenAmount(text, asset);
  }

  /** '' while there is nothing to judge, a message when it cannot be spent, null when it can. */
  problem() {
    const asset = this.getAsset();
    const amount = this.tokenAmount();
    if (amount === null) return 'Enter an amount using digits only';
    if (this.unit === 'usd' && asset && Number(this.input.value) > 0 && !amount) {
      return `That is less than the smallest amount of ${asset.tokenSymbol} you can use.`;
    }
    return checkAmount(asset, amount);
  }

  fillMax() {
    const asset = this.getAsset();
    if (!asset) return;
    this.exactToken = asset.tokenAmount;
    this.input.value = this.unit === 'usd'
      ? (Number(asset.tokenAmount) * priceOf(asset)).toFixed(2)
      : asset.tokenAmount;
    this.changed();
  }

  flipUnit() {
    const price = priceOf(this.getAsset());
    if (!price) return;
    const amount = this.tokenAmount();
    if (this.unit === 'token') {
      this.unit = 'usd';
      this.input.value = Number(amount) > 0 ? (Number(amount) * price).toFixed(2) : '';
      // The dollars shown are rounded; what is spent stays what was typed.
      this.exactToken = Number(amount) > 0 ? amount : null;
    } else {
      this.unit = 'token';
      this.input.value = amount || '';
      this.exactToken = null;
    }
    this.changed();
    this.input.focus({ preventScroll: true });
  }

  setLocked(locked) {
    for (const control of [this.input, this.max, this.flip]) control.disabled = locked;
  }

  render() {
    const asset = this.getAsset();
    const price = priceOf(asset);
    if (!price && this.unit === 'usd') {
      this.unit = 'token';
      this.exactToken = null;
    }
    const inUsd = this.unit === 'usd';
    this.currency.hidden = !inUsd;
    this.input.placeholder = inUsd ? '0.00' : '0';

    // In the unit being typed, so what you can afford reads without converting.
    this.balance.textContent = !asset ? ''
      : inUsd ? `Balance ${formatUsd(Number(asset.tokenAmount) * price)}`
        : `Balance ${formatDisplayAmount(asset.tokenAmount, 6)}`;

    this.flip.hidden = !price;
    if (!price || !asset) return;
    const amount = this.tokenAmount();
    const value = Number(amount);
    const other = inUsd
      ? (value > 0 ? `≈ ${formatDisplayAmount(amount, 6)} ${asset.tokenSymbol}` : `Enter in ${asset.tokenSymbol}`)
      : (value > 0 ? `≈ ${formatUsd(value * price)}` : 'Enter in USD');
    this.flip.innerHTML = `<span>${escapeHtml(other)}</span>${FLIP_ICON}`;
    this.flip.setAttribute('aria-label', `Enter the amount in ${inUsd ? asset.tokenSymbol : 'US dollars'}`);
  }
}

// Where a screen shows a sum -- send, fee, receive -- four digits is not
// enough for it to add up; see the withdrawal's confirm screen.
const CONFIRM_DIGITS = 6;

/**
 * The fee as the difference between two figures already cut for display, so
 * the three lines add up exactly. Falls back to the fee itself if either
 * figure cannot be read.
 */
export function feeShown(send, receive, decimals, rawFee) {
  try {
    const difference = parseTokenAmount(send, decimals) - parseTokenAmount(receive, decimals);
    if (difference >= 0n) return formatDisplayAmount(formatUnits(difference, decimals), CONFIRM_DIGITS);
  } catch {
    // Not a readable pair; show what 1Click said instead.
  }
  return formatRawAmount(rawFee, decimals, CONFIRM_DIGITS);
}

/** Head and tail are what anyone checks; the middle is what can go. */
function truncateAddress(address) {
  const text = String(address ?? '');
  return text.length <= 24 ? text : `${text.slice(0, 10)}…${text.slice(-8)}`;
}

/** "SOL (Solana)" -- the title says both, so no screen repeats it underneath. */
function assetTitle(asset) {
  return asset.chainName ? `${asset.tokenSymbol} (${asset.chainName})` : asset.tokenSymbol;
}

class MultichainModal {
  constructor(controller) {
    this.controller = controller;
  }

  load() {
    this.modal = document.getElementById('multichainModal');
    this.totalBalance = document.getElementById('multichainTotalBalance');
    this.caption = document.getElementById('multichainHeroCaption');
    this.refreshButton = document.getElementById('refreshMultichainBalance');
    this.assetsList = document.getElementById('multichainAssetsList');
    this.statusLine = document.getElementById('multichainStatus');
    this.receiveButton = document.getElementById('multichainReceiveAny');
    this.receiveButton.addEventListener('click', () => this.controller.startDeposit());
    this.sendButton = document.getElementById('multichainSendAny');
    // No asset chosen: the send screen starts on the largest holding.
    this.sendButton.addEventListener('click', () => this.controller.onSend(null));
    this.listHead = document.getElementById('multichainListHead');
    this.hideEmpty = document.getElementById('multichainHideEmpty');
    this.hideEmpty.addEventListener('change', () => {
      this.controller.updateSettings({ hideEmpty: this.hideEmpty.checked });
      this.render();
    });
    this.empty = document.getElementById('multichainEmpty');
    this.quick = document.getElementById('multichainQuick');
    this.quick.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-asset-key]');
      if (chip) this.controller.receiveModal.open(chip.dataset.assetKey);
    });

    document.getElementById('closeMultichainModal')
      .addEventListener('click', () => this.close());

    this.assetsList.addEventListener('click', (event) => {
      const button = event.target.closest('.multichain-asset-button');
      if (!button) return;
      this.controller.assetModal.open(button.dataset.assetKey);
    });

    this.refreshButton.addEventListener('click', withButtonCooldown(
      this.refreshButton,
      BUTTON_COOLDOWN_MS,
      null,
      async () => {
        this.refreshButton.classList.add('active');
        setTimeout(() => this.refreshButton.classList.remove('active'), 300);
        await this.update({ force: true });
      },
    ));
  }

  async open() {
    openModal(this.modal);
    await this.update();
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  /**
   * Balances already read are shown at once and refreshed behind a spinning
   * icon; only a first read, with nothing to show, gets the skeleton. A
   * screen that blanks itself on every refresh reads as losing your money.
   */
  async update({ force = false } = {}) {
    if (intentsAssets.getStatus() === 'connected') this.render();
    else this.renderLoading();
    this.setRefreshing(true);
    try {
      await this.controller.refresh({ force });
    } finally {
      this.setRefreshing(false);
    }
    this.render();
    this.controller.updateSummary();
  }

  setRefreshing(on) {
    this.refreshButton.classList.toggle('is-loading', on);
    this.refreshButton.setAttribute('aria-busy', String(on));
  }

  renderLoading() {
    this.totalBalance.innerHTML = '<span class="multichain-skeleton is-figure" aria-hidden="true"></span>';
    this.totalBalance.setAttribute('aria-label', 'Loading balance');
    this.caption.innerHTML = '<span class="multichain-skeleton is-caption" aria-hidden="true"></span>';
    this.statusLine.textContent = '';
    this.listHead.hidden = true;
    this.empty.hidden = true;
    this.assetsList.hidden = false;
    this.assetsList.setAttribute('aria-busy', 'true');
    this.assetsList.innerHTML = SKELETON_ROW.repeat(3);
    // Nothing is known to be held yet.
    this.sendButton.disabled = true;
  }

  render() {
    const network = intentsAssets.getNetwork();
    const status = intentsAssets.getStatus();
    const held = network.assets.filter((asset) => asset.rawAmount !== '0');

    this.totalBalance.removeAttribute('aria-label');
    this.assetsList.removeAttribute('aria-busy');
    // Nothing read is not the same as nothing held: $0.00 would claim a balance.
    const total = Number(network.totalValueUsd);
    this.totalBalance.textContent = status === 'unavailable' && network.assets.length === 0
      ? '—'
      : heroUsd.format(Number.isFinite(total) ? total : 0);
    // Says where the money actually is, which a bare total does not. Silent
    // when nothing is held: the empty balance already says it.
    const chains = [...new Set(held.map((asset) => asset.chainName))];
    this.caption.textContent = chains.length > 1
      ? `Across ${chains.length} networks`
      : chains.length === 1 ? `On ${chains[0]}` : '';
    // Only a problem earns this line (DESIGN.md §1.2); custody is a standing
    // fact, and lives in the footnote under the list.
    this.statusLine.textContent = status === 'unavailable'
      ? 'Balances are unavailable right now. Refresh to try again.'
      : '';
    this.sendButton.disabled = held.length === 0;

    // The list is what you hold, plus what you held before and spent to zero.
    // "Hide empty" drops those; the switch only appears when there are any.
    const { hideEmpty } = this.controller.settings();
    const zeros = network.assets.filter((asset) => asset.rawAmount === '0');
    const visible = hideEmpty ? held : network.assets;
    this.listHead.hidden = zeros.length === 0;
    this.hideEmpty.checked = hideEmpty;

    // Nothing held: the way to start, not a list of zeros. Only when the
    // balances were actually read -- "nothing here" is a claim.
    this.empty.hidden = !(status === 'connected' && held.length === 0 && visible.length === 0);
    if (!this.empty.hidden) this.renderQuickReceive();

    this.assetsList.hidden = visible.length === 0;
    if (visible.length === 0) {
      this.assetsList.replaceChildren();
      return;
    }

    this.assetsList.innerHTML = visible.map((asset) => `
      <button
        type="button"
        class="multichain-row multichain-asset-button${asset.rawAmount === '0' ? ' is-empty' : ''}"
        data-asset-key="${escapeHtml(asset.key)}"
        aria-label="${escapeHtml(assetTitle(asset))}"
      >
        ${assetMark(asset, 40)}
        <span class="multichain-row-main">
          <span class="multichain-row-name">${escapeHtml(asset.tokenSymbol)}</span>
          <span class="multichain-row-chain">${escapeHtml(asset.chainName)}</span>
        </span>
        <span class="multichain-row-values">
          <span class="multichain-row-amount">${escapeHtml(formatDisplayAmount(asset.tokenAmount))}</span>
          <span class="multichain-row-usd">${escapeHtml(
            asset.tokenValueUsd === null ? 'Unpriced' : formatUsd(asset.tokenValueUsd),
          )}</span>
        </span>
      </button>
    `).join('');
  }

  /** The coins a new account is offered first, each one tap from its address. */
  renderQuickReceive() {
    const assets = QUICK_RECEIVE
      .map((assetId) => intentsAssets.getCatalogAsset(`intents:${assetId}`))
      .filter(Boolean);
    this.quick.innerHTML = assets.map((asset) => `
      <button type="button" class="multichain-quick-chip" data-asset-key="${escapeHtml(asset.key)}"
        aria-label="Receive ${escapeHtml(assetTitle(asset))}">
        ${assetMark(asset, 32)}
        <span class="multichain-quick-symbol">${escapeHtml(asset.tokenSymbol)}</span>
        <span class="multichain-quick-network">${escapeHtml(asset.chainName)}</span>
      </button>`).join('');
  }
}

// Which glyph a row carries: money in, money out to a person, money out to
// another chain, or a swap.
const ACTIVITY_ICON = { deposit: 'in', received: 'in', sent: 'send', withdraw: 'out', swap: 'swap' };

// Only states that need saying. A finished entry says nothing (DESIGN.md §1.2).
const ACTIVITY_STATUS = {
  pending: 'Pending',
  checking: 'Checking…',
  failed: 'Failed',
  refunded: 'Refunded',
  unconfirmed: 'Not confirmed',
  expired: 'Too old to check',
};

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const yearFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "Sep 23". */
export function activityTime(ms, now = Date.now()) {
  if (!ms) return '';
  const seconds = Math.max(0, (now - ms) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  const then = new Date(ms);
  const today = new Date(now);
  const sameDay = then.toDateString() === today.toDateString();
  if (sameDay) return `${Math.floor(seconds / 3600)} h ago`;
  const yesterday = new Date(now - 86_400_000);
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return then.getFullYear() === today.getFullYear() ? dayFormat.format(then) : yearFormat.format(then);
}

class MultichainAssetModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
  }

  load() {
    this.modal = document.getElementById('multichainAssetModal');
    this.title = document.getElementById('multichainAssetTitle');
    this.icon = document.getElementById('multichainAssetIcon');
    this.amount = document.getElementById('multichainAssetAmount');
    this.value = document.getElementById('multichainAssetValue');
    this.receiveButton = document.getElementById('multichainAssetReceive');
    this.sendButton = document.getElementById('multichainAssetSend');
    this.withdrawButton = document.getElementById('multichainAssetWithdraw');
    this.swapButton = document.getElementById('multichainAssetSwap');
    this.activity = document.getElementById('multichainAssetActivity');
    // Each load takes a number; an answer for an asset no longer on screen,
    // or superseded by a newer load, is dropped.
    this.activitySeq = 0;
    this.activityKey = null;

    document.getElementById('closeMultichainAssetModal')
      .addEventListener('click', () => this.close());
    this.receiveButton.addEventListener('click', () => this.controller.receiveModal.open(this.assetKey));
    this.sendButton.addEventListener('click', () => this.controller.onSend(this.assetKey));
    this.withdrawButton.addEventListener('click', () => this.controller.withdrawModal.open(this.assetKey));
    this.swapButton.addEventListener('click', () => this.controller.swapModal.open(this.assetKey));
  }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.render();
    openModal(this.modal);
    void this.loadActivity();
  }

  /**
   * Fill the activity list. A first look shows skeleton rows; a reload of
   * the same asset keeps what is on screen until the new answer lands.
   */
  async loadActivity() {
    const asset = intentsAssets.getAsset(this.assetKey);
    if (!asset) return;
    const seq = ++this.activitySeq;
    if (this.activityKey !== this.assetKey) {
      this.activity.setAttribute('aria-busy', 'true');
      this.activity.innerHTML = `<div class="multichain-list">${SKELETON_ROW.repeat(2)}</div>`;
    }
    this.activityKey = this.assetKey;

    const { entries, depositsUnavailable } = await intentsActivity.forAsset(intentsAssets.getAccountId(), asset);
    if (seq !== this.activitySeq) return;
    this.activity.removeAttribute('aria-busy');
    this.renderActivity(entries, depositsUnavailable, asset);

    // A received payment is a claim until checked; check the ones on screen
    // and update their rows in place.
    for (const entry of entries) {
      if (entry.status !== 'checking' || !entry.intentHash) continue;
      intentsActivity.verifyPayment(entry, intentsAssets.getAccountId()).then((status) => {
        if (seq !== this.activitySeq) return;
        const row = [...this.activity.querySelectorAll('[data-entry-id]')]
          .find((element) => element.dataset.entryId === entry.id);
        if (row) this.renderActivityStatus(row, status);
      });
    }
  }

  renderActivity(entries, depositsUnavailable, asset) {
    // "No activity" would be a claim when deposits could not be read.
    const unavailable = depositsUnavailable
      ? '<p class="multichain-activity-note">Deposits could not be checked right now.</p>'
      : '';
    if (!entries.length) {
      this.activity.innerHTML = unavailable || '<p class="multichain-activity-note">No activity yet</p>';
      return;
    }
    this.activity.innerHTML = `<div class="multichain-list">${entries.map((entry) => {
      const when = activityTime(entry.time);
      const sub = [when, entry.detail].filter(Boolean).join(' · ');
      const sign = entry.direction < 0 ? '−' : '+';
      // No symbol: every row on this screen is in the asset the title names,
      // and repeating it down the list costs the room the row titles need.
      const amount = `${sign}${entry.estimated ? '≈' : ''}${formatDisplayAmount(entry.amount)}`;
      return `
        <div class="multichain-row is-static" data-entry-id="${escapeHtml(entry.id)}" data-status="${escapeHtml(entry.status)}">
          <span class="multichain-activity-icon" data-icon="${ACTIVITY_ICON[entry.kind] || 'in'}" aria-hidden="true"></span>
          <span class="multichain-row-main">
            <span class="multichain-row-name">${escapeHtml(entry.title)}</span>
            ${sub ? `<span class="multichain-row-chain">${escapeHtml(sub)}</span>` : ''}
          </span>
          <span class="multichain-row-values">
            <span class="multichain-row-amount" title="${escapeHtml(`${entry.amount} ${asset.tokenSymbol}`)}">${escapeHtml(amount)}</span>
            <span class="multichain-activity-status">${escapeHtml(ACTIVITY_STATUS[entry.status] || '')}</span>
          </span>
        </div>`;
    }).join('')}</div>${unavailable}`;
  }

  renderActivityStatus(row, status) {
    row.dataset.status = status;
    const label = row.querySelector('.multichain-activity-status');
    if (label) label.textContent = ACTIVITY_STATUS[status] || '';
  }

  render() {
    const asset = intentsAssets.getAsset(this.assetKey);
    if (!asset) return;
    // The title carries symbol and chain, so the body never repeats them.
    this.title.textContent = assetTitle(asset);
    this.icon.innerHTML = assetMark(asset, 64);
    this.amount.textContent = `${formatDisplayAmount(asset.tokenAmount)} ${asset.tokenSymbol}`;
    this.value.textContent = asset.tokenValueUsd === null
      ? 'No price available'
      : formatUsd(asset.tokenValueUsd);
    // Nothing to send is not a state worth offering a form for.
    this.sendButton.disabled = asset.rawAmount === '0';
    this.withdrawButton.disabled = asset.rawAmount === '0';
    this.swapButton.disabled = asset.rawAmount === '0';
  }

  close() {
    this.modal.classList.remove('active');
    this.controller.assetsModal.render();
    this.controller.updateSummary();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * Receive: the deposit address is the whole screen.
 *
 * Watches the balance while it is open, because a deposit lands a minute or
 * two after it is sent and a screen that never updates reads as broken.
 */
class MultichainReceiveModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
    this.watchTimer = null;
    this.watchUntil = 0;
  }

  load() {
    this.modal = document.getElementById('multichainReceiveModal');
    this.title = document.getElementById('multichainReceiveTitle');
    this.body = document.getElementById('multichainReceiveBody');
    document.getElementById('closeMultichainReceiveModal')
      .addEventListener('click', () => this.close());
  }

  async open(requestedKey) {
    // Where the deposit will actually land -- the screen must describe that
    // asset, not the one that was tapped.
    const assetKey = receivingKey(requestedKey);
    // From the catalog, not the portfolio: receiving is how an asset you do
    // not hold yet becomes one you do.
    const asset = intentsAssets.getCatalogAsset(assetKey);
    const accountId = intentsAssets.getAccountId();
    if (!asset || !accountId) return;

    this.assetKey = assetKey;
    this.title.textContent = `Receive ${assetTitle(asset)}`;
    this.body.innerHTML = '<div class="multichain-quote-working">Getting your deposit address…</div>';
    this.stopWatching();
    openModal(this.modal);

    try {
      const target = await intentsDeposits.requestDepositTarget(accountId, asset.assetId);
      this.render(target, asset);
      this.startWatching(asset);
    } catch (error) {
      console.warn('Deposit address unavailable:', error);
      this.body.innerHTML =
        `<div class="multichain-quote-error">${escapeHtml(error.message || 'Could not get a deposit address right now.')}</div>`;
    }
  }

  /**
   * The minimum is the headline because it is the rule people break: a
   * deposit under it is never credited, and as a line in a list of warnings it
   * read as small print.
   */
  render(target, asset) {
    // On a memo chain the QR carries the bare address: a payment URI that drops
    // the memo would scan cleanly and lose the deposit.
    const uri = target.memo ? null : depositUri(target.chain, target.address);
    const name = target.assetName || asset.tokenSymbol;
    const hasMinimum = target.minDepositRaw && target.minDepositRaw !== '0';
    // Exact, never through formatDisplayAmount: cutting digits off a minimum
    // shows a smaller number than the bridge will accept, and a deposit of
    // that size is lost.
    const headline = hasMinimum
      ? `Send at least ${escapeHtml(target.minDeposit)} ${escapeHtml(name)}`
      : `Send any amount of ${escapeHtml(name)}`;
    const minimumUsd = hasMinimum && asset.tokenPriceUsd
      ? Number(target.minDeposit) * Number(asset.tokenPriceUsd)
      : null;
    // A value under a cent would print as $0.00, which says the minimum is
    // nothing; better to say nothing.
    const sub = minimumUsd !== null && minimumUsd >= 0.01 ? `about ${formatUsd(minimumUsd)}` : '';

    const rules = [
      `Send only <strong>${escapeHtml(name)}</strong> on <strong>${escapeHtml(target.chainName)}</strong>. Other assets or networks are lost.`,
    ];
    if (target.memo) {
      rules.unshift('Include the memo. A deposit without it is lost.');
    }
    // Known now for the assets in DEPOSIT_CREDITS; still a live question for
    // any other network carrying two tokens under one name.
    const knownDestination = Object.values(DEPOSIT_CREDITS).includes(asset.assetId);
    if (target.siblings > 0 && !knownDestination) {
      rules.push(`This network carries more than one ${escapeHtml(name)} token; check your balance after the first deposit.`);
    }

    this.body.innerHTML = `
      <div class="multichain-deposit-headline">
        <div class="multichain-deposit-minimum">${headline}</div>
        ${sub ? `<div class="multichain-deposit-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
      <div class="multichain-qr" id="multichainDepositQr"></div>
      ${this.copyPill('Address', target.address, truncateAddress(target.address))}
      ${target.memo ? this.copyPill('Memo', target.memo, target.memo) : ''}
      <ul class="multichain-rules">
        ${rules.map((rule) => `<li>${rule}</li>`).join('')}
      </ul>
    `;
    this.renderQr(uri || target.address);

    this.body.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', () => this.copyValue(button));
    });
  }

  /** A value to read and copy. The memo gets the same control as the
   *  address: losing either loses the deposit. */
  copyPill(label, value, shown) {
    return `
      <button type="button" class="multichain-address" data-copy="${escapeHtml(value)}"
        aria-label="Copy ${escapeHtml(label.toLowerCase())} ${escapeHtml(value)}">
        <span class="multichain-address-label">${escapeHtml(label)}</span>
        <span class="multichain-address-value">${escapeHtml(shown)}</span>
        <span class="multichain-address-copy">Copy</span>
      </button>`;
  }

  /** The whole pill is the target: a small icon next to a long string is a
   *  harder thing to hit than the string itself. */
  async copyValue(button) {
    const label = button.querySelector('.multichain-address-copy');
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = 'Copy'; }, 2000);
    } catch (error) {
      console.warn('Could not copy:', error);
      label.textContent = 'Press and hold to copy';
    }
  }

  renderQr(text) {
    const container = document.getElementById('multichainDepositQr');
    if (!container) return;
    try {
      const gifBytes = globalThis.qr.encodeQR(text, 'gif', { scale: 4 });
      const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
      const img = document.createElement('img');
      img.src = `data:image/gif;base64,${base64}`;
      img.alt = 'Deposit address QR code';
      // Left at its natural size: forcing a width puts module edges on
      // fractional pixels, and the module count changes with the payload.
      container.appendChild(img);
    } catch (error) {
      console.error('Failed to render deposit QR:', error);
      container.textContent = 'QR unavailable';
    }
  }

  startWatching(asset) {
    this.stopWatching();
    const startingAmount = asset.rawAmount;
    const assetKey = this.assetKey;
    this.watchUntil = Date.now() + DEPOSIT_WATCH_TIMEOUT_MS;

    this.watchTimer = setInterval(async () => {
      if (!this.isActive() || this.assetKey !== assetKey || Date.now() > this.watchUntil) {
        this.stopWatching();
        return;
      }
      try {
        await intentsAssets.refresh({ force: true });
      } catch {
        return; // A failed poll is not worth reporting; the next one may work.
      }
      const current = intentsAssets.getCatalogAsset(assetKey);
      if (!current || current.rawAmount === startingAmount) return;

      this.stopWatching();
      const banner = document.createElement('div');
      banner.className = 'multichain-arrived';
      banner.textContent =
        `Received. Your ${current.tokenSymbol} balance is now ${formatDisplayAmount(current.tokenAmount, 6)}.`;
      this.body.prepend(banner);
      this.controller.assetModal.render();
      if (this.controller.assetModal.isActive()) void this.controller.assetModal.loadActivity();
      this.controller.assetsModal.render();
      this.controller.updateSummary();
    }, DEPOSIT_WATCH_INTERVAL_MS);
  }

  stopWatching() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  close() {
    this.stopWatching();
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * The confirmation, on its own screen.
 *
 * Shared by withdraw and swap: both end with the same question -- here are the
 * figures, do it or go back. Putting it under the form meant the numbers and
 * the fields that produced them were on screen together, and editing a field
 * left a quote describing a different transaction just below it.
 */
class MultichainConfirmModal {
  constructor(controller) {
    this.controller = controller;
    this.run = null;
  }

  load() {
    this.modal = document.getElementById('multichainConfirmModal');
    this.title = document.getElementById('multichainConfirmTitle');
    this.hero = document.getElementById('multichainConfirmHero');
    this.rows = document.getElementById('multichainConfirmRows');
    this.action = document.getElementById('multichainConfirmAction');
    this.note = document.getElementById('multichainConfirmNote');
    this.status = document.getElementById('multichainConfirmStatus');

    document.getElementById('closeMultichainConfirmModal')
      .addEventListener('click', () => this.close());
    this.action.addEventListener('click', () => this.confirm());
  }

  open({ title, hero, rows, actionLabel, note, run }) {
    // Each opening is a session. An order's payout can resolve minutes later,
    // after this sheet was left or reopened for something else; only the
    // session that started it may still write to it.
    this.session = (this.session || 0) + 1;
    this.run = run;
    this.done = false;
    this.title.textContent = title;
    this.hero.innerHTML = hero;
    this.rows.innerHTML = rows.map(([label, value, emphasis]) => `
      <dt>${escapeHtml(label)}</dt>
      <dd${emphasis ? ' class="is-guaranteed"' : ''}>${escapeHtml(String(value))}</dd>
    `).join('');
    this.action.textContent = actionLabel;
    this.action.classList.replace('btn--secondary', 'btn--primary');
    this.action.disabled = false;
    this.note.textContent = note || '';
    this.status.hidden = true;
    this.status.textContent = '';
    this.show();
  }

  /**
   * openModal ignores a request while another modal is still transitioning,
   * and this screen is opened programmatically the moment a quote lands -- so
   * a refusal has to be retried rather than silently dropping the screen the
   * person is waiting for.
   */
  show(attempt = 0) {
    if (openModal(this.modal) || this.modal.classList.contains('active')) return;
    // Long enough to outlast openModal's lock, which falls back to 1s when a
    // slide-in's transitionend never fires. Shorter, and a quick Review
    // press on a screen still sliding in would show nothing at all.
    if (attempt >= 20) {
      console.warn('Confirmation screen could not be opened');
      return;
    }
    setTimeout(() => this.show(attempt + 1), 60);
  }

  setStatus(message, kind = '') {
    this.status.hidden = false;
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  /**
   * The move is over, one way or another. From here the button only leaves:
   * nothing on this screen may be able to send the same thing twice.
   */
  finish(message, kind = '') {
    this.done = true;
    this.run = null;
    // "This cannot be undone" describes a decision that has now been made.
    this.note.textContent = '';
    this.setStatus(message, kind);
    this.action.textContent = 'Done';
    // Leaving is not a consequential action, so it is not blue.
    this.action.classList.replace('btn--primary', 'btn--secondary');
    this.action.disabled = false;
  }

  async confirm() {
    if (this.done) {
      this.controller.finishMove();
      return;
    }
    if (!this.run) return;
    this.action.disabled = true;
    try {
      await this.run(this);
    } catch (error) {
      // A finished sheet has already said what happened; a failed balance
      // refresh afterwards must not replace that with an error and a retry.
      if (this.done) {
        console.warn('After the move:', error);
        return;
      }
      this.setStatus(error.message || 'That did not go through.', 'error');
      this.action.disabled = false;
    }
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  /** Whether this sheet is still on screen for the session given. */
  shows(session) {
    return this.session === session && this.isActive();
  }
}

// Long enough that a number being typed is not priced at every digit, short
// enough that the estimate reads as following the typing.
const ESTIMATE_DELAY_MS = 400;

/**
 * Withdraw: where to, how much, and what arrives -- live as you type, like
 * Swap and Send.
 *
 * Where is one panel: the network, when the symbol lives on several chains,
 * and the address on it. None is chosen for you. An address cannot tell EVM
 * chains apart, so a default would be a guess about where money goes.
 *
 * The estimate is a dry quote, which is free, and it waits until the address
 * fits the chain: a quote for an address that cannot receive is a number
 * describing nothing.
 */
class MultichainWithdrawModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
    this.destinationKey = null;
    this.estimateTimer = null;
    // A reply that is not the latest request's is dropped; see the swap.
    this.estimateSeq = 0;
    // What Review was pressed on: the amount in tokens (the field may show
    // dollars), the address, and the chain. The confirm screen spends this,
    // whatever the form behind it says by then.
    this.reviewed = null;
  }

  load() {
    this.modal = document.getElementById('multichainWithdrawModal');
    this.title = document.getElementById('multichainWithdrawTitle');
    this.networks = document.getElementById('multichainWithdrawNetworks');
    this.to = document.getElementById('multichainWithdrawTo');
    this.toNote = document.getElementById('multichainWithdrawToNote');
    this.recent = document.getElementById('multichainWithdrawRecent');
    this.token = document.getElementById('multichainWithdrawToken');
    this.amountField = new AmountField({
      input: document.getElementById('multichainWithdrawAmount'),
      currency: document.getElementById('multichainWithdrawCurrency'),
      flip: document.getElementById('multichainWithdrawFlip'),
      balance: document.getElementById('multichainWithdrawAvailable'),
      max: document.getElementById('multichainWithdrawMax'),
      getAsset: () => this.asset(),
      onChange: () => this.scheduleEstimate(),
    });
    this.out = document.getElementById('multichainWithdrawOut');
    this.outToken = document.getElementById('multichainWithdrawOutToken');
    this.outUsd = document.getElementById('multichainWithdrawOutUsd');
    this.outChain = document.getElementById('multichainWithdrawOutChain');
    this.fee = document.getElementById('multichainWithdrawFee');
    this.previewButton = document.getElementById('multichainWithdrawPreview');
    this.status = document.getElementById('multichainWithdrawStatus');

    document.getElementById('closeMultichainWithdrawModal')
      .addEventListener('click', () => this.close());
    this.previewButton.addEventListener('click', () => this.preview());
    this.networks.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-asset-key]');
      if (chip) this.chooseDestination(chip.dataset.assetKey);
    });
    // One line of text: Enter is not part of an address.
    this.to.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') event.preventDefault();
    });
    this.to.addEventListener('input', () => {
      this.fitAddress();
      // A paste arrives whole, so it is judged at once; typing is judged
      // when the field is left, rather than calling every prefix wrong.
      const length = this.to.value.length;
      if (Math.abs(length - this.lastAddressLength) > 1) this.addressJudged = true;
      this.lastAddressLength = length;
      this.scheduleEstimate();
    });
    this.recent.addEventListener('click', (event) => {
      const row = event.target.closest('[data-address]');
      if (!row) return;
      this.to.value = row.dataset.address;
      this.fitAddress();
      this.lastAddressLength = this.to.value.length;
      this.addressJudged = true;
      this.scheduleEstimate();
      // The address is settled; the amount is next.
      this.amountField.input.focus({ preventScroll: true });
    });
    this.to.addEventListener('blur', () => {
      if (!this.to.value.trim()) return;
      this.addressJudged = true;
      this.renderAddressNote();
    });
  }

  asset() { return intentsAssets.getAsset(this.assetKey); }

  /** As tall as the address it holds. */
  fitAddress() {
    this.to.style.height = 'auto';
    if (this.to.value) this.to.style.height = `${this.to.scrollHeight}px`;
  }

  /** Where this symbol can land. One chain means no question to ask. */
  destinations() {
    const asset = this.asset();
    if (!asset) return [];
    return intentsAssets.listCatalogAssets()
      .filter((candidate) => candidate.tokenSymbol === asset.tokenSymbol);
  }

  choosing() { return this.destinations().length > 1; }

  /** The asset paid out, or null for "the one held" -- which the service reads the same way. */
  destinationAsset() {
    return this.destinations().find((asset) => asset.key === this.destinationKey) || null;
  }

  /** The chain the payout lands on; null while there is a choice not yet made. */
  destinationChain() {
    if (this.choosing() && !this.destinationAsset()) return null;
    return (this.destinationAsset() || this.asset())?.blockchain || null;
  }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.destinationKey = null;
    this.title.textContent = `Withdraw ${asset.tokenSymbol}`;
    this.token.innerHTML = `${assetMark(asset, 24)}<span>${escapeHtml(asset.tokenSymbol)}</span>`;
    this.clearForm();
    this.renderNetworks();
    openModal(this.modal);
    // With a network to choose, that comes first; otherwise the address. A
    // modal is still off-screen when this runs (DESIGN.md §6).
    if (!this.choosing()) setTimeout(() => this.to.focus({ preventScroll: true }), 350);
  }

  chooseDestination(key) {
    this.destinationKey = key;
    this.renderNetworks();
    this.scheduleEstimate();
    this.to.focus({ preventScroll: true });
  }

  renderNetworks() {
    const choosing = this.choosing();
    this.networks.hidden = !choosing;
    this.networks.innerHTML = choosing ? this.destinations().map((candidate) => {
      // The chain the payout lands on, never a display name borrowed from
      // elsewhere: nBTC is "Bitcoin" in lists, but as a destination it pays
      // out on NEAR, and this is where that difference matters.
      const name = chainDisplayName(candidate.blockchain);
      const chosen = candidate.key === this.destinationKey;
      return `<button type="button" class="multichain-network-chip" role="radio"
        aria-checked="${chosen}" data-asset-key="${escapeHtml(candidate.key)}">
        ${chainIconMarkup(candidate.blockchain, { name, size: 20, escape: escapeHtml })}
        <span>${escapeHtml(name)}</span>
      </button>`;
    }).join('') : '';

    const chain = this.destinationChain();
    // Disabled rather than hidden: it is the next thing, once a network is picked.
    this.to.disabled = !chain;
    this.to.placeholder = chain ? `${chainDisplayName(chain)} address` : 'Choose a network first';
    const out = this.destinationAsset() || this.asset();
    this.outToken.innerHTML = out ? `${assetMark(out, 24)}<span>${escapeHtml(out.tokenSymbol)}</span>` : '';
    this.outChain.textContent = chain ? `on ${chainDisplayName(chain)}` : '';
    this.renderAddressNote();
    this.renderRecent();
  }

  /**
   * Where this account has withdrawn to on the chosen chain, while the field
   * is empty. An address that no longer passes the check is left out rather
   * than offered.
   */
  renderRecent() {
    const chain = this.destinationChain();
    const recent = chain && !this.to.value.trim()
      ? intentsActivity.recentDestinations(chain).filter(({ address }) => checkAddress(chain, address) === null)
      : [];
    this.recent.innerHTML = recent.length ? `
      <div class="multichain-recent-title">Recent</div>
      ${recent.map(({ address, time }) => `
        <button type="button" class="multichain-recent-row" data-address="${escapeHtml(address)}"
          aria-label="Use ${escapeHtml(address)}">
          <span class="multichain-recent-address">${escapeHtml(truncateAddress(address))}</span>
          <span class="multichain-recent-time">${escapeHtml(activityTime(time))}</span>
        </button>`).join('')}` : '';
  }

  /** '' while there is nothing to judge, a sentence when it cannot receive, null when it can. */
  addressProblem() {
    const chain = this.destinationChain();
    return chain ? checkAddress(chain, this.to.value) : '';
  }

  /**
   * One line under the address: what is wrong with it, or, on chains where
   * exchanges expect a tag this cannot send, the warning about that.
   */
  renderAddressNote(message = null) {
    const problem = message ?? (this.addressJudged ? this.addressProblem() : null);
    const tag = tagNeededBy(this.destinationChain());
    if (problem) {
      this.toNote.textContent = problem;
      this.toNote.dataset.kind = 'error';
    } else if (tag) {
      this.toNote.textContent = `Exchanges often need a ${tag} for ${chainDisplayName(this.destinationChain())}, `
        + 'and a withdrawal cannot include one. Send to a wallet you control.';
      this.toNote.dataset.kind = 'warning';
    } else {
      this.toNote.textContent = '';
      delete this.toNote.dataset.kind;
    }
  }

  /** Back to "nothing estimated": the figures on screen must never describe
   *  a different withdrawal from the one in the fields. */
  resetEstimate() {
    clearTimeout(this.estimateTimer);
    this.estimateSeq += 1;
    this.out.textContent = '0';
    this.out.classList.add('is-empty');
    this.outUsd.textContent = '';
    this.fee.textContent = '';
    this.previewButton.disabled = true;
    this.status.hidden = true;
  }

  scheduleEstimate() {
    this.resetEstimate();
    this.renderAddressNote();
    this.renderRecent();
    const amountProblem = this.amountField.problem();
    if (amountProblem) this.setStatus(amountProblem, 'error');
    // '' is "nothing to price yet"; a message is a reason not to; null is go.
    if (amountProblem !== null || this.addressProblem() !== null) return;

    this.out.textContent = '…';
    const seq = this.estimateSeq;
    this.estimateTimer = setTimeout(() => this.estimate(seq), ESTIMATE_DELAY_MS);
  }

  request() {
    return {
      accountId: intentsAssets.getAccountId(),
      asset: this.asset(),
      destinationAsset: this.destinationAsset(),
      destinationAddress: this.to.value.trim(),
      amount: this.amountField.tokenAmount(),
    };
  }

  async estimate(seq) {
    const request = this.request();
    if (!request.asset || !request.accountId) return;
    try {
      const quote = await intentsWithdrawals.preview(request);
      if (seq !== this.estimateSeq) return;
      this.showEstimate(quote);
      this.previewButton.disabled = false;
    } catch (error) {
      if (seq !== this.estimateSeq) return;
      this.out.textContent = '—';
      this.showRefusal(error);
    }
  }

  showEstimate(quote) {
    const asset = this.asset();
    this.out.classList.remove('is-empty');
    this.out.textContent = formatDisplayAmount(quote.amountOut);
    this.outUsd.textContent = quote.amountOutUsd ? formatUsd(quote.amountOutUsd) : '';
    this.fee.textContent = quote.withdrawFee && quote.withdrawFee !== '0'
      ? `Network fee ${formatRawAmount(quote.withdrawFee, asset.tokenDecimals)} ${asset.tokenSymbol}, taken from the amount`
      : '';
  }

  /** An address refused by 1Click belongs under the address, not under the button. */
  showRefusal(error) {
    if (error?.code === 'INVALID_ADDRESS') this.renderAddressNote(error.message);
    else this.setStatus(error?.message || 'Could not price that withdrawal.', 'error');
  }

  /** A fresh quote for the confirmation, rather than the estimate on screen,
   *  which may be minutes old by the time Review is pressed. */
  async preview() {
    const request = this.request();
    if (!request.asset || !request.accountId) return;
    this.previewButton.disabled = true;
    this.status.hidden = true;
    this.reviewed = request;

    try {
      const quote = await intentsWithdrawals.preview(request);
      this.openConfirm(request.asset, request.destinationAsset, quote);
    } catch (error) {
      this.showRefusal(error);
    } finally {
      this.previewButton.disabled = false;
    }
  }

  /**
   * The three figures are a sum -- you send, less the fee, is what arrives --
   * so they are shown as one: six significant digits, enough that the sum
   * reads, and the fee as the difference of the two figures shown. At four
   * digits a real 0.2 USDT withdrawal read 0.2, 0.01, 0.1899.
   *
   * 1Click takes the fee out of the amount, so that difference is the fee;
   * where cutting makes it differ, it is higher by one in the last digit,
   * which is the side a cost should err on. The payout estimate says a few
   * minutes, not 1Click's seconds: real payouts have taken minutes against a
   * quoted 13s.
   */
  openConfirm(asset, destinationAsset, quote) {
    const chain = chainDisplayName((destinationAsset || asset).blockchain);
    const symbol = asset.tokenSymbol;
    const send = formatDisplayAmount(quote.amountIn, CONFIRM_DIGITS);
    const receive = formatDisplayAmount(quote.amountOut, CONFIRM_DIGITS);

    this.controller.confirmModal.open({
      title: 'Confirm withdrawal',
      hero: `${assetMark(asset, 56)}
        <div class="multichain-confirm-amount">${escapeHtml(receive)} ${escapeHtml(symbol)}</div>
        <div class="multichain-confirm-sub">estimated, arriving on ${escapeHtml(chain)}</div>`,
      rows: [
        ['You send', `${send} ${symbol}`],
        ['Network fee', `${feeShown(send, receive, asset.tokenDecimals, quote.withdrawFee)} ${symbol}`],
        ['You receive', `${receive} ${symbol}`],
        ['To', truncateAddress(quote.destinationAddress)],
        ['Arrives in', 'A few minutes'],
      ],
      // The figures are directly above; repeating one in the button only makes
      // the label wrap.
      actionLabel: `Withdraw ${symbol}`,
      note: 'This cannot be undone.',
      run: (sheet) => this.run(sheet),
    });
  }

  setStatus(message, kind = '') {
    this.status.hidden = false;
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  renderAvailable() {
    this.amountField.render();
  }

  /** Emptied once an order is out, so Back cannot preview the same one again. */
  clearForm() {
    this.reviewed = null;
    this.to.value = '';
    this.fitAddress();
    this.lastAddressLength = 0;
    this.addressJudged = false;
    this.amountField.reset();
    this.resetEstimate();
    this.renderAddressNote();
    this.renderRecent();
  }

  async run(sheet) {
    const reviewed = this.reviewed;
    const asset = this.asset();
    const accountId = intentsAssets.getAccountId();
    const secretKey = this.controller.getSecretKey();
    if (!asset || !reviewed) {
      sheet.finish('That balance is no longer available.', 'error');
      return;
    }
    if (!accountId || !secretKey) {
      sheet.finish('Your account is not available. Sign in again to continue.', 'error');
      return;
    }
    const { destinationAsset } = reviewed;

    let prepared;
    let signed;
    try {
      sheet.setStatus('Getting a live quote…');
      prepared = await intentsWithdrawals.prepare({
        accountId, asset, destinationAsset,
        destinationAddress: reviewed.destinationAddress,
        amount: reviewed.amount,
      });

      // Rehearse before spending the relay's gas, and publish the signature
      // the verifier approved rather than a re-signed equivalent.
      sheet.setStatus('Checking…');
      signed = await signIntentPayload(prepared.payload, secretKey);
      const check = await intentsWithdrawals.simulate(signed);
      if (!check.ok) {
        sheet.setStatus(`This withdrawal would fail: ${check.reason}`, 'error');
        sheet.action.disabled = false;
        return;
      }
    } catch (error) {
      // Nothing has been published yet, so trying again is safe.
      sheet.setStatus(error.message || 'Could not get this withdrawal ready.', 'error');
      sheet.action.disabled = false;
      return;
    }

    sheet.setStatus('Sending…');
    // Recorded before sending: an outcome this screen cannot learn is the one
    // the activity list most needs, and 1Click can settle it from the
    // deposit address later.
    const orderId = intentsActivity.recordOrder({
      kind: 'withdraw',
      assetId: asset.assetId,
      symbol: asset.tokenSymbol,
      amount: prepared.amount,
      destinationChain: chainDisplayName((destinationAsset || asset).blockchain),
      // The chain's id as well as its name, so a later withdrawal can offer
      // this address again on the same chain (recentDestinations).
      destinationBlockchain: (destinationAsset || asset).blockchain,
      destinationAddress: prepared.destinationAddress,
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
    });
    const chain = chainDisplayName((destinationAsset || asset).blockchain);
    const symbol = asset.tokenSymbol;
    const session = sheet.session;
    let funded = false;
    let outcome;
    try {
      outcome = await intentsWithdrawals.execute(prepared, secretKey, {
        signed,
        // The asset has left the account; what remains is 1Click's payout,
        // which took minutes on a real BNB Chain withdrawal against a quoted
        // 13 seconds. Say so and let the person go -- Activity follows it.
        onFunded: () => {
          funded = true;
          this.clearForm();
          sheet.finish(
            `Your ${symbol} is on its way to ${chain}. It can take a few minutes; follow it in Activity.`,
            'ok',
          );
          void this.controller.refreshAfterMove();
        },
      });
    } catch (error) {
      // Expiry is checked before anything is published; every other failure
      // may come after it.
      if (error?.code === 'QUOTE_EXPIRED') {
        intentsActivity.forgetOrder(orderId);
        sheet.setStatus(error.message, 'error');
        sheet.action.disabled = false;
        return;
      }
      console.warn('Withdrawal outcome unknown:', error);
      outcome = null;
    }
    if (outcome) intentsActivity.updateOrder(orderId, { status: orderStatusFrom(outcome.status) });
    if (!funded) this.clearForm();

    // The payout's end, told only to the sheet that is still waiting for it.
    // Still running after the screen stopped watching is not news: Activity
    // keeps following it, as "on its way" already said.
    if (sheet.shows(session)) {
      if (!outcome) sheet.finish(UNCONFIRMED, 'error');
      else if (outcome.status === 'SUCCESS') {
        sheet.finish(`Withdrawn. About ${formatDisplayAmount(prepared.amountOut)} ${symbol} reached ${chain}.`, 'ok');
      } else if (outcome.status === 'REFUNDED') {
        sheet.finish(`This withdrawal could not complete, so your ${symbol} was returned.`);
      } else if (outcome.status === 'FAILED') sheet.finish(NOT_THROUGH, 'error');
      else if (!funded) sheet.finish(SLOW);
    }

    await this.controller.refreshAfterMove();
    this.renderAvailable();
  }

  close() {
    this.resetEstimate();
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * Choosing a token: search, what you hold, the popular coins, then everything else.
 *
 * The catalog is hundreds of assets, and the same symbol sits on several
 * chains. A row per asset with the chain as its second line settles which
 * USDC is which without asking for the chain as a separate question first --
 * which is what the old network-then-asset pair of selects did.
 */
class MultichainTokenPicker {
  constructor(controller) {
    this.controller = controller;
    this.onPick = null;
    this.accepts = () => true;
  }

  load() {
    this.modal = document.getElementById('multichainTokenPickerModal');
    this.title = document.getElementById('multichainTokenPickerTitle');
    this.search = document.getElementById('multichainTokenSearch');
    this.results = document.getElementById('multichainTokenResults');

    document.getElementById('closeMultichainTokenPickerModal')
      .addEventListener('click', () => this.close());
    this.search.addEventListener('input', () => this.render());
    this.results.addEventListener('click', (event) => {
      const row = event.target.closest('[data-asset-key]');
      if (!row) return;
      const pick = this.onPick;
      this.close();
      pick?.(row.dataset.assetKey);
    });
  }

  /**
   * `accepts` narrows the catalog to what the task can use -- everything but
   * the asset being paid with, for a swap; what the bridge carries, for a
   * deposit.
   */
  open({ title = 'Choose a token', accepts = () => true, onPick }) {
    this.accepts = accepts;
    this.onPick = onPick;
    this.title.textContent = title;
    this.search.value = '';
    this.render();
    this.results.scrollTop = 0;
    openModal(this.modal);
    // Off-screen while it slides in; see DESIGN.md §6.
    setTimeout(() => this.search.focus({ preventScroll: true }), 350);
  }

  candidates() {
    return intentsAssets.listCatalogAssets().filter((asset) => this.accepts(asset));
  }

  render() {
    const query = this.search.value.trim().toLowerCase();
    const all = this.candidates();
    const held = all
      .filter((asset) => asset.rawAmount !== '0')
      .sort((a, b) => (Number(b.tokenValueUsd) || 0) - (Number(a.tokenValueUsd) || 0));
    const rest = all.filter((asset) => asset.rawAmount === '0');

    if (!query) {
      // Popular leaves out what is already under Your tokens, so no coin
      // appears twice on one screen.
      const popular = POPULAR
        .map((assetId) => rest.find((asset) => asset.assetId === assetId))
        .filter(Boolean);
      const others = rest.filter((asset) => !popular.includes(asset));
      this.results.innerHTML = [
        held.length ? this.section('Your tokens', held) : '',
        this.section('Popular', popular),
        this.section(held.length || popular.length ? 'All tokens' : '', others),
      ].join('');
      return;
    }

    // An exact symbol first, then symbols that start with the query, then any
    // match on name or network -- so "usd" puts USDC above a token merely
    // bridged by a network whose name contains it.
    const rank = (asset) => {
      const symbol = asset.tokenSymbol.toLowerCase();
      if (symbol === query) return 0;
      if (symbol.startsWith(query)) return 1;
      return 2;
    };
    const matches = [...held, ...rest]
      .filter((asset) => [asset.tokenSymbol, asset.tokenName, asset.chainName]
        .some((text) => String(text).toLowerCase().includes(query)))
      .map((asset, order) => ({ asset, order, rank: rank(asset) }))
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map(({ asset }) => asset);

    this.results.innerHTML = matches.length
      ? this.section('', matches)
      : `<p class="multichain-picker-none">No token matches “${escapeHtml(this.search.value.trim())}”.</p>`;
  }

  section(title, assets) {
    if (!assets.length) return '';
    return `
      ${title ? `<div class="multichain-section-title">${escapeHtml(title)}</div>` : ''}
      <div class="multichain-list">${assets.map((asset) => this.row(asset)).join('')}</div>`;
  }

  /** A held token shows what you have; anything else leaves the right side
   *  empty rather than repeating "0" down the list. */
  row(asset) {
    const held = asset.rawAmount !== '0';
    return `
      <button type="button" class="multichain-row" data-asset-key="${escapeHtml(asset.key)}"
        aria-label="${escapeHtml(assetTitle(asset))}">
        ${assetMark(asset, 40)}
        <span class="multichain-row-main">
          <span class="multichain-row-name">${escapeHtml(asset.tokenSymbol)}</span>
          <span class="multichain-row-chain">${escapeHtml(asset.chainName)}</span>
        </span>
        ${held ? `<span class="multichain-row-values">
          <span class="multichain-row-amount">${escapeHtml(formatDisplayAmount(asset.tokenAmount))}</span>
          <span class="multichain-row-usd">${escapeHtml(
            asset.tokenValueUsd === null ? 'Unpriced' : formatUsd(asset.tokenValueUsd),
          )}</span>
        </span>` : ''}
      </button>`;
  }

  close() {
    this.onPick = null;
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * Swap: what you pay and what you get, with the estimate live as you type.
 *
 * The estimate is a dry quote -- free and read-only -- so asking for one as
 * the amount changes costs nothing but a request. The Review button fetches a
 * fresh one before the confirmation screen, and that screen re-quotes again
 * before anything is signed: the number here is a guide, never the agreement.
 */
class MultichainSwapModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
    this.toKey = null;
    this.estimateTimer = null;
    // Each request takes a number; a reply that is not the latest is dropped,
    // so a slow answer for "0.0" cannot overwrite the one for "0.05".
    this.estimateSeq = 0;
  }

  load() {
    this.modal = document.getElementById('multichainSwapModal');
    this.title = document.getElementById('multichainSwapTitle');
    this.fromChip = document.getElementById('multichainSwapFrom');
    // Token or dollars, Max and the balance line: the same control as send.
    this.amountField = new AmountField({
      input: document.getElementById('multichainSwapAmount'),
      currency: document.getElementById('multichainSwapCurrency'),
      flip: document.getElementById('multichainSwapFlip'),
      balance: document.getElementById('multichainSwapAvailable'),
      max: document.getElementById('multichainSwapMax'),
      getAsset: () => this.fromAsset(),
      onChange: () => this.scheduleEstimate(),
    });
    this.out = document.getElementById('multichainSwapOut');
    this.toChip = document.getElementById('multichainSwapTo');
    this.outUsd = document.getElementById('multichainSwapOutUsd');
    this.toChain = document.getElementById('multichainSwapToChain');
    this.floor = document.getElementById('multichainSwapFloor');
    this.previewButton = document.getElementById('multichainSwapPreview');
    this.status = document.getElementById('multichainSwapStatus');

    document.getElementById('closeMultichainSwapModal')
      .addEventListener('click', () => this.close());
    this.previewButton.addEventListener('click', () => this.preview());
    this.toChip.addEventListener('click', () => {
      const from = intentsAssets.getAsset(this.assetKey);
      this.controller.tokenPicker.open({
        accepts: (asset) => asset.assetId !== from?.assetId && !isSuperseded(asset),
        onPick: (key) => {
          this.toKey = key;
          this.renderTo();
          this.scheduleEstimate();
        },
      });
    });
  }

  fromAsset() { return intentsAssets.getAsset(this.assetKey); }

  toAsset() { return this.toKey ? intentsAssets.getCatalogAsset(this.toKey) : null; }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.toKey = null;
    this.title.textContent = `Swap ${asset.tokenSymbol}`;
    this.fromChip.innerHTML = `${assetMark(asset, 24)}<span>${escapeHtml(asset.tokenSymbol)}</span>`;
    this.renderTo();
    this.clearForm();
    openModal(this.modal);
  }

  renderTo() {
    const to = this.toAsset();
    // The chevron is inline so it takes the chip's colour (DESIGN.md §6).
    const chevron = '<svg class="multichain-chip-caret" viewBox="0 0 24 24" aria-hidden="true">'
      + '<polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2.5" '
      + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    this.toChip.classList.toggle('is-empty', !to);
    this.toChip.innerHTML = to
      ? `${assetMark(to, 24)}<span>${escapeHtml(to.tokenSymbol)}</span>${chevron}`
      : `<span>Choose token</span>${chevron}`;
    this.toChain.textContent = to ? `on ${to.chainName}` : '';
  }

  /** Back to "nothing estimated": the figures on screen must never describe
   *  a different amount from the one in the field. */
  resetEstimate() {
    clearTimeout(this.estimateTimer);
    this.estimateSeq += 1;
    this.out.textContent = '0';
    this.out.classList.add('is-empty');
    this.outUsd.textContent = '';
    this.floor.textContent = '';
    this.previewButton.disabled = true;
    this.status.hidden = true;
  }

  amountProblem() {
    return this.amountField.problem();
  }

  scheduleEstimate() {
    this.resetEstimate();
    const problem = this.amountProblem();
    if (problem) this.setStatus(problem, 'error');
    // '' is "nothing to price yet"; a message is a reason not to; null is go.
    if (problem !== null || !this.toAsset()) return;

    this.out.textContent = '…';
    const seq = this.estimateSeq;
    this.estimateTimer = setTimeout(() => this.estimate(seq), ESTIMATE_DELAY_MS);
  }

  async estimate(seq) {
    const fromAsset = this.fromAsset();
    const toAsset = this.toAsset();
    const accountId = intentsAssets.getAccountId();
    if (!fromAsset || !toAsset || !accountId) return;

    try {
      const quote = await intentsSwaps.preview({
        accountId, fromAsset, toAsset, amount: this.amountField.tokenAmount(),
      });
      if (seq !== this.estimateSeq) return;
      this.out.classList.remove('is-empty');
      this.out.textContent = formatDisplayAmount(quote.amountOut);
      this.outUsd.textContent = quote.amountOutUsd ? formatUsd(quote.amountOutUsd) : '';
      this.floor.textContent = quote.minAmountOut
        ? `At least ${formatDisplayAmount(quote.minAmountOut)} ${toAsset.tokenSymbol}, or your ${fromAsset.tokenSymbol} back`
        : '';
      this.previewButton.disabled = false;
    } catch (error) {
      if (seq !== this.estimateSeq) return;
      this.out.textContent = '—';
      this.setStatus(error.message || 'Could not price that swap.', 'error');
    }
  }

  /** A fresh quote for the confirmation, rather than the estimate on screen,
   *  which may be minutes old by the time Review is pressed. */
  async preview() {
    const fromAsset = this.fromAsset();
    const toAsset = this.toAsset();
    const accountId = intentsAssets.getAccountId();
    if (!fromAsset || !toAsset || !accountId) return;

    this.previewButton.disabled = true;
    this.status.hidden = true;
    // What was reviewed is what gets swapped, whatever the field shows by the
    // time Swap is pressed -- in dollars it shows a figure, not the amount.
    this.reviewedAmount = this.amountField.tokenAmount();

    try {
      const quote = await intentsSwaps.preview({
        accountId, fromAsset, toAsset, amount: this.reviewedAmount,
      });
      this.openConfirm(fromAsset, toAsset, quote);
    } catch (error) {
      this.setStatus(error.message || 'Could not price that swap.', 'error');
    } finally {
      this.previewButton.disabled = false;
    }
  }

  /**
   * The rate moves between quoting and filling, so the guaranteed minimum is
   * what the hero states: it is the number actually being agreed to, and the
   * estimate is the optimistic one.
   */
  openConfirm(fromAsset, toAsset, quote) {
    this.controller.confirmModal.open({
      title: 'Confirm swap',
      hero: `${assetMark(toAsset, 56)}
        <div class="multichain-confirm-amount">${escapeHtml(formatDisplayAmount(quote.minAmountOut ?? quote.amountOut))} ${escapeHtml(toAsset.tokenSymbol)}</div>
        <div class="multichain-confirm-sub">at least, on ${escapeHtml(toAsset.chainName)}</div>`,
      rows: [
        ['You swap', `${formatDisplayAmount(quote.amountIn)} ${fromAsset.tokenSymbol}`],
        ['Estimated', `${formatDisplayAmount(quote.amountOut)} ${toAsset.tokenSymbol}`],
        ['Guaranteed at least', `${quote.minAmountOut ? formatDisplayAmount(quote.minAmountOut) : '—'} ${toAsset.tokenSymbol}`, true],
        ['Takes about', `${quote.timeEstimateSeconds}s`],
      ],
      actionLabel: `Swap ${fromAsset.tokenSymbol}`,
      note: `The rate can move. You get at least the guaranteed amount, or your ${fromAsset.tokenSymbol} back.`,
      run: (sheet) => this.run(sheet),
    });
  }

  setStatus(message, kind = '') {
    this.status.hidden = false;
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  renderAvailable() {
    this.amountField.render();
  }

  /** Emptied once an order is out, so Back cannot preview the same one again. */
  clearForm() {
    this.amountField.reset();
    this.resetEstimate();
  }

  async run(sheet) {
    const fromAsset = this.fromAsset();
    const toAsset = this.toAsset();
    const accountId = intentsAssets.getAccountId();
    const secretKey = this.controller.getSecretKey();
    if (!fromAsset || !toAsset) {
      sheet.finish('That balance is no longer available.', 'error');
      return;
    }
    if (!accountId || !secretKey) {
      sheet.finish('Your account is not available. Sign in again to continue.', 'error');
      return;
    }

    let prepared;
    let signed;
    try {
      sheet.setStatus('Getting a live quote…');
      prepared = await intentsSwaps.prepare({
        accountId, fromAsset, toAsset, amount: this.reviewedAmount,
      });

      sheet.setStatus('Checking…');
      signed = await signIntentPayload(prepared.payload, secretKey);
      const check = await intentsSwaps.simulate(signed);
      if (!check.ok) {
        sheet.setStatus(`This swap would fail: ${check.reason}`, 'error');
        sheet.action.disabled = false;
        return;
      }
    } catch (error) {
      // Nothing has been published yet, so trying again is safe.
      sheet.setStatus(error.message || 'Could not get this swap ready.', 'error');
      sheet.action.disabled = false;
      return;
    }

    sheet.setStatus('Swapping…');
    // Recorded before sending, for the same reason as a withdrawal.
    const orderId = intentsActivity.recordOrder({
      kind: 'swap',
      fromAssetId: fromAsset.assetId,
      toAssetId: toAsset.assetId,
      fromSymbol: fromAsset.tokenSymbol,
      toSymbol: toAsset.tokenSymbol,
      amount: prepared.amount,
      amountOut: prepared.amountOut,
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
    });
    const session = sheet.session;
    let funded = false;
    let outcome;
    try {
      outcome = await intentsSwaps.execute(prepared, secretKey, {
        signed,
        // Paid in; the fill is 1Click's. As with a withdrawal, say so and let
        // the person go rather than hold them on a spinner through it.
        onFunded: () => {
          funded = true;
          this.clearForm();
          sheet.finish(
            `Swapping your ${fromAsset.tokenSymbol} for ${toAsset.tokenSymbol}. It can take a few minutes; follow it in Activity.`,
            'ok',
          );
          void this.controller.refreshAfterMove();
        },
      });
    } catch (error) {
      // Expiry is checked before anything is published; every other failure
      // may come after it.
      if (error?.code === 'QUOTE_EXPIRED') {
        intentsActivity.forgetOrder(orderId);
        sheet.setStatus(error.message, 'error');
        sheet.action.disabled = false;
        return;
      }
      console.warn('Swap outcome unknown:', error);
      outcome = null;
    }
    if (outcome) {
      intentsActivity.updateOrder(orderId, {
        status: orderStatusFrom(outcome.status),
        ...(outcome.status === 'SUCCESS' && outcome.detail?.swapDetails?.amountOutFormatted
          ? { amountReceived: outcome.detail.swapDetails.amountOutFormatted } : {}),
      });
    }

    if (!funded) this.clearForm();

    // Told only to the sheet still waiting for it; see the withdrawal.
    if (sheet.shows(session)) {
      if (!outcome) sheet.finish(UNCONFIRMED, 'error');
      else if (outcome.status === 'SUCCESS') {
        sheet.finish(`Swapped. Your ${toAsset.tokenSymbol} is in your wallet.`, 'ok');
      } else if (outcome.refunded) {
        // Not a failure: the floor protected the person from a worse fill.
        sheet.finish(`Could not fill at the agreed rate, so your ${fromAsset.tokenSymbol} was returned.`);
      } else if (outcome.status === 'FAILED') sheet.finish(NOT_THROUGH, 'error');
      else if (!funded) sheet.finish(SLOW);
    }

    await this.controller.refreshAfterMove();
    this.renderAvailable();
  }

  close() {
    this.resetEstimate();
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

class MultichainController {
  constructor() {
    this.loaded = false;
    this.getAccount = () => null;
    // The chat payment panel registers its send action when configured.
    this.onSend = () => {};
    this.assetsModal = new MultichainModal(this);
    this.assetModal = new MultichainAssetModal(this);
    this.receiveModal = new MultichainReceiveModal(this);
    this.withdrawModal = new MultichainWithdrawModal(this);
    this.swapModal = new MultichainSwapModal(this);
    this.tokenPicker = new MultichainTokenPicker(this);
    this.confirmModal = new MultichainConfirmModal(this);
  }

  /**
   * Per-account wallet settings, kept with the account's saved state: which
   * assets it has held, and whether empty ones are hidden.
   */
  settings() {
    let saved = null;
    try {
      saved = this.getSettings?.();
    } catch {
      saved = null;
    }
    return {
      heldBefore: Array.isArray(saved?.heldBefore) ? saved.heldBefore : [],
      hideEmpty: Boolean(saved?.hideEmpty),
    };
  }

  updateSettings(patch) {
    this.saveSettings?.({ ...this.settings(), ...patch });
  }

  /** Where the signed-in account comes from; without it there is nothing to read. */
  getSecretKey() {
    return this.getAccount()?.keys?.secret || null;
  }

  configure({ getAccount, onSend, getSettings, saveSettings } = {}) {
    if (typeof onSend === 'function') this.onSend = onSend;
    if (typeof getSettings === 'function') this.getSettings = getSettings;
    if (typeof saveSettings === 'function') {
      this.saveSettings = saveSettings;
      intentsAssets.configure({
        getHeldBefore: () => this.settings().heldBefore,
        saveHeldBefore: (ids) => this.updateSettings({ heldBefore: ids }),
      });
    }
    if (typeof getAccount === 'function') {
      this.getAccount = getAccount;
      intentsAssets.configure({ getAccount });
    }
  }

  load() {
    if (this.loaded) return;
    installLogoFallback();
    this.assetsModal.load();
    this.assetModal.load();
    this.receiveModal.load();
    this.withdrawModal.load();
    this.swapModal.load();
    this.tokenPicker.load();
    this.confirmModal.load();

    this.summaryButton = document.getElementById('multichainSummary');
    this.summaryValue = document.getElementById('multichainSummaryValue');

    document.getElementById('openMultichain')
      .addEventListener('click', () => this.assetsModal.open());
    this.summaryButton?.addEventListener('click', () => this.assetsModal.open());

    this.loaded = true;
  }

  reset() {
    intentsAssets.reset();
    intentsDeposits.reset();
    if (this.summaryValue) this.summaryValue.textContent = '$0.00';
  }

  close(modalId) {
    const screens = {
      multichainModal: this.assetsModal,
      multichainAssetModal: this.assetModal,
      multichainReceiveModal: this.receiveModal,
      multichainWithdrawModal: this.withdrawModal,
      multichainSwapModal: this.swapModal,
      multichainTokenPickerModal: this.tokenPicker,
      multichainConfirmModal: this.confirmModal,
    };
    if (!screens[modalId]) return false;
    screens[modalId].close();
    return true;
  }

  refresh(options) {
    return intentsAssets.refresh(options);
  }

  /**
   * Receive anything the bridge carries. The listed assets are only what is
   * held plus two defaults, so without this every other chain was unreachable.
   *
   * The picker's rows are asset-on-chain, so one tap answers both "which
   * token" and "which network" -- no separate network question.
   */
  async startDeposit() {
    const button = this.assetsModal.receiveButton;
    button.disabled = true;
    try {
      await intentsDeposits.loadBridgeTokens();
    } catch (error) {
      console.warn('Deposit options unavailable:', error);
      this.assetsModal.statusLine.textContent = 'Could not load what you can receive. Try again in a moment.';
      return;
    } finally {
      button.disabled = false;
    }
    this.tokenPicker.open({
      title: 'Receive',
      // Not an asset deposits never land on, whatever the bridge lists.
      accepts: (asset) => intentsDeposits.isDepositable(asset.assetId) && !DEPOSIT_CREDITS[asset.assetId],
      onPick: (key) => this.receiveModal.open(key),
    });
  }

  /** Back to the asset the money moved from, with every form behind it closed. */
  finishMove() {
    this.confirmModal.close();
    this.withdrawModal.close();
    this.swapModal.close();
  }

  /** After money moves, every screen showing a balance is stale. */
  async refreshAfterMove() {
    await intentsAssets.refresh({ force: true });
    this.assetModal.render();
    if (this.assetModal.isActive()) void this.assetModal.loadActivity();
    this.assetsModal.render();
    this.updateSummary();
  }

  /**
   * The row on the wallet screen. Kept out of the native Total Balance on
   * purpose: that number is the Liberdus balance, and these are not it.
   */
  async updateSummary({ refresh = false } = {}) {
    if (!this.summaryValue) return;
    if (refresh) await intentsAssets.refresh();
    this.summaryValue.textContent = formatUsd(intentsAssets.getTotalUsd());
  }
}

export const multichain = new MultichainController();

// === Chat payment screens ===

// Sending crypto to a Liberdus contact.
//
// Sends an intents balance to another account. Their intents account is their
// Liberdus address, so there is nobody to look up and nothing to paste: from a
// conversation the recipient is whoever the chat is with, and from the wallet
// it is a contact picked from a list.
//
// Built from the swap screen's parts -- the same amount panel, token chip and
// picker, and the same confirmation screen -- so they read as one wallet.
//
// The value and the receipt settle on different networks, so the order matters
// and is fixed: publish the transfer, then send the chat message. If the
// message fails the sender is told plainly that the money moved and the receipt
// did not, because the opposite order would let a receipt exist for a payment
// that never happened. And once the transfer may be out, nothing on these
// screens can send it again -- only the receipt can be retried.

const $ = (id) => document.getElementById(id);

// Inline so they take the control's colour (DESIGN.md §6).
const CARET = '<svg class="multichain-chip-caret" viewBox="0 0 24 24" aria-hidden="true">'
  + '<polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2.5" '
  + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
/**
 * Who to send to, when sending starts from the wallet.
 *
 * The app supplies the contacts and their avatars: this module knows nothing
 * of the address book, and the avatar has to honour the style the person
 * chose, which only the app knows how to draw.
 */
class ContactPicker {
  constructor(owner) {
    this.owner = owner;
    this.onPick = null;
    this.contacts = [];
  }

  load() {
    this.modal = $('chatSendContactModal');
    this.title = $('chatSendContactTitle');
    this.search = $('chatSendContactSearch');
    this.results = $('chatSendContactResults');
    $('closeChatSendContactModal').addEventListener('click', () => this.close());
    this.search.addEventListener('input', () => this.render());
    this.results.addEventListener('click', (event) => {
      const row = event.target.closest('[data-address]');
      if (!row) return;
      const contact = this.contacts.find((entry) => entry.address === row.dataset.address);
      const pick = this.onPick;
      this.close();
      if (contact) pick?.(contact);
    });
  }

  open({ title, onPick }) {
    this.onPick = onPick;
    this.title.textContent = title;
    this.search.value = '';
    this.contacts = this.owner.listContacts();
    this.render();
    openModal(this.modal);
    // Off-screen while it slides in; see DESIGN.md §6.
    setTimeout(() => this.search.focus({ preventScroll: true }), 350);
  }

  render() {
    if (!this.contacts.length) {
      this.results.innerHTML = '<p class="multichain-picker-none">No contacts yet. Add someone in Contacts first.</p>';
      return;
    }
    const query = this.search.value.trim().toLowerCase();
    const matches = query
      ? this.contacts.filter((contact) => [contact.name, contact.username]
        .some((text) => String(text || '').toLowerCase().includes(query)))
      : this.contacts;
    if (!matches.length) {
      this.results.innerHTML =
        `<p class="multichain-picker-none">No contact matches “${escapeHtml(this.search.value.trim())}”.</p>`;
      return;
    }
    this.results.innerHTML = `<div class="multichain-list">${matches.map((contact) => `
      <button type="button" class="multichain-row" data-address="${escapeHtml(contact.address)}">
        <span class="chat-send-contact-avatar" data-avatar-for="${escapeHtml(contact.address)}"></span>
        <span class="multichain-row-main">
          <span class="multichain-row-name">${escapeHtml(contact.name)}</span>
          ${contact.username && contact.username !== contact.name
            ? `<span class="multichain-row-chain">@${escapeHtml(contact.username)}</span>` : ''}
        </span>
      </button>`).join('')}</div>`;
    // Avatars are drawn asynchronously by the app; a row is usable before its
    // avatar arrives.
    for (const slot of this.results.querySelectorAll('[data-avatar-for]')) {
      Promise.resolve(this.owner.renderAvatar(slot.dataset.avatarFor, 40))
        .then((html) => { if (html) slot.innerHTML = html; })
        .catch(() => {});
    }
  }

  close() {
    this.onPick = null;
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal?.classList.contains('active') || false;
  }
}

export class ChatPaymentPanel {
  constructor() {
    this.loaded = false;
    this.recipientAddress = null;
    this.recipientName = null;
    this.assetKey = null;
    this.sending = false;
    // Set once the transfer is out and only the chat receipt is outstanding.
    this.pendingReceipt = null;
    // Set when the outcome is known or unknowable; the button only leaves.
    this.done = false;
    this.getAccount = () => null;
    this.onSent = null;
    this.showToast = () => {};
    this.listContacts = () => [];
    this.renderAvatar = () => '';
    this.prepareRecipient = async () => ({ blocked: false });
    this.contactPicker = new ContactPicker(this);
  }

  configure({ getAccount, onSent, showToast, listContacts, renderAvatar, prepareRecipient } = {}) {
    if (typeof getAccount === 'function') {
      this.getAccount = getAccount;
      intentsChatPayments.configure({ getAccount });
    }
    if (typeof onSent === 'function') this.onSent = onSent;
    if (typeof showToast === 'function') this.showToast = showToast;
    if (typeof listContacts === 'function') this.listContacts = listContacts;
    if (typeof renderAvatar === 'function') this.renderAvatar = renderAvatar;
    if (typeof prepareRecipient === 'function') this.prepareRecipient = prepareRecipient;
  }

  load() {
    if (this.loaded) return;
    this.modal = $('chatSendModal');
    this.title = $('chatSendTitle');
    this.form = $('chatSendForm');
    this.empty = $('chatSendEmpty');
    this.amountInput = $('chatSendAmount');
    this.assetChip = $('chatSendAsset');
    // Token or dollars, Max and the balance line: the same control as swap.
    this.amount = new AmountField({
      input: this.amountInput,
      currency: $('chatSendCurrency'),
      flip: $('chatSendFlip'),
      balance: $('chatSendAvailable'),
      max: $('chatSendMax'),
      getAsset: () => this.selectedAsset(),
      onChange: () => this.validate(),
    });
    this.noteToggle = $('chatSendNoteToggle');
    this.noteInput = $('chatSendNote');
    this.sendButton = $('chatSendButton');
    this.statusLine = $('chatSendStatus');

    $('closeChatSendModal').addEventListener('click', () => this.close());
    this.sendButton.addEventListener('click', () => this.primaryAction());
    this.assetChip.addEventListener('click', () => {
      multichain.tokenPicker.open({
        title: 'Send',
        // Only what can actually be sent: an empty asset would produce a
        // failure the person could have been spared.
        accepts: (asset) => asset.rawAmount !== '0',
        onPick: (key) => {
          this.assetKey = key;
          this.renderAsset();
          this.amount.assetChanged();
        },
      });
    });
    this.noteToggle.addEventListener('click', () => {
      this.noteToggle.hidden = true;
      this.noteInput.hidden = false;
      this.noteInput.focus({ preventScroll: true });
    });
    $('chatSendReceive').addEventListener('click', () => {
      // Receiving is a different task, and its screens sit below this one in
      // the stack; leave rather than open them underneath.
      this.close();
      void multichain.startDeposit();
    });

    this.contactPicker.load();
    // The asset screen's Send: pick a contact, then this same screen.
    multichain.configure({ onSend: (assetKey) => this.startFromWallet(assetKey) });
    this.loaded = true;
  }

  startFromWallet(assetKey) {
    this.load();
    this.contactPicker.open({
      title: 'Send to',
      onPick: (contact) => this.open(contact.address, contact.name, { assetKey }),
    });
  }

  selectedAsset() {
    return this.assetKey ? intentsAssets.getAsset(this.assetKey) : null;
  }

  setStatus(message, kind = '') {
    this.statusLine.hidden = !message;
    this.statusLine.textContent = message || '';
    this.statusLine.dataset.kind = kind;
  }

  async open(recipientAddress, recipientName = null, { assetKey = null } = {}) {
    this.load();
    this.recipientAddress = recipientAddress;
    this.recipientName = recipientName;
    this.sending = false;
    this.pendingReceipt = null;
    this.done = false;
    this.title.textContent = recipientName ? `Send to ${recipientName}` : 'Send';
    this.amount.reset();
    this.noteInput.value = '';
    this.noteInput.hidden = true;
    this.noteToggle.hidden = false;
    this.setStatus('');
    this.sendButton.textContent = 'Review payment';
    this.sendButton.classList.replace('btn--secondary', 'btn--primary');
    this.sendButton.disabled = true;
    this.lockForm(false);
    this.form.hidden = false;
    this.empty.hidden = true;
    this.assetChip.innerHTML = '<span>Loading…</span>';
    openModal(this.modal);

    await intentsAssets.refresh({ force: true });
    // The asset it was opened for, else the largest holding: the likeliest
    // thing to be sent, and a choice the picker is one tap from changing.
    const held = intentsAssets.getAssets()
      .filter((asset) => asset.rawAmount !== '0')
      .sort((a, b) => (Number(b.tokenValueUsd) || 0) - (Number(a.tokenValueUsd) || 0));
    if (!held.length) {
      this.form.hidden = true;
      this.empty.hidden = false;
      return;
    }
    const preferred = assetKey || this.assetKey;
    this.assetKey = held.some((asset) => asset.key === preferred) ? preferred : held[0].key;
    this.renderAsset();
    this.amount.changed();
    // Off-screen while it slides in; see DESIGN.md §6.
    setTimeout(() => this.amountInput.focus({ preventScroll: true }), 350);
  }

  renderAsset() {
    const asset = this.selectedAsset();
    if (!asset) return;
    this.assetChip.innerHTML = `${assetMark(asset, 24)}<span>${escapeHtml(asset.tokenSymbol)}</span>${CARET}`;
    this.assetChip.setAttribute('aria-label', `Sending ${asset.tokenSymbol} on ${asset.chainName}. Change`);
  }

  /** Live, so the button is only ever pressable for an amount that can go. */
  validate() {
    // After the money has gone, nothing may turn this back into a Send button.
    if (this.pendingReceipt || this.done) return;
    const problem = this.amount.problem();
    this.setStatus(problem || '', problem ? 'error' : '');
    this.sendButton.disabled = problem !== null;
  }

  close() {
    if (this.sending) return;
    this.modal.classList.remove('active');
    this.recipientAddress = null;
    this.pendingReceipt = null;
  }

  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  primaryAction() {
    if (this.done) return this.close();
    if (this.pendingReceipt) return this.sendReceipt();
    return this.review();
  }

  /**
   * The figures, the recipient and a last chance to go back -- on the shared
   * confirmation screen, which is what swap and withdraw end with too.
   */
  async review() {
    const asset = this.selectedAsset();
    const amount = this.amount.tokenAmount();
    if (!asset || !this.recipientAddress || this.amount.problem() !== null) return;

    // The receipt travels as a chat message, so a contact who is not taking
    // messages from you would get the money with no word of who sent it or
    // why. Refuse before anything moves, not after.
    this.sendButton.disabled = true;
    this.setStatus('Checking…');
    const recipient = await this.prepareRecipient(this.recipientAddress).catch(() => ({ blocked: false }));
    this.sendButton.disabled = false;
    if (recipient?.blocked) {
      this.setStatus(`${this.recipientName || 'This contact'} is not accepting messages from you, so a payment cannot reach them here.`, 'error');
      return;
    }
    this.setStatus('');

    const price = priceOf(asset);
    const usd = price ? Number(amount) * price : null;
    const name = this.recipientName || 'this contact';
    const note = this.noteInput.value.trim() || null;
    const shown = formatDisplayAmount(amount, 6);
    // Each fact once: the hero carries the amount and its value, the rows the
    // rest. The exact amount earns a row only when the hero had to trim it --
    // this is the screen where what is sent must be readable in full.
    const rows = [['To', name]];
    if (shown !== amount) rows.push(['Exact amount', `${amount} ${asset.tokenSymbol}`]);
    if (note) rows.push(['Note', note]);
    rows.push(['Network fee', 'None'], ['Arrives', 'Instantly']);

    multichain.confirmModal.open({
      title: 'Confirm payment',
      hero: `${assetMark(asset, 56)}
        <div class="multichain-confirm-amount">${escapeHtml(shown)} ${escapeHtml(asset.tokenSymbol)}</div>
        ${usd !== null ? `<div class="multichain-confirm-sub">about ${escapeHtml(formatUsd(usd))}</div>` : ''}`,
      rows,
      actionLabel: `Send ${asset.tokenSymbol}`,
      note: 'Payments cannot be undone.',
      run: (sheet) => this.run(sheet, { asset, amount, note }),
    });
  }

  async run(sheet, { asset, amount, note }) {
    const secretKey = this.getAccount()?.keys?.secret;
    if (!secretKey) {
      sheet.finish('Your account is not available. Sign in again to continue.', 'error');
      return;
    }

    this.sending = true;
    sheet.setStatus('Sending…');

    let prepared;
    let sent;
    try {
      prepared = await intentsChatPayments.prepare({
        asset, recipientAddress: this.recipientAddress, amount, note,
      });
      sent = await intentsChatPayments.send(prepared, secretKey, { asset, note });
    } catch (error) {
      this.sending = false;
      // Refused while preparing or in rehearsal: nothing was published, so
      // trying again is safe.
      if (!prepared || error?.code === 'WOULD_FAIL') {
        sheet.setStatus(error.message || 'That payment is not valid.', 'error');
        sheet.action.disabled = false;
        return;
      }
      // A failure while publishing may come after the relay took it.
      console.warn('Payment outcome unknown:', error);
      this.finish(UNCONFIRMED, 'error');
      sheet.finish(UNCONFIRMED, 'error');
      return;
    }

    // The money has moved. From here a failure is about the receipt only, and
    // the form is locked so it cannot describe a second payment.
    this.lockForm(true);
    this.pendingReceipt = { message: sent.message, amount: prepared.amount, symbol: prepared.symbol };
    this.sending = false;
    void multichain.refreshAfterMove().catch(() => {});

    if (await this.sendReceipt()) {
      multichain.confirmModal.close();
      return;
    }
    sheet.finish(`Your ${prepared.symbol} was sent, but the chat message did not go through. Go back to send it again.`, 'error');
  }

  /**
   * Post the chat message for a transfer that has already gone. Safe to press
   * again: it only ever resends the message, never the money.
   */
  async sendReceipt() {
    const receipt = this.pendingReceipt;
    if (!receipt || this.sending) return false;
    this.sending = true;
    this.sendButton.disabled = true;
    try {
      await this.onSent?.(this.recipientAddress, receipt.message);
      this.sending = false;
      this.close();
      this.showToast(`Sent ${receipt.amount} ${receipt.symbol}`, 3000, 'success');
      return true;
    } catch (error) {
      console.error('Payment receipt failed to send:', error);
      this.sending = false;
      this.setStatus(`Your ${receipt.symbol} was sent, but the chat message did not go through.`, 'error');
      this.sendButton.textContent = 'Send the message again';
      this.sendButton.disabled = false;
      return false;
    }
  }

  /** Every control that could describe a different payment. */
  lockForm(locked) {
    this.amount.setLocked(locked);
    for (const control of [this.assetChip, this.noteInput, this.noteToggle]) control.disabled = locked;
  }

  /** The transfer's outcome is unknowable: leave, never resend. */
  finish(message, kind) {
    this.done = true;
    this.pendingReceipt = null;
    this.lockForm(true);
    this.setStatus(message, kind);
    this.sendButton.textContent = 'Done';
    // Leaving is not a consequential action, so it is not blue.
    this.sendButton.classList.replace('btn--primary', 'btn--secondary');
    this.sendButton.disabled = false;
  }
}

export const chatPaymentPanel = new ChatPaymentPanel();
