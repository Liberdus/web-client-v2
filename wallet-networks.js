const REQUIRED_NETWORKS = Object.freeze([
  Object.freeze({
    id: 'liberdus',
    name: 'Liberdus',
    shortName: 'LIB',
    chainId: 2220,
    nativeSymbol: 'LIB',
    source: 'liberdus',
  }),
  Object.freeze({
    id: 'ethereum',
    name: 'Ethereum',
    shortName: 'ETH',
    chainId: 1,
    nativeSymbol: 'ETH',
    source: 'evm',
  }),
  Object.freeze({
    id: 'bsc',
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    chainId: 56,
    nativeSymbol: 'BNB',
    source: 'evm',
  }),
  Object.freeze({
    id: 'polygon',
    name: 'Polygon',
    shortName: 'POL',
    chainId: 137,
    nativeSymbol: 'POL',
    source: 'evm',
  }),
]);

const REQUIRED_NETWORK_IDS = new Set(REQUIRED_NETWORKS.map((network) => network.id));

function decimalIsPositive(value) {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  try {
    return Number(value) > 0;
  } catch {
    return false;
  }
}

function formatUnits(value, decimals = 18) {
  const amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function normalizeLiberdusAsset(asset) {
  const tokenAmount = formatUnits(asset?.balance ?? 0n, 18);
  const price = Number(asset?.price);
  const tokenPriceUsd = Number.isFinite(price) && price >= 0 ? String(price) : null;
  const tokenValueUsd = tokenPriceUsd === null
    ? null
    : String(Number(tokenAmount) * price);

  return Object.freeze({
    key: 'liberdus:native',
    networkId: 'liberdus',
    chainId: 2220,
    contractAddress: asset?.contract || null,
    tokenType: 'native',
    tokenName: asset?.name || 'Liberdus',
    tokenSymbol: asset?.symbol || 'LIB',
    tokenPriceUsd,
    tokenAmount,
    tokenValueUsd,
    tokenDecimals: 18,
    logoUrl: asset?.img || './media/liberdus_logo_50.png',
    source: 'liberdus',
    walletAsset: asset || null,
  });
}

function normalizeEvmToken(token, network) {
  const contractAddress = typeof token?.contractAddress === 'string'
    ? token.contractAddress
    : null;
  return Object.freeze({
    key: `${network.id}:${contractAddress || 'native'}:${token?.tokenSymbol || network.nativeSymbol}`,
    networkId: network.id,
    chainId: network.chainId,
    contractAddress,
    tokenType: token?.tokenType || (contractAddress ? 'erc20' : 'native'),
    tokenName: token?.tokenName || network.nativeSymbol,
    tokenSymbol: token?.tokenSymbol || network.nativeSymbol,
    tokenPriceUsd: token?.tokenPriceUsd ?? null,
    tokenAmount: token?.tokenAmount ?? '0',
    tokenValueUsd: token?.tokenValueUsd ?? null,
    tokenDecimals: Number.isInteger(token?.tokenDecimals) ? token.tokenDecimals : 18,
    logoUrl: token?.logoUrl || null,
    source: 'evm',
    walletAsset: null,
  });
}

function placeholderEvmAsset(network) {
  return normalizeEvmToken({
    tokenName: network.nativeSymbol,
    tokenSymbol: network.nativeSymbol,
    tokenAmount: '0',
    tokenValueUsd: null,
  }, network);
}

function makeNetwork(definition, tokens, connected) {
  const assets = tokens.length > 0 ? tokens : [placeholderEvmAsset(definition)];
  const totalValueUsd = assets.reduce((total, asset) => {
    const value = Number(asset.tokenValueUsd);
    return Number.isFinite(value) ? total + value : total;
  }, 0);

  return Object.freeze({
    ...definition,
    connected,
    totalValueUsd: String(totalValueUsd),
    assets: Object.freeze(assets),
  });
}

function extraNetworkDefinitions(portfolio, tokens) {
  const chainsById = new Map(
    (portfolio?.chains || []).map((chain) => [chain.networkId, chain]),
  );
  const positiveNetworkIds = new Set(
    tokens
      .filter((token) => decimalIsPositive(token?.tokenAmount))
      .map((token) => token.networkId),
  );

  return [...positiveNetworkIds]
    .filter((networkId) => networkId && !REQUIRED_NETWORK_IDS.has(networkId))
    .map((networkId) => {
      const chain = chainsById.get(networkId);
      const networkTokens = tokens.filter((token) => token.networkId === networkId);
      const nativeToken = networkTokens.find((token) => !token.contractAddress);
      return Object.freeze({
        id: networkId,
        name: chain?.chain || networkTokens[0]?.chain || networkId,
        shortName: nativeToken?.tokenSymbol || networkId.toUpperCase(),
        chainId: chain?.chainId || networkTokens[0]?.chainId || null,
        nativeSymbol: nativeToken?.tokenSymbol || networkId.toUpperCase(),
        source: 'evm',
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function createWalletNetworkCatalog({ liberdusAsset = null, portfolio = null } = {}) {
  const portfolioTokens = Array.isArray(portfolio?.tokens) ? portfolio.tokens : [];
  const portfolioChainIds = new Set(
    (portfolio?.chains || []).map((chain) => chain.networkId),
  );
  const definitions = [
    ...REQUIRED_NETWORKS,
    ...extraNetworkDefinitions(portfolio, portfolioTokens),
  ];

  return Object.freeze(definitions.map((definition) => {
    if (definition.id === 'liberdus') {
      const asset = normalizeLiberdusAsset(liberdusAsset);
      return Object.freeze({
        ...definition,
        connected: true,
        totalValueUsd: asset.tokenValueUsd,
        assets: Object.freeze([asset]),
      });
    }

    const assets = portfolioTokens
      .filter((token) => token.networkId === definition.id)
      .map((token) => normalizeEvmToken(token, definition));
    return makeNetwork(definition, assets, portfolioChainIds.has(definition.id));
  }));
}

export function getWalletNetwork(catalog, networkId) {
  return catalog.find((network) => network.id === networkId) || catalog[0] || null;
}

export function getEvmWalletNetworks(catalog) {
  if (!Array.isArray(catalog)) return Object.freeze([]);
  return Object.freeze(catalog.filter((network) => network.source === 'evm'));
}

export function calculateCatalogTotalUsd(catalog) {
  let total = 0;
  let hasValue = false;

  for (const network of catalog) {
    for (const asset of network.assets) {
      if (asset.tokenValueUsd === null || asset.tokenValueUsd === undefined || asset.tokenValueUsd === '') {
        continue;
      }
      const value = Number(asset.tokenValueUsd);
      if (Number.isFinite(value)) {
        total += value;
        hasValue = true;
      }
    }
  }

  return hasValue ? total : null;
}

export function walletProbeAddress(address) {
  const normalized = String(address || '').trim().toLowerCase();
  const withPrefix = normalized.startsWith('0x') ? normalized : `0x${normalized}`;
  if (!/^0x[0-9a-f]{40}$/.test(withPrefix)) {
    throw new TypeError('Wallet address must be a 20-byte hexadecimal value');
  }
  return withPrefix;
}
