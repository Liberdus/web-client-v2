import { normalizeEvmAddress } from './identity.js';
import { createNetworkMap, DEFAULT_EVM_NETWORKS } from './networks.js';
import { EvmRpcError } from './rpc.js';

function freezePortfolioResult(result) {
  return Object.freeze({
    ...result,
    assets: Object.freeze(result.assets),
    failures: Object.freeze(result.failures || []),
  });
}

function normalizeOptionalDecimal(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const normalized = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeRawInteger(value) {
  const normalized = String(value ?? '');
  if (!/^\d+$/.test(normalized)) {
    throw new TypeError('Portfolio provider returned an invalid raw token balance');
  }
  return normalized;
}

function sanitizeTokenMetadata(value, maximumLength) {
  return String(value || '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function createTimeoutSignal(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Portfolio request timed out')), timeoutMs);
  const abortFromExternalSignal = () => controller.abort(externalSignal.reason);

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    },
  };
}

export class AnkrPortfolioProvider {
  constructor({
    endpoint,
    networks = DEFAULT_EVM_NETWORKS,
    fetchFn = globalThis.fetch,
    timeoutMs = 12_000,
    pageSize = 100,
    maxPages = 20,
    onlyWhitelisted = true,
  } = {}) {
    if (typeof endpoint !== 'string' || endpoint.trim() === '') {
      throw new TypeError('An Ankr or backend portfolio endpoint is required');
    }
    if (typeof fetchFn !== 'function') {
      throw new TypeError('A fetch implementation is required for token discovery');
    }
    if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
      throw new TypeError('Ankr page size must be a positive integer');
    }
    if (!Number.isSafeInteger(maxPages) || maxPages <= 0) {
      throw new TypeError('Ankr maximum pages must be a positive integer');
    }

