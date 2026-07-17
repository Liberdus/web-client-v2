import { normalizeEvmAddress } from '../evm/identity.js';
import { DEFAULT_EVM_NETWORKS } from '../evm/networks.js';

function assetKey(asset) {
  return `${asset.networkId}:${asset.contractAddress || 'native'}`;
}

function deduplicateAssets(nativeAssets, indexedAssets) {
  const assets = new Map(nativeAssets.map((asset) => [assetKey(asset), asset]));
  for (const asset of indexedAssets) {
    assets.set(assetKey(asset), asset);
  }
  return [...assets.values()];
}

function decimalToScaledInteger(value, scale = 2) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) {
    return null;
  }

  const [whole, fraction = ''] = value.split('.');
  const keptFraction = fraction.slice(0, scale).padEnd(scale, '0');
  const nextDigit = fraction[scale] || '0';
  let result = BigInt(whole) * (10n ** BigInt(scale)) + BigInt(keptFraction || '0');
  if (nextDigit >= '5') {
    result += 1n;
  }
  return result;
}

function formatScaledInteger(value, scale = 2) {
  const divisor = 10n ** BigInt(scale);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(scale, '0');
  return `${whole}.${fraction}`;
}

function normalizeUsdValue(value) {
  const scaledValue = decimalToScaledInteger(value);
  return scaledValue === null ? null : formatScaledInteger(scaledValue);
}

export function calculateTotalBalanceUsd(assets) {
  let total = 0n;
  let pricedAssets = 0;

  for (const asset of assets) {
    const scaledValue = decimalToScaledInteger(asset.balanceUsd);
    if (scaledValue !== null) {
      total += scaledValue;
      pricedAssets += 1;
    }
  }

  return pricedAssets > 0 ? formatScaledInteger(total) : null;
}

export function groupAssetsByNetwork(assets, networks = DEFAULT_EVM_NETWORKS) {
  const assetsByNetwork = new Map(networks.map((network) => [network.id, []]));
  for (const asset of assets) {
    if (!assetsByNetwork.has(asset.networkId)) {
      assetsByNetwork.set(asset.networkId, []);
    }
    assetsByNetwork.get(asset.networkId).push(asset);
  }

  return networks.map((network) => Object.freeze({
    networkId: network.id,
    networkName: network.name,
    chainId: network.chainId,
    assets: Object.freeze(
      assetsByNetwork.get(network.id).sort((left, right) => {
        if (left.assetType === right.assetType) {
          return left.tokenSymbol.localeCompare(right.tokenSymbol);
        }
        return left.assetType === 'native' ? -1 : 1;
      }),
    ),
  }));
}

export function createWalletProbe({
  rpcPool,
  tokenProvider = null,
  networks = DEFAULT_EVM_NETWORKS,
} = {}) {
  if (!rpcPool || typeof rpcPool.getNativeBalances !== 'function') {
    throw new TypeError('Wallet probe requires an EVM RPC pool');
  }

  const networksById = new Map(networks.map((network) => [network.id, network]));

  return async function probeWallet(address, networkIds = [...networksById.keys()], options = {}) {
    const normalizedAddress = normalizeEvmAddress(address);
    for (const networkId of networkIds) {
      if (!networksById.has(networkId)) {
        throw new TypeError(`Unsupported EVM network: ${networkId}`);
      }
    }

    const selectedNetworks = networkIds.map((networkId) => networksById.get(networkId));
    const nativePromise = rpcPool.getNativeBalances(normalizedAddress, networkIds, options);
    const indexedPromise = tokenProvider
      ? tokenProvider.discoverAssets(normalizedAddress, networkIds, options)
      : Promise.resolve(null);
    const [nativeResult, indexedResult] = await Promise.allSettled([nativePromise, indexedPromise]);

    if (nativeResult.status === 'rejected' && indexedResult.status === 'rejected') {
      throw new AggregateError(
        [nativeResult.reason, indexedResult.reason],
        'Native and indexed portfolio providers both failed',
      );
    }

    const nativePortfolio = nativeResult.status === 'fulfilled'
      ? nativeResult.value
      : { assets: [], failures: [{
        networkId: null,
        code: nativeResult.reason?.code || 'NATIVE_PROBE_FAILED',
        message: nativeResult.reason?.message || 'Native balance probe failed',
      }] };
    const indexedPortfolio = indexedResult.status === 'fulfilled'
      ? indexedResult.value
      : null;
    const failures = [...(nativePortfolio.failures || [])];

    if (tokenProvider && indexedResult.status === 'rejected') {
      failures.push({
        networkId: null,
        code: indexedResult.reason?.code || 'TOKEN_DISCOVERY_FAILED',
        message: indexedResult.reason?.message || 'Indexed token discovery failed',
      });
    }

    const assets = deduplicateAssets(
      nativePortfolio.assets || [],
      indexedPortfolio?.assets || [],
    );
    const totalBalanceUsd = normalizeUsdValue(indexedPortfolio?.totalBalanceUsd)
      || calculateTotalBalanceUsd(assets);

    return Object.freeze({
      address: normalizedAddress,
      totalBalanceUsd,
      indexedTokenDiscovery: Boolean(indexedPortfolio),
      complete: failures.length === 0 && Boolean(indexedPortfolio || !tokenProvider),
      networks: Object.freeze(groupAssetsByNetwork(assets, selectedNetworks)),
      failures: Object.freeze(failures),
    });
  };
}

