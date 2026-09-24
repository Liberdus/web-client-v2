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
// Nothing here signs anything, and these assets are deliberately kept out of
// the send and receive selects: until the transfer and withdraw paths exist, an
// asset in a send dropdown would be a promise the client cannot keep.

import { fetchIntentsTokens, getIntentsBalances } from './intents.js';

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
// Exported so intents-deposits.js can format minimums the same way rather than
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
    chainName: chainDisplayName(token?.blockchain),
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