    this.endpoint = endpoint;
    this.networks = createNetworkMap(networks);
    this.networksByAnkrId = new Map(
      [...this.networks.values()]
        .filter((network) => network.ankrId)
        .map((network) => [network.ankrId, network]),
    );
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
    this.pageSize = pageSize;
    this.maxPages = maxPages;
    this.onlyWhitelisted = onlyWhitelisted;
    this.requestId = 0;
  }

  async discoverAssets(address, networkIds = [...this.networks.keys()], { signal } = {}) {
    const normalizedAddress = normalizeEvmAddress(address);
    const selectedNetworks = networkIds.map((networkId) => {
      const network = this.networks.get(networkId);
      if (!network) {
        throw new TypeError(`Unsupported EVM network: ${networkId}`);
      }
      if (!network.ankrId) {
        throw new TypeError(`EVM network ${networkId} is not supported by the Ankr adapter`);
      }
      return network;
    });

    const assets = [];
    let nextPageToken = '';
    let totalBalanceUsd = null;
    let pagesFetched = 0;

    do {
      pagesFetched += 1;
      if (pagesFetched > this.maxPages) {
        throw new EvmRpcError('Ankr portfolio pagination exceeded the configured limit', {
          code: 'PORTFOLIO_PAGE_LIMIT',
        });
      }

      const result = await this.requestPage({
        walletAddress: normalizedAddress,
        blockchain: selectedNetworks.map((network) => network.ankrId),
        nativeFirst: true,
        onlyWhitelisted: this.onlyWhitelisted,
        pageSize: this.pageSize,
        ...(nextPageToken ? { pageToken: nextPageToken } : {}),
      }, signal);

      if (!Array.isArray(result.assets)) {
        throw new EvmRpcError('Ankr portfolio response did not include an assets array', {
          code: 'INVALID_PORTFOLIO_RESPONSE',
        });
      }

      assets.push(...result.assets.map((asset) => this.normalizeAsset(asset)));
      totalBalanceUsd = normalizeOptionalDecimal(result.totalBalanceUsd) ?? totalBalanceUsd;
      nextPageToken = typeof result.nextPageToken === 'string'
        ? result.nextPageToken
        : '';
    } while (nextPageToken);

    return freezePortfolioResult({
      address: normalizedAddress,
      provider: 'ankr',
      assets,
      failures: [],
      totalBalanceUsd,
      pagesFetched,
      complete: true,
    });
  }

  async requestPage(params, externalSignal) {
    const id = ++this.requestId;
    const requestSignal = createTimeoutSignal(this.timeoutMs, externalSignal);

    try {
      const response = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'ankr_getAccountBalance',
          params,
        }),
        signal: requestSignal.signal,
      });

      if (!response.ok) {
        throw new EvmRpcError(`Portfolio request failed with HTTP ${response.status}`, {
          code: 'PORTFOLIO_HTTP_ERROR',
        });
      }

      const payload = await response.json();
      if (!payload || payload.jsonrpc !== '2.0' || payload.id !== id) {
        throw new EvmRpcError('Portfolio endpoint returned an invalid JSON-RPC response', {
          code: 'INVALID_PORTFOLIO_RESPONSE',
        });
      }
      if (payload.error) {
        throw new EvmRpcError(payload.error.message || 'Portfolio endpoint returned an error', {
          code: 'PORTFOLIO_RESPONSE_ERROR',
          rpcCode: payload.error.code,
        });
      }
      if (!payload.result || typeof payload.result !== 'object') {
        throw new EvmRpcError('Portfolio endpoint did not include a result', {
          code: 'INVALID_PORTFOLIO_RESPONSE',
        });
      }

      return payload.result;
    } catch (error) {
      if (error instanceof EvmRpcError) {
        throw error;
      }
      throw new EvmRpcError('Portfolio request failed', {
        code: requestSignal.signal.aborted ? 'PORTFOLIO_ABORTED' : 'PORTFOLIO_NETWORK_ERROR',
        cause: error,
      });
    } finally {
      requestSignal.cleanup();
    }
  }

  normalizeAsset(asset) {
    if (!asset || typeof asset !== 'object') {
      throw new TypeError('Portfolio provider returned an invalid asset');
    }

    const network = this.networksByAnkrId.get(asset.blockchain);
    if (!network) {
      throw new TypeError(`Portfolio provider returned unsupported chain: ${asset.blockchain}`);
    }

    const rawContractAddress = typeof asset.contractAddress === 'string'
      ? asset.contractAddress.trim().toLowerCase()
      : '';
    const contractAddress = /^0x[0-9a-f]{40}$/.test(rawContractAddress)
      ? rawContractAddress
      : null;
    const tokenType = typeof asset.tokenType === 'string'
      ? asset.tokenType
      : '';
    const assetType = !contractAddress || tokenType.toLowerCase() === 'native'
      ? 'native'
      : 'erc20';
    const tokenDecimals = Number(asset.tokenDecimals);

    if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 255) {
      throw new TypeError('Portfolio provider returned invalid token decimals');
    }

    return Object.freeze({
      assetType,
      provider: 'ankr',
      networkId: network.id,
      networkName: network.name,
      chainId: network.chainId,
      contractAddress: assetType === 'native' ? null : contractAddress,
      tokenName: sanitizeTokenMetadata(asset.tokenName, 120),
      tokenSymbol: sanitizeTokenMetadata(asset.tokenSymbol, 80),
      tokenDecimals,
      tokenType: tokenType || (assetType === 'native' ? 'NATIVE' : 'ERC20'),
      balanceRawInteger: normalizeRawInteger(asset.balanceRawInteger),
      balance: normalizeOptionalDecimal(asset.balance),
      balanceUsd: normalizeOptionalDecimal(asset.balanceUsd),
      tokenPriceUsd: normalizeOptionalDecimal(asset.tokenPrice),
      thumbnail: typeof asset.thumbnail === 'string' && /^https:\/\//.test(asset.thumbnail)
        ? asset.thumbnail
        : null,
    });
  }
}

export class MultiChainWalletService {
  constructor({ rpcPool, tokenProvider = null } = {}) {
    if (!rpcPool || typeof rpcPool.getNativeBalances !== 'function') {
      throw new TypeError('A native-balance RPC pool is required');
    }
    if (tokenProvider && typeof tokenProvider.discoverAssets !== 'function') {
      throw new TypeError('Token provider must implement discoverAssets');
    }
    this.rpcPool = rpcPool;
    this.tokenProvider = tokenProvider;
  }

  async discoverAssets(address, networkIds, options = {}) {
    const normalizedAddress = normalizeEvmAddress(address);

    if (!this.tokenProvider) {
      return this.rpcPool.getNativeBalances(normalizedAddress, networkIds, options);
    }

    try {
      return await this.tokenProvider.discoverAssets(normalizedAddress, networkIds, options);
    } catch (tokenError) {
      const nativeResult = await this.rpcPool.getNativeBalances(
        normalizedAddress,
        networkIds,
        options,
      );
      return freezePortfolioResult({
        ...nativeResult,
        provider: 'public-rpc-fallback',
        failures: [
          {
            networkId: null,
            code: tokenError?.code || 'TOKEN_DISCOVERY_FAILED',
            message: tokenError?.message || 'Token discovery failed',
          },
          ...nativeResult.failures,
        ],
        complete: false,
      });
    }
  }
}