function pluralizeTokens(count) {
  return `${count} ${count === 1 ? 'token' : 'tokens'}`;
}

function formatAsset(asset) {
  const normalizedUsdValue = normalizeUsdValue(asset.balanceUsd);
  const usdValue = normalizedUsdValue === null
    ? ''
    : ` ($${normalizedUsdValue})`;
  return `  ${asset.balance} ${asset.tokenSymbol}${usdValue}`;
}

export function formatPortfolioText(portfolio) {
  const lines = [];
  lines.push(
    portfolio.totalBalanceUsd === null
      ? 'Total value across all chains: unavailable'
      : `Total value across all chains: $${portfolio.totalBalanceUsd}`,
  );
  lines.push(`Available balances for ${portfolio.address}:`);

  for (const network of portfolio.networks) {
    lines.push(`${network.networkName} (${pluralizeTokens(network.assets.length)}):`);
    if (network.assets.length === 0) {
      lines.push('  No balances reported');
    } else {
      lines.push(...network.assets.map(formatAsset));
    }
  }

  if (!portfolio.indexedTokenDiscovery) {
    lines.push('Token discovery: native balances only; configure ANKR_API_TOKEN for ERC-20 holdings and USD totals.');
  }
  if (portfolio.failures.length > 0) {
    lines.push('Warnings:');
    for (const failure of portfolio.failures) {
      lines.push(`  ${failure.networkId || 'portfolio'}: ${failure.message}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function assetValueUsd(asset) {
  if (asset.balanceUsd !== null && asset.balanceUsd !== undefined) {
    return String(asset.balanceUsd);
  }
  return asset.balanceRawInteger === '0' ? '0' : null;
}

function serializeToken(asset) {
  return Object.freeze({
    chain: asset.networkName,
    networkId: asset.networkId,
    chainId: asset.chainId,
    contractAddress: asset.contractAddress,
    tokenType: asset.assetType,
    tokenName: asset.tokenName,
    tokenSymbol: asset.tokenSymbol,
    tokenPriceUsd: asset.tokenPriceUsd,
    tokenAmount: asset.balance,
    tokenValueUsd: assetValueUsd(asset),
    tokenDecimals: asset.tokenDecimals,
    rawAmount: asset.balanceRawInteger,
    logoUrl: asset.thumbnail,
  });
}

export function createPortfolioJson(portfolio, { updatedAt = new Date().toISOString() } = {}) {
  const tokens = portfolio.networks.flatMap((network) => network.assets.map(serializeToken));
  const chains = portfolio.networks.map((network) => {
    const chainValues = network.assets.map((asset) => ({
      balanceUsd: assetValueUsd(asset),
    }));
    return Object.freeze({
      chain: network.networkName,
      networkId: network.networkId,
      chainId: network.chainId,
      tokenCount: network.assets.length,
      totalValueUsd: calculateTotalBalanceUsd(chainValues),
    });
  });

  return Object.freeze({
    walletAddress: portfolio.address,
    totalValueUsd: portfolio.totalBalanceUsd,
    chainCount: chains.length,
    tokenCount: tokens.length,
    indexedTokenDiscovery: portfolio.indexedTokenDiscovery,
    complete: portfolio.complete,
    updatedAt,
    chains: Object.freeze(chains),
    tokens: Object.freeze(tokens),
    warnings: portfolio.failures,
  });
}
