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

import {
  bridgeChainOf,
  fetchBridgeTokens,
  fetchRecentDeposits,
  requestDepositAddress,
} from './intents.js';
import { formatUnits } from './intents-assets.js';

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
