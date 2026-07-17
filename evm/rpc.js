import { normalizeEvmAddress } from './identity.js';
import { createNetworkMap, DEFAULT_EVM_NETWORKS } from './networks.js';

export class EvmRpcError extends Error {
  constructor(message, details = {}) {
    super(message, { cause: details.cause });
    this.name = 'EvmRpcError';
    this.code = details.code || 'EVM_RPC_ERROR';
    this.networkId = details.networkId || null;
    this.endpoint = details.endpoint || null;
    this.rpcCode = details.rpcCode ?? null;
  }
}

export function hexQuantityToBigInt(value) {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) {
    throw new TypeError(`Invalid EVM hexadecimal quantity: ${String(value)}`);
  }
  return BigInt(value);
}

export function formatUnits(value, decimals = 18) {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new TypeError('Token decimals must be an integer between 0 and 255');
  }

  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  if (decimals === 0) {
    return `${negative ? '-' : ''}${absolute}`;
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function createRequestSignal(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('RPC request timed out')), timeoutMs);
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

export class EvmRpcPool {
  constructor({
    networks = DEFAULT_EVM_NETWORKS,
    fetchFn = globalThis.fetch,
    timeoutMs = 8_000,
  } = {}) {
    if (typeof fetchFn !== 'function') {
      throw new TypeError('A fetch implementation is required for EVM RPC requests');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new TypeError('RPC timeout must be a positive number');
    }

    this.networks = createNetworkMap(networks);
    this.fetchFn = fetchFn;
    this.timeoutMs = timeoutMs;
    this.requestId = 0;
    this.verifiedEndpoints = new Map();
  }

  getNetwork(networkId) {
    const network = this.networks.get(networkId);
    if (!network) {
      throw new TypeError(`Unsupported EVM network: ${networkId}`);
    }
    return network;
  }

  async request(networkId, method, params = [], { signal } = {}) {
    const network = this.getNetwork(networkId);
    const failures = [];

    for (const endpoint of network.rpcUrls) {
      try {
        await this.verifyEndpointChain(network, endpoint, signal);
        return await this.requestEndpoint(network, endpoint, method, params, signal);
      } catch (error) {
        failures.push(error);
        if (signal?.aborted) {
          throw error;
        }
      }
    }

    throw new EvmRpcError(`All RPC endpoints failed for ${network.name}`, {
      code: 'ALL_ENDPOINTS_FAILED',
      networkId,
      cause: new AggregateError(failures, `RPC failures for ${network.name}`),
    });
  }

  async verifyEndpointChain(network, endpoint, signal) {
    if (this.verifiedEndpoints.get(endpoint) === network.chainId) {
      return;
    }

    const chainIdResult = await this.requestEndpoint(
      network,
      endpoint,
      'eth_chainId',
      [],
      signal,
    );
    const chainId = Number(hexQuantityToBigInt(chainIdResult));
    if (chainId !== network.chainId) {
      throw new EvmRpcError(
        `RPC endpoint returned chain ${chainId}; expected ${network.chainId}`,
        {
          code: 'CHAIN_ID_MISMATCH',
          networkId: network.id,
          endpoint,
        },
      );
    }
    this.verifiedEndpoints.set(endpoint, chainId);
  }

  async requestEndpoint(network, endpoint, method, params, externalSignal) {
    const id = ++this.requestId;
    const requestSignal = createRequestSignal(this.timeoutMs, externalSignal);

    try {
      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: requestSignal.signal,
      });

      if (!response.ok) {
        throw new EvmRpcError(`RPC request failed with HTTP ${response.status}`, {
          code: 'RPC_HTTP_ERROR',
          networkId: network.id,
          endpoint,
        });
      }

      const payload = await response.json();
      if (!payload || payload.jsonrpc !== '2.0' || payload.id !== id) {
        throw new EvmRpcError('RPC endpoint returned an invalid JSON-RPC response', {
          code: 'INVALID_RPC_RESPONSE',
          networkId: network.id,
          endpoint,
        });
      }
      if (payload.error) {
        throw new EvmRpcError(payload.error.message || 'RPC endpoint returned an error', {
          code: 'RPC_RESPONSE_ERROR',
          networkId: network.id,
          endpoint,
          rpcCode: payload.error.code,
        });
      }
      if (payload.result === undefined) {
        throw new EvmRpcError('RPC response did not include a result', {
          code: 'INVALID_RPC_RESPONSE',
          networkId: network.id,
          endpoint,
        });
      }

      return payload.result;
    } catch (error) {
      if (error instanceof EvmRpcError) {
        throw error;
      }
      throw new EvmRpcError(`RPC request failed for ${network.name}`, {
        code: requestSignal.signal.aborted ? 'RPC_ABORTED' : 'RPC_NETWORK_ERROR',
        networkId: network.id,
        endpoint,
        cause: error,
      });
    } finally {
      requestSignal.cleanup();
    }
  }

  async getNativeBalance(address, networkId, options = {}) {
    const normalizedAddress = normalizeEvmAddress(address);
    const network = this.getNetwork(networkId);
    const result = await this.request(
      networkId,
      'eth_getBalance',
      [normalizedAddress, 'latest'],
      options,
    );
    const rawBalance = hexQuantityToBigInt(result);

    return Object.freeze({
      assetType: 'native',
      provider: 'public-rpc',
      networkId: network.id,
      networkName: network.name,
      chainId: network.chainId,
      contractAddress: null,
      tokenName: network.nativeCurrency.name,
      tokenSymbol: network.nativeCurrency.symbol,
      tokenDecimals: network.nativeCurrency.decimals,
      balanceRawInteger: rawBalance.toString(),
      balance: formatUnits(rawBalance, network.nativeCurrency.decimals),
      balanceUsd: null,
      tokenPriceUsd: null,
      thumbnail: null,
    });
  }

  async getNativeBalances(address, networkIds = [...this.networks.keys()], options = {}) {
    const normalizedAddress = normalizeEvmAddress(address);
    const results = await Promise.allSettled(
      networkIds.map((networkId) => this.getNativeBalance(normalizedAddress, networkId, options)),
    );
    const assets = [];
    const failures = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        assets.push(result.value);
      } else {
        const error = result.reason;
        failures.push(Object.freeze({
          networkId: networkIds[index],
          code: error?.code || 'EVM_RPC_ERROR',
          message: error?.message || 'Unknown EVM RPC error',
        }));
      }
    });

    return Object.freeze({
      address: normalizedAddress,
      assets: Object.freeze(assets),
      failures: Object.freeze(failures),
      complete: failures.length === 0,
    });
  }
}
