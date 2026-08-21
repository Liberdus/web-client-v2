import {
  BUTTON_COOLDOWN_MS,
  escapeHtml,
  normalizeUsername,
  openModal,
  utf82bin,
  withButtonCooldown,
} from './lib.js';
import { getPublicKey, hashBytes, signMessage } from './crypto.js';
import keccak256 from './external/keccak256.js';

const DEFAULT_WALLET_PROBE_BASE_URL = 'https://163.245.216.178';
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const EVM_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ERC20_TRANSFER_SELECTOR = 'a9059cbb';
const EVM_REQUEST_TIMEOUT_MS = 20_000;
const EVM_RECEIPT_TIMEOUT_MS = 60_000;
const EVM_RECEIPT_POLL_MS = 2_000;
const LIBERDUS_USERNAME_LOOKUP_DELAY_MS = 1_000;
const LIBERDUS_USERNAME_LOOKUP_TIMEOUT_MS = 15_000;
const DEFAULT_EVM_RPC_URLS = Object.freeze({
  ethereum: Object.freeze([
    'https://ethereum-rpc.publicnode.com',
    'https://eth.drpc.org',
  ]),
  polygon: Object.freeze([
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon.drpc.org',
  ]),
  arbitrum: Object.freeze([
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arb1.arbitrum.io/rpc',
  ]),
  optimism: Object.freeze([
    'https://optimism-rpc.publicnode.com',
    'https://mainnet.optimism.io',
  ]),
  base: Object.freeze([
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
  ]),
  bsc: Object.freeze([
    'https://bsc-rpc.publicnode.com',
    'https://bsc-dataseed.binance.org',
  ]),
});

export class EvmTransferError extends Error {
  constructor(message, code = 'EVM_TRANSFER_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'EvmTransferError';
    this.code = code;
    this.transactionHash = details.transactionHash || null;
  }
}

function stripHexPrefix(value) {
  return String(value || '').replace(/^0x/i, '');
}

function bytesToHex(bytes) {
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function hexToBytes(value, name = 'hex value') {
  const hex = stripHexPrefix(value);
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) {
    throw new EvmTransferError(`${name} must be an even-length hexadecimal value`, 'INVALID_HEX');
  }
  return Uint8Array.from(hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || []);
}

function concatBytes(...values) {
  const length = values.reduce((total, value) => total + value.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const value of values) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

function bigIntToBytes(value) {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  if (amount < 0n) {
    throw new EvmTransferError('EVM transaction values cannot be negative', 'NEGATIVE_QUANTITY');
  }
  if (amount === 0n) return new Uint8Array();
  const hex = amount.toString(16).padStart(Math.ceil(amount.toString(16).length / 2) * 2, '0');
  return hexToBytes(hex);
}

function rlpLengthPrefix(length, offset) {
  if (length < 56) return Uint8Array.of(offset + length);
  const lengthBytes = bigIntToBytes(BigInt(length));
  return concatBytes(Uint8Array.of(offset + 55 + lengthBytes.length), lengthBytes);
}

function rlpEncode(value) {
  if (Array.isArray(value)) {
    const payload = concatBytes(...value.map((entry) => rlpEncode(entry)));
    return concatBytes(rlpLengthPrefix(payload.length, 0xc0), payload);
  }
  let bytes;
  if (value instanceof Uint8Array) {
    bytes = value;
  } else if (typeof value === 'bigint' || typeof value === 'number') {
    bytes = bigIntToBytes(BigInt(value));
  } else if (typeof value === 'string') {
    bytes = hexToBytes(value);
  } else {
    throw new EvmTransferError('Unsupported RLP transaction value', 'INVALID_TRANSACTION');
  }
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  return concatBytes(rlpLengthPrefix(bytes.length, 0x80), bytes);
}

function normalizeEvmAddress(value, name = 'address') {
  const address = String(value || '').trim();
  if (!EVM_ADDRESS_PATTERN.test(address)) {
    throw new EvmTransferError(`${name} must be a valid 0x wallet address`, 'INVALID_ADDRESS');
  }
  return address.toLowerCase();
}

function parseHexQuantity(value, name) {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) {
    throw new EvmTransferError(`${name} is not a valid EVM quantity`, 'INVALID_RPC_RESPONSE');
  }
  return BigInt(value);
}

function toHexQuantity(value) {
  const quantity = typeof value === 'bigint' ? value : BigInt(value);
  if (quantity < 0n) {
    throw new EvmTransferError('EVM quantities cannot be negative', 'NEGATIVE_QUANTITY');
  }
  return `0x${quantity.toString(16)}`;
}

function normalizePrivateKey(value) {
  const key = stripHexPrefix(value);
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new EvmTransferError('The active account does not have a valid secp256k1 key', 'INVALID_PRIVATE_KEY');
  }
  return key.toLowerCase();
}

function deriveAddress(privateKey) {
  const publicKey = getPublicKey(hexToBytes(privateKey, 'private key'));
  return bytesToHex(keccak256(publicKey.slice(1)).slice(-20)).toLowerCase();
}

function decimalAmountToRaw(value, decimals = 18, { allowZero = false } = {}) {
  const amount = String(value || '').trim();
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new EvmTransferError('Token decimals are unavailable', 'INVALID_DECIMALS');
  }
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(amount)) {
    throw new EvmTransferError('Enter a valid positive token amount', 'INVALID_AMOUNT');
  }
  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > decimals) {
    throw new EvmTransferError(
      `Amount exceeds the token's ${decimals}-decimal precision`,
      'AMOUNT_PRECISION',
    );
  }
  const raw = BigInt(`${whole}${fraction.padEnd(decimals, '0')}` || '0');
  if (raw < 0n || (!allowZero && raw === 0n)) {
    throw new EvmTransferError('Amount must be greater than zero', 'INVALID_AMOUNT');
  }
  return raw;
}

export function parseEvmTokenAmount(value, decimals = 18) {
  return decimalAmountToRaw(value, decimals);
}

export function encodeErc20Transfer(recipient, amount) {
  const address = stripHexPrefix(normalizeEvmAddress(recipient, 'recipient')).padStart(64, '0');
  const rawAmount = typeof amount === 'bigint' ? amount : BigInt(amount);
  if (rawAmount <= 0n) {
    throw new EvmTransferError('ERC-20 transfer amount must be positive', 'INVALID_AMOUNT');
  }
  const encodedAmount = rawAmount.toString(16).padStart(64, '0');
  return `0x${ERC20_TRANSFER_SELECTOR}${address}${encodedAmount}`;
}

export async function signEvmTransaction(transaction, privateKeyValue) {
  const privateKey = normalizePrivateKey(privateKeyValue);
  const chainId = BigInt(transaction.chainId);
  const nonce = parseHexQuantity(transaction.nonce, 'nonce');
  const gasLimit = parseHexQuantity(transaction.gasLimit, 'gasLimit');
  const to = hexToBytes(normalizeEvmAddress(transaction.to, 'transaction recipient'));
  const value = parseHexQuantity(transaction.value, 'value');
  const data = hexToBytes(transaction.data || '0x', 'transaction data');

  if (transaction.feeMode === 'eip1559') {
    const maxPriorityFeePerGas = parseHexQuantity(
      transaction.maxPriorityFeePerGas,
      'maxPriorityFeePerGas',
    );
    const maxFeePerGas = parseHexQuantity(transaction.maxFeePerGas, 'maxFeePerGas');
    const unsigned = [
      chainId,
      nonce,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit,
      to,
      value,
      data,
      [],
    ];
    const signingPayload = concatBytes(Uint8Array.of(0x02), rlpEncode(unsigned));
    const signature = await signMessage(keccak256(signingPayload), hexToBytes(privateKey));
    const signed = rlpEncode([
      ...unsigned,
      BigInt(signature.recovery & 1),
      signature.r,
      signature.s,
    ]);
    return bytesToHex(concatBytes(Uint8Array.of(0x02), signed));
  }

  if (transaction.feeMode === 'legacy') {
    const gasPrice = parseHexQuantity(transaction.gasPrice, 'gasPrice');
    const unsigned = [nonce, gasPrice, gasLimit, to, value, data, chainId, 0n, 0n];
    const signature = await signMessage(keccak256(rlpEncode(unsigned)), hexToBytes(privateKey));
    const recovery = BigInt(signature.recovery & 1);
    const v = (chainId * 2n) + 35n + recovery;
    return bytesToHex(rlpEncode([
      nonce,
      gasPrice,
      gasLimit,
      to,
      value,
      data,
      v,
      signature.r,
      signature.s,
    ]));
  }

  throw new EvmTransferError('The selected network uses an unsupported fee mode', 'UNSUPPORTED_FEE_MODE');
}

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
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    explorerUrl: 'https://etherscan.io',
    source: 'evm',
    rpcUrls: DEFAULT_EVM_RPC_URLS.ethereum,
  }),
  Object.freeze({
    id: 'bsc',
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    chainId: 56,
    nativeSymbol: 'BNB',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    explorerUrl: 'https://bscscan.com',
    source: 'evm',
    rpcUrls: DEFAULT_EVM_RPC_URLS.bsc,
  }),
  Object.freeze({
    id: 'polygon',
    name: 'Polygon',
    shortName: 'POL',
    chainId: 137,
    nativeSymbol: 'POL',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    explorerUrl: 'https://polygonscan.com',
    source: 'evm',
    rpcUrls: DEFAULT_EVM_RPC_URLS.polygon,
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
    rawAmount: typeof token?.rawAmount === 'string' ? token.rawAmount : null,
    logoUrl: token?.logoUrl || (!contractAddress ? network.logoUrl : null),
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
        rpcUrls: DEFAULT_EVM_RPC_URLS[networkId] || Object.freeze([]),
        explorerUrl: chain?.explorerUrl || null,
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createWalletNetworkCatalog({ liberdusAsset = null, portfolio = null } = {}) {
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

function getWalletNetwork(catalog, networkId) {
  return catalog.find((network) => network.id === networkId) || catalog[0] || null;
}

function getEvmWalletNetworks(catalog) {
  if (!Array.isArray(catalog)) return Object.freeze([]);
  return Object.freeze(catalog.filter((network) => network.source === 'evm'));
}

function calculateCatalogTotalUsd(catalog) {
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

function walletProbeAddress(address) {
  const normalized = String(address || '').trim().toLowerCase();
  const withPrefix = normalized.startsWith('0x') ? normalized : `0x${normalized}`;
  if (!/^0x[0-9a-f]{40}$/.test(withPrefix)) {
    throw new TypeError('Wallet address must be a 20-byte hexadecimal value');
  }
  return withPrefix;
}

function normalizeExplorerBaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function buildEvmTokenExplorerUrl(walletNetwork, contractAddress) {
  const explorerBaseUrl = normalizeExplorerBaseUrl(walletNetwork?.explorerUrl);
  if (!explorerBaseUrl || !contractAddress) return null;

  try {
    const contract = normalizeEvmAddress(contractAddress, 'token contract');
    return new URL(`token/${contract}`, explorerBaseUrl).toString();
  } catch {
    return null;
  }
}

export function buildEvmAssetHistoryUrl(walletNetwork, asset, walletAddress) {
  const address = walletProbeAddress(walletAddress);
  let url;
  if (asset?.contractAddress) {
    const tokenExplorerUrl = buildEvmTokenExplorerUrl(walletNetwork, asset.contractAddress);
    if (!tokenExplorerUrl) return null;
    url = new URL(tokenExplorerUrl);
    url.searchParams.set('a', address);
  } else {
    const explorerBaseUrl = normalizeExplorerBaseUrl(walletNetwork?.explorerUrl);
    if (!explorerBaseUrl) return null;
    url = new URL(`address/${address}`, explorerBaseUrl);
  }
  url.hash = 'transactions';
  return url.toString();
}

function liberdusLookupAddress(address) {
  let normalized = String(address || '').trim().toLowerCase().replace(/^0x/, '');
  if (/^[0-9a-f]{64}$/.test(normalized) && normalized.endsWith('0'.repeat(24))) {
    normalized = normalized.slice(0, 40);
  }
  return walletProbeAddress(normalized);
}

function getDefaultLiberdusGatewayUrl() {
  const override = globalThis.window?.LIBERDUS_USERNAME_GATEWAY_URL;
  if (typeof override === 'string' && override.trim()) {
    return override.trim().replace(/\/$/, '');
  }

  // network.js is loaded as a classic script before this module. Its global lexical
  // binding is available here even though it is intentionally not attached to window.
  if (typeof network !== 'undefined' && Array.isArray(network?.gateways)) {
    const gateway = network.gateways.find((entry) => typeof entry?.web === 'string');
    if (gateway?.web) return gateway.web.replace(/\/$/, '');
  }
  return null;
}

export class LiberdusEvmRecipientResolver {
  constructor({
    getAccount = () => null,
    getGatewayUrl = getDefaultLiberdusGatewayUrl,
    fetchFn = (...args) => fetch(...args),
    requestTimeoutMs = LIBERDUS_USERNAME_LOOKUP_TIMEOUT_MS,
  } = {}) {
    this.getAccount = getAccount;
    this.getGatewayUrl = getGatewayUrl;
    this.fetchFn = fetchFn;
    this.requestTimeoutMs = requestTimeoutMs;
    this.associations = new Map();
  }

  reset() {
    this.associations.clear();
  }

  normalizeRecipientInput(value) {
    const input = String(value || '').trim();
    if (EVM_ADDRESS_PATTERN.test(input)) {
      return Object.freeze({ kind: 'address', input, display: input, username: null });
    }
    const username = normalizeUsername(input);
    return Object.freeze({ kind: 'username', input: username, display: username, username });
  }

  async resolve(value, { force = false } = {}) {
    const recipient = this.normalizeRecipientInput(value);
    if (recipient.kind === 'address') {
      return Object.freeze({
        ...recipient,
        address: normalizeEvmAddress(recipient.input, 'recipient'),
        verifiedAt: Date.now(),
      });
    }

    if (recipient.username.length < 3) {
      throw new EvmTransferError('Username is too short', 'USERNAME_TOO_SHORT');
    }

    if (!force) {
      const cached = this.associations.get(recipient.username);
      if (cached) return cached;
    }

    const gatewayUrl = this.getGatewayUrl();
    if (!gatewayUrl) {
      throw new EvmTransferError(
        'Liberdus username lookup is unavailable',
        'USERNAME_LOOKUP_UNAVAILABLE',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const usernameHash = hashBytes(utf82bin(recipient.username));
      const response = await this.fetchFn(`${gatewayUrl}/address/${usernameHash}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new EvmTransferError(
          `Liberdus username lookup returned HTTP ${response.status}`,
          'USERNAME_LOOKUP_UNAVAILABLE',
        );
      }
      const data = await response.json();
      if (!data?.address) {
        throw new EvmTransferError('Username not found', 'USERNAME_NOT_FOUND');
      }

      let address;
      try {
        address = liberdusLookupAddress(data.address);
      } catch (error) {
        throw new EvmTransferError(
          'The username does not have a valid EVM wallet address',
          'USERNAME_ADDRESS_INVALID',
          { cause: error },
        );
      }

      const ownAddress = walletProbeAddress(this.getAccount()?.keys?.address);
      if (address === ownAddress) {
        throw new EvmTransferError(
          'Enter another user’s username',
          'USERNAME_IS_SELF',
        );
      }

      const association = Object.freeze({
        ...recipient,
        address,
        verifiedAt: Date.now(),
      });
      this.associations.set(recipient.username, association);
      return association;
    } catch (error) {
      if (error instanceof EvmTransferError) throw error;
      throw new EvmTransferError(
        controller.signal.aborted
          ? 'Liberdus username lookup timed out'
          : 'Liberdus username lookup failed',
        controller.signal.aborted ? 'USERNAME_LOOKUP_TIMEOUT' : 'USERNAME_LOOKUP_UNAVAILABLE',
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

class WalletDiscoveryService {
  constructor({
    getAccount = () => null,
    getLiberdusAsset = () => null,
    cacheTtlMs = 5000,
    requestTimeoutMs = 15000,
  } = {}) {
    if (typeof getAccount !== 'function' || typeof getLiberdusAsset !== 'function') {
      throw new TypeError('Wallet discovery state providers must be functions');
    }
    this.getAccount = getAccount;
    this.getLiberdusAsset = getLiberdusAsset;
    this.cacheTtlMs = cacheTtlMs;
    this.requestTimeoutMs = requestTimeoutMs;
    this.requestController = null;
    this.reset();
  }

  reset() {
    this.requestController?.abort();
    this.portfolio = null;
    this.catalog = createWalletNetworkCatalog();
    this.status = 'idle';
    this.updatedAt = 0;
    this.pendingRequest = null;
    this.address = null;
    this.requestController = null;
  }

  rebuildCatalog() {
    this.catalog = createWalletNetworkCatalog({
      liberdusAsset: this.getLiberdusAsset(),
      portfolio: this.portfolio,
    });
    return this.catalog;
  }

  getCatalog() {
    return this.rebuildCatalog();
  }

  getEvmCatalog() {
    return getEvmWalletNetworks(this.getCatalog());
  }

  getTotalUsd({ evmOnly = false } = {}) {
    const catalog = evmOnly ? this.getEvmCatalog() : this.getCatalog();
    return calculateCatalogTotalUsd(catalog);
  }

  getStatus() {
    return this.status;
  }

  getUpdatedAt() {
    return this.updatedAt;
  }

  getNetwork(networkId) {
    return getWalletNetwork(this.getCatalog(), networkId);
  }

  getSelectedAsset(networkId, select) {
    const walletNetwork = this.getNetwork(networkId);
    if (!walletNetwork) return null;
    return walletNetwork.assets.find((asset) => asset.key === select?.value)
      || walletNetwork.assets[0]
      || null;
  }

  findAsset(networkId, assetKey, { evmOnly = false } = {}) {
    const catalog = evmOnly ? this.getEvmCatalog() : this.getCatalog();
    const walletNetwork = catalog.find((network) => network.id === networkId) || null;
    const asset = walletNetwork?.assets.find((entry) => entry.key === assetKey) || null;
    return { walletNetwork, asset };
  }

  getProbeBaseUrl() {
    const configured = typeof window.LIBERDUS_WALLET_PROBE_BASE_URL === 'string'
      ? window.LIBERDUS_WALLET_PROBE_BASE_URL.trim()
      : '';
    return (configured || DEFAULT_WALLET_PROBE_BASE_URL).replace(/\/+$/, '');
  }

  getRpcUrl(networkId) {
    if (!/^[a-z0-9-]+$/.test(networkId || '')) return null;
    return `${this.getProbeBaseUrl()}/api/rpc/${networkId}`;
  }

  activateAddress(address) {
    if (this.address === address) return;
    this.requestController?.abort();
    this.portfolio = null;
    this.catalog = createWalletNetworkCatalog();
    this.status = 'idle';
    this.updatedAt = 0;
    this.pendingRequest = null;
    this.address = address;
    this.requestController = null;
  }

  async refresh({ force = false } = {}) {
    const account = this.getAccount();
    if (!account?.keys?.address) {
      return this.getCatalog();
    }

    const address = walletProbeAddress(account.keys.address);
    this.activateAddress(address);

    const now = Date.now();
    if (!force && this.updatedAt && now - this.updatedAt < this.cacheTtlMs) {
      return this.getCatalog();
    }
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    this.status = 'loading';
    const controller = new AbortController();
    this.requestController = controller;
    const request = this.fetchPortfolio(address, controller);
    this.pendingRequest = request;

    try {
      return await request;
    } finally {
      if (this.pendingRequest === request) {
        this.pendingRequest = null;
      }
      if (this.requestController === controller) {
        this.requestController = null;
      }
    }
  }

  async fetchPortfolio(address, controller) {
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(
        `${this.getProbeBaseUrl()}/?wallet=${encodeURIComponent(address)}`,
        {
          headers: { accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Wallet network service returned HTTP ${response.status}`);
      }

      const portfolio = await response.json();
      if (!portfolio || !Array.isArray(portfolio.chains) || !Array.isArray(portfolio.tokens)) {
        throw new TypeError('Wallet network service returned an invalid portfolio');
      }
      if (this.address !== address) {
        return this.rebuildCatalog();
      }

      this.portfolio = portfolio;
      this.status = portfolio.complete ? 'connected' : 'partial';
      this.updatedAt = Date.now();
      return this.rebuildCatalog();
    } catch (error) {
      if (this.address === address) {
        this.status = 'unavailable';
        console.warn('Connected wallet network discovery unavailable:', error);
      }
      return this.rebuildCatalog();
    } finally {
      clearTimeout(timeout);
    }
  }

  populateNetworkSelect(select, { includeAll = false, selectedId = null, evmOnly = false } = {}) {
    if (!select) return;

    const previousValue = selectedId || select.value;
    const catalog = evmOnly ? this.getEvmCatalog() : this.getCatalog();
    const fragment = document.createDocumentFragment();
    if (includeAll) {
      const allOption = document.createElement('option');
      allOption.value = 'all';
      allOption.textContent = 'All connected networks';
      fragment.appendChild(allOption);
    }

    for (const walletNetwork of catalog) {
      const option = document.createElement('option');
      option.value = walletNetwork.id;
      option.textContent = `${walletNetwork.name} (${walletNetwork.shortName})`;
      fragment.appendChild(option);
    }

    select.replaceChildren(fragment);
    const availableValues = new Set([...select.options].map((option) => option.value));
    select.value = availableValues.has(previousValue)
      ? previousValue
      : (includeAll ? 'all' : (evmOnly ? (catalog[0]?.id || '') : 'liberdus'));
  }

  populateAssetSelect(select, networkId) {
    if (!select) return;
    const walletNetwork = this.getNetwork(networkId);
    if (!walletNetwork) return;

    const fragment = document.createDocumentFragment();
    for (const asset of walletNetwork.assets) {
      const option = document.createElement('option');
      option.value = asset.key;
      option.textContent = `${asset.tokenName} (${asset.tokenSymbol})`;
      fragment.appendChild(option);
    }
    select.replaceChildren(fragment);
  }

  getConnectionText() {
    const connectedNetworks = this.getEvmCatalog().filter((walletNetwork) => walletNetwork.connected);
    if (this.status === 'loading') {
      return 'Connecting wallet networks…';
    }
    if (this.status === 'unavailable') {
      return 'Wallet network service unavailable';
    }
    if (this.status === 'partial') {
      return `${connectedNetworks.length} EVM networks connected with warnings`;
    }
    if (this.status === 'connected') {
      return `${connectedNetworks.length} EVM networks connected`;
    }
    return 'Liberdus connected';
  }
}

export class EvmTransactionService {
  constructor({
    getAccount,
    refreshAssets,
    showToast,
    confirmTransfer,
    getManagedRpcUrl = () => null,
    fetchFn = (...args) => fetch(...args),
  }) {
    this.getAccount = getAccount;
    this.refreshAssets = refreshAssets;
    this.showToast = showToast;
    this.confirmTransfer = confirmTransfer;
    this.getManagedRpcUrl = getManagedRpcUrl;
    this.fetchFn = fetchFn;
    this.requestId = 0;
    this.verifiedRpcEndpoints = new Map();
  }

  validate({ network, asset, recipient, amount }) {
    try {
      if (!network || network.source !== 'evm' || !Number.isSafeInteger(network.chainId)) {
        throw new EvmTransferError('Select a supported EVM network', 'INVALID_NETWORK');
      }
      if (!asset || asset.source !== 'evm' || asset.networkId !== network.id) {
        throw new EvmTransferError('Select an available EVM asset', 'INVALID_ASSET');
      }
      this.getRpcUrls(network);
      const account = this.getAccount();
      const privateKey = normalizePrivateKey(account?.keys?.secret);
      const from = normalizeEvmAddress(
        walletProbeAddress(account?.keys?.address),
        'active account address',
      );
      if (deriveAddress(privateKey) !== from) {
        throw new EvmTransferError(
          'The active account key does not match its EVM address',
          'ACCOUNT_KEY_MISMATCH',
        );
      }
      const normalizedRecipient = normalizeEvmAddress(recipient, 'recipient');
      const amountRaw = parseEvmTokenAmount(amount, asset.tokenDecimals);
      const availableRaw = typeof asset.rawAmount === 'string'
        ? BigInt(asset.rawAmount)
        : decimalAmountToRaw(asset.tokenAmount || '0', asset.tokenDecimals, { allowZero: true });
      if (amountRaw > availableRaw) {
        throw new EvmTransferError(`Insufficient ${asset.tokenSymbol} balance`, 'INSUFFICIENT_TOKEN');
      }
      return {
        valid: true,
        message: '',
        account,
        privateKey,
        from,
        recipient: normalizedRecipient,
        amountRaw,
        availableRaw,
      };
    } catch (error) {
      return {
        valid: false,
        message: error?.message || 'EVM transfer details are invalid',
        error,
      };
    }
  }

  getRpcUrls(network) {
    const runtimeUrls = globalThis.window?.LIBERDUS_EVM_RPC_URLS?.[network.id];
    const managedRpcUrl = this.getManagedRpcUrl(network);
    const urls = Array.isArray(runtimeUrls) && runtimeUrls.length > 0
      ? runtimeUrls
      : [managedRpcUrl, ...(network.rpcUrls || [])].filter(Boolean);
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new EvmTransferError(
        `Sending is not configured for ${network.name}`,
        'RPC_NOT_CONFIGURED',
      );
    }
    return [...new Set(urls)];
  }

  async requestEndpoint(endpoint, method, params, networkId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EVM_REQUEST_TIMEOUT_MS);
    const id = ++this.requestId;
    try {
      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new EvmTransferError(
          `RPC returned HTTP ${response.status}`,
          'RPC_HTTP_ERROR',
        );
      }
      const payload = await response.json();
      if (!payload || payload.jsonrpc !== '2.0' || payload.id !== id) {
        throw new EvmTransferError('RPC returned an invalid response', 'INVALID_RPC_RESPONSE');
      }
      if (payload.error) {
        throw new EvmTransferError(
          payload.error.message || 'RPC rejected the request',
          'RPC_RESPONSE_ERROR',
        );
      }
      if (payload.result === undefined) {
        throw new EvmTransferError('RPC response did not include a result', 'INVALID_RPC_RESPONSE');
      }
      return payload.result;
    } catch (error) {
      if (error instanceof EvmTransferError) throw error;
      throw new EvmTransferError(
        controller.signal.aborted
          ? `${networkId} RPC request timed out`
          : `${networkId} RPC request failed`,
        controller.signal.aborted ? 'RPC_TIMEOUT' : 'RPC_UNAVAILABLE',
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async request(network, method, params = []) {
    const errors = [];
    for (const endpoint of this.getRpcUrls(network)) {
      try {
        if (this.verifiedRpcEndpoints.get(endpoint) !== network.chainId) {
          const rpcChainId = parseHexQuantity(
            await this.requestEndpoint(endpoint, 'eth_chainId', [], network.id),
            'chainId',
          );
          if (rpcChainId !== BigInt(network.chainId)) {
            throw new EvmTransferError(
              `RPC returned chain ${rpcChainId}; expected ${network.chainId}`,
              'CHAIN_ID_MISMATCH',
            );
          }
          this.verifiedRpcEndpoints.set(endpoint, network.chainId);
        }
        return await this.requestEndpoint(endpoint, method, params, network.id);
      } catch (error) {
        errors.push(error);
      }
    }
    const finalError = errors.at(-1);
    throw new EvmTransferError(
      finalError?.message
        ? `${network.name} RPC failed: ${finalError.message}`
        : `All ${network.name} RPC endpoints failed`,
      'ALL_RPC_ENDPOINTS_FAILED',
      { cause: new AggregateError(errors) },
    );
  }

  async prepare({ network, asset, recipient, amount }) {
    const validation = this.validate({ network, asset, recipient, amount });
    if (!validation.valid) throw validation.error;

    const isToken = Boolean(asset.contractAddress);
    const transactionTo = isToken
      ? normalizeEvmAddress(asset.contractAddress, 'token contract')
      : validation.recipient;
    const value = isToken ? 0n : validation.amountRaw;
    const data = isToken ? encodeErc20Transfer(validation.recipient, validation.amountRaw) : '0x';
    const transactionRequest = {
      from: validation.from,
      to: transactionTo,
      value: toHexQuantity(value),
      data,
    };
    const [nonceValue, nativeBalanceValue, gasEstimateValue, latestBlock] = await Promise.all([
      this.request(network, 'eth_getTransactionCount', [validation.from, 'pending']),
      this.request(network, 'eth_getBalance', [validation.from, 'pending']),
      this.request(network, 'eth_estimateGas', [transactionRequest]),
      this.request(network, 'eth_getBlockByNumber', ['latest', false]),
    ]);
    const gasEstimate = parseHexQuantity(gasEstimateValue, 'gas estimate');
    const gasLimit = gasEstimate + ((gasEstimate * 20n + 99n) / 100n);
    const prepared = {
      networkId: network.id,
      chainId: network.chainId,
      ...transactionRequest,
      nonce: toHexQuantity(parseHexQuantity(nonceValue, 'nonce')),
      nativeBalance: toHexQuantity(parseHexQuantity(nativeBalanceValue, 'native balance')),
      gasLimit: toHexQuantity(gasLimit),
    };
    if (typeof latestBlock?.baseFeePerGas === 'string') {
      const baseFee = parseHexQuantity(latestBlock.baseFeePerGas, 'base fee');
      let priorityFee = 1_500_000_000n;
      try {
        priorityFee = parseHexQuantity(
          await this.request(network, 'eth_maxPriorityFeePerGas'),
          'priority fee',
        );
      } catch {
        // A conservative priority fee fallback supports RPCs without this optional method.
      }
      prepared.feeMode = 'eip1559';
      prepared.maxPriorityFeePerGas = toHexQuantity(priorityFee);
      prepared.maxFeePerGas = toHexQuantity((baseFee * 2n) + priorityFee);
    } else {
      prepared.feeMode = 'legacy';
      prepared.gasPrice = toHexQuantity(parseHexQuantity(
        await this.request(network, 'eth_gasPrice'),
        'gas price',
      ));
    }

    const preparedGasLimit = parseHexQuantity(prepared.gasLimit, 'gasLimit');
    const feePerGas = prepared.feeMode === 'eip1559'
      ? parseHexQuantity(prepared.maxFeePerGas, 'maxFeePerGas')
      : parseHexQuantity(prepared.gasPrice, 'gasPrice');
    const maximumFee = preparedGasLimit * feePerGas;
    const nativeBalance = parseHexQuantity(prepared.nativeBalance, 'nativeBalance');
    const requiredNative = maximumFee + value;
    if (nativeBalance < requiredNative) {
      const requirement = isToken ? 'network fees' : 'the transfer and network fees';
      throw new EvmTransferError(
        `Insufficient ${network.nativeSymbol} for ${requirement}`,
        'INSUFFICIENT_GAS',
      );
    }

    return {
      network,
      asset,
      validation,
      maximumFee,
      displayAmount: String(amount),
      transaction: prepared,
    };
  }

  confirmationText(prepared, amount, recipientLabel = null) {
    const { network, asset, validation, maximumFee } = prepared;
    return [
      `Send ${amount} ${asset.tokenSymbol}?`,
      `Network: ${network.name}`,
      `Recipient: ${recipientLabel || validation.recipient}`,
      `Maximum network fee: ${formatUnits(maximumFee, 18)} ${network.nativeSymbol}`,
      '',
      'The transaction will be signed locally with this account.',
    ].join('\n');
  }

  async waitForReceipt(network, transactionHash) {
    const started = Date.now();
    while (Date.now() - started < EVM_RECEIPT_TIMEOUT_MS) {
      const receipt = await this.request(
        network,
        'eth_getTransactionReceipt',
        [transactionHash],
      );
      if (receipt) return receipt;
      await new Promise((resolve) => setTimeout(resolve, EVM_RECEIPT_POLL_MS));
    }
    return null;
  }

  async send({ network, asset, recipient, recipientLabel = null, amount }) {
    const prepared = await this.prepare({ network, asset, recipient, amount });
    prepared.recipientLabel = recipientLabel || prepared.validation.recipient;
    const confirmed = await this.confirmTransfer(
      this.confirmationText(prepared, amount, recipientLabel),
      prepared,
    );
    if (!confirmed) return { status: 'cancelled', transactionHash: null };

    const rawTransaction = await signEvmTransaction(
      prepared.transaction,
      prepared.validation.privateKey,
    );
    const broadcast = await this.request(
      network,
      'eth_sendRawTransaction',
      [rawTransaction],
    );
    if (!EVM_HASH_PATTERN.test(broadcast || '')) {
      throw new EvmTransferError('RPC returned an invalid transaction hash', 'INVALID_TX_HASH');
    }

    const transactionHash = broadcast.toLowerCase();
    this.showToast(`EVM transaction submitted: ${transactionHash}`, 5000, 'info');
    const receipt = await this.waitForReceipt(network, transactionHash);
    if (!receipt) {
      this.showToast('Transaction is pending. Balances will update after confirmation.', 5000, 'info');
      return { status: 'pending', transactionHash, receipt: null };
    }
    if (parseHexQuantity(receipt.status, 'receipt status') !== 1n) {
      throw new EvmTransferError(
        'The EVM transaction reverted',
        'TRANSACTION_REVERTED',
        { transactionHash },
      );
    }

    await this.refreshAssets({ force: true });
    this.showToast(`Transaction confirmed: ${transactionHash}`, 5000, 'success');
    return { status: 'confirmed', transactionHash, receipt };
  }
}

function formatConnectedTokenAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value ?? '0');
  if (amount === 0) return '0';
  if (Math.abs(amount) < 0.000001) {
    return amount.toExponential(4);
  }
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  });
}

function formatConnectedUsd(value) {
  if (value === null || value === undefined || value === '') {
    return 'Value unavailable';
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Value unavailable';
  return amount.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount > 0 && amount < 0.01 ? 6 : 2,
  });
}

function connectedAssetLogoMarkup(asset, walletNetwork) {
  const logoUrl = typeof asset.logoUrl === 'string' ? asset.logoUrl : '';
  if (/^(?:https:\/\/|\.\/)/.test(logoUrl)) {
    return `<img src="${escapeHtml(logoUrl)}" alt="" class="connected-asset-logo-image">`;
  }
  return `<span class="connected-asset-logo-fallback">${escapeHtml(walletNetwork.shortName.slice(0, 3))}</span>`;
}

function formatAssetDetailsUpdatedAt(timestamp) {
  if (!timestamp) return 'Updated just now';
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))}`;
}

function formatConnectedTokenType(asset) {
  const type = String(asset?.tokenType || '').toLowerCase();
  if (type === 'native') return 'Native asset';
  if (type === 'erc20') return 'ERC-20';
  return type ? type.toUpperCase() : 'Token';
}

class AssetsModal {
  constructor(controller) {
    this.controller = controller;
  }

  load() {
    this.modal = document.getElementById('assetsModal');
    this.totalBalance = document.getElementById('assetsTotalBalance');
    this.refreshButton = document.getElementById('refreshAssetsBalance');
    this.networkSelect = document.getElementById('assetsNetwork');
    this.connectionSummary = document.getElementById('assetsConnectionSummary');
    this.assetsList = document.getElementById('connectedAssetsList');

    document.getElementById('closeAssetsModal').addEventListener('click', () => this.close());
    this.networkSelect.addEventListener('change', () => this.render());
    this.assetsList.addEventListener('click', (event) => {
      const assetButton = event.target.closest('.connected-asset-button');
      if (!assetButton) return;
      this.controller.assetDetailsModal.open(
        assetButton.dataset.networkId,
        assetButton.dataset.assetKey,
      );
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

  async update({ force = false } = {}) {
    this.connectionSummary.textContent = 'Connecting wallet networks…';
    this.connectionSummary.dataset.status = 'loading';
    await this.controller.refresh({ force });

    const totalUsd = this.controller.getTotalUsd({ evmOnly: true });
    this.totalBalance.textContent = totalUsd === null ? 'N/A' : totalUsd.toFixed(2);
    this.controller.populateNetworkSelect(this.networkSelect, { includeAll: true, evmOnly: true });
    this.connectionSummary.textContent = this.controller.getConnectionText();
    this.connectionSummary.dataset.status = this.controller.getStatus();
    this.render();
  }

  render() {
    const catalog = this.controller.getEvmCatalog();
    const selectedNetworkId = this.networkSelect?.value || 'all';
    const visibleNetworks = selectedNetworkId === 'all'
      ? catalog
      : catalog.filter((walletNetwork) => walletNetwork.id === selectedNetworkId);

    if (visibleNetworks.length === 0) {
      this.assetsList.innerHTML = `
        <div class="empty-state">
          <div></div>
          <div>No EVM assets yet</div>
          <div>Refresh to check this wallet again</div>
        </div>
      `;
      return;
    }

    this.assetsList.innerHTML = visibleNetworks.map((walletNetwork) => `
      <section class="wallet-network-assets" data-network-id="${escapeHtml(walletNetwork.id)}">
        <div class="wallet-network-row">
          <div>
            <div class="wallet-network-name">${escapeHtml(walletNetwork.name)}</div>
            <div class="wallet-network-chain">Chain ID ${escapeHtml(String(walletNetwork.chainId ?? '—'))}</div>
          </div>
          <span class="wallet-network-status ${walletNetwork.connected ? 'connected' : 'available'}">
            ${walletNetwork.connected ? 'Connected' : 'Ready'}
          </span>
        </div>
        ${walletNetwork.assets.map((asset) => `
          <button
            type="button"
            class="asset-item connected-asset-item connected-asset-button"
            data-network-id="${escapeHtml(walletNetwork.id)}"
            data-asset-key="${escapeHtml(asset.key)}"
            aria-label="View ${escapeHtml(asset.tokenName)} details"
          >
            <div class="asset-logo connected-asset-logo">
              ${connectedAssetLogoMarkup(asset, walletNetwork)}
            </div>
            <div class="asset-info">
              <div class="asset-name">${escapeHtml(asset.tokenName)}</div>
              <div class="asset-symbol">
                ${asset.tokenPriceUsd === null ? '<span style="color: var(--danger-color)">$0</span>' : `${formatConnectedUsd(asset.tokenPriceUsd)} / ${escapeHtml(asset.tokenSymbol)}`}
              </div>
            </div>
            <div class="asset-balance">
              ${escapeHtml(formatConnectedTokenAmount(asset.tokenAmount))} ${escapeHtml(asset.tokenSymbol)}
              <br>
              <span class="asset-symbol">${escapeHtml(formatConnectedUsd(asset.tokenValueUsd))}</span>
            </div>
          </button>
        `).join('')}
      </section>
    `).join('');
  }
}

class AssetDetailsModal {
  constructor(controller) {
    this.controller = controller;
    this.networkId = null;
    this.assetKey = null;
  }

  load() {
    this.modal = document.getElementById('assetDetailsModal');
    this.title = document.getElementById('assetDetailsModalTitle');
    this.symbol = document.getElementById('assetDetailsSymbol');
    this.price = document.getElementById('assetDetailsPrice');
    this.updated = document.getElementById('assetDetailsUpdated');
    this.logo = document.getElementById('assetDetailsLogo');
    this.name = document.getElementById('assetDetailsName');
    this.balanceSymbol = document.getElementById('assetDetailsBalanceSymbol');
    this.value = document.getElementById('assetDetailsValue');
    this.amount = document.getElementById('assetDetailsAmount');
    this.network = document.getElementById('assetDetailsNetwork');
    this.chainId = document.getElementById('assetDetailsChainId');
    this.type = document.getElementById('assetDetailsType');
    this.decimals = document.getElementById('assetDetailsDecimals');
    this.contract = document.getElementById('assetDetailsContract');
    this.marketPrice = document.getElementById('assetDetailsMarketPrice');
    this.holdingValue = document.getElementById('assetDetailsHoldingValue');

    document.getElementById('closeAssetDetailsModal').addEventListener('click', () => this.close());
    document.getElementById('assetDetailsSend').addEventListener('click', () => {
      this.controller.openContextualSend({
        mode: 'evm',
        networkId: this.networkId,
        assetKey: this.assetKey,
      });
    });
    document.getElementById('assetDetailsReceive').addEventListener('click', () => {
      this.controller.openContextualReceive({
        mode: 'evm',
        networkId: this.networkId,
        assetKey: this.assetKey,
      });
    });
    document.getElementById('assetDetailsHistory').addEventListener('click', () => this.openHistory());
  }

  getSelection() {
    return this.controller.findAsset(this.networkId, this.assetKey, { evmOnly: true });
  }

  open(networkId, assetKey) {
    this.networkId = networkId;
    this.assetKey = assetKey;
    const { walletNetwork, asset } = this.getSelection();
    if (!walletNetwork || !asset) {
      this.controller.showToast(
        'This asset is no longer available. Refresh and try again.',
        3000,
        'warning',
      );
      return;
    }

    this.render(walletNetwork, asset);
    this.modal.querySelector('.modal-content').scrollTop = 0;
    openModal(this.modal);
  }

  render(walletNetwork, asset) {
    const priceText = asset.tokenPriceUsd === null
      ? '$0'
      : formatConnectedUsd(asset.tokenPriceUsd);
    const valueText = formatConnectedUsd(asset.tokenValueUsd);
    const amountText = `${formatConnectedTokenAmount(asset.tokenAmount)} ${asset.tokenSymbol}`;

    this.title.textContent = asset.tokenSymbol;
    this.symbol.textContent = asset.tokenName;
    this.price.textContent = priceText;
    this.price.style.color = asset.tokenPriceUsd === null ? 'var(--danger-color)' : '';
    this.updated.textContent = formatAssetDetailsUpdatedAt(this.controller.getUpdatedAt());
    this.logo.innerHTML = connectedAssetLogoMarkup(asset, walletNetwork);
    this.name.textContent = asset.tokenName;
    this.balanceSymbol.textContent = asset.tokenSymbol;
    this.value.textContent = valueText;
    this.amount.textContent = amountText;
    this.network.textContent = walletNetwork.name;
    this.chainId.textContent = walletNetwork.chainId ?? 'Unavailable';
    this.type.textContent = formatConnectedTokenType(asset);
    this.decimals.textContent = Number.isInteger(asset.tokenDecimals)
      ? String(asset.tokenDecimals)
      : 'Unavailable';
    const tokenExplorerUrl = buildEvmTokenExplorerUrl(walletNetwork, asset.contractAddress);
    this.contract.innerHTML = tokenExplorerUrl
      ? `<a href="${escapeHtml(tokenExplorerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(asset.contractAddress)}</a>`
      : escapeHtml(asset.contractAddress || 'Native asset — no contract');
    this.marketPrice.textContent = priceText;
    this.marketPrice.style.color = this.price.style.color;
    this.holdingValue.textContent = valueText;
  }

  openHistory() {
    const { walletNetwork, asset } = this.getSelection();
    if (!walletNetwork || !asset) {
      this.controller.showToast(
        'This asset is no longer available. Refresh and try again.',
        3000,
        'warning',
      );
      return;
    }

    let historyUrl;
    try {
      historyUrl = buildEvmAssetHistoryUrl(
        walletNetwork,
        asset,
        this.controller.getAccount()?.keys?.address,
      );
    } catch {
      this.controller.showToast(
        'Transaction history is unavailable for this asset.',
        3000,
        'warning',
      );
      return;
    }

    if (!historyUrl) {
      this.controller.showToast(
        `Transaction history is unavailable for ${walletNetwork.name}.`,
        3000,
        'warning',
      );
      return;
    }

    window.open(historyUrl, '_blank', 'noopener,noreferrer');
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

export class EvmSendConfirmationModal {
  constructor() {
    this.loaded = false;
    this.pending = null;
  }

  load() {
    if (this.loaded) return;
    this.modal = document.getElementById('sendAssetConfirmModal');
    this.details = this.modal?.querySelector('.confirmation-details');
    this.recipient = document.getElementById('confirmRecipient');
    this.amount = document.getElementById('confirmAmount');
    this.amountUsd = document.getElementById('confirmAmountUSD');
    this.asset = document.getElementById('confirmAsset');
    this.memoGroup = document.getElementById('confirmMemoGroup');
    this.confirmButton = document.getElementById('confirmSendButton');
    this.cancelButton = document.getElementById('cancelSendButton');
    this.closeButton = document.getElementById('closeSendAssetConfirmModal');
    if (
      !this.modal
      || !this.details
      || !this.recipient
      || !this.amount
      || !this.asset
      || !this.confirmButton
      || !this.cancelButton
    ) {
      return;
    }

    this.networkGroup = this.createDetailGroup(
      'evmConfirmNetworkGroup',
      'Network',
      'evmConfirmNetwork',
    );
    this.feeGroup = this.createDetailGroup(
      'evmConfirmFeeGroup',
      'Maximum network fee',
      'evmConfirmFee',
    );
    this.signingNotice = this.createSigningNotice();
    this.networkValue = this.networkGroup.querySelector('.confirm-value');
    this.feeValue = this.feeGroup.querySelector('.confirm-value');

    this.confirmButton.addEventListener(
      'click',
      (event) => this.handleAction(event, true),
      true,
    );
    this.cancelButton.addEventListener(
      'click',
      (event) => this.handleAction(event, false),
      true,
    );
    this.closeButton?.addEventListener(
      'click',
      (event) => this.handleAction(event, false),
      true,
    );

    if (globalThis.MutationObserver) {
      this.modalObserver = new MutationObserver(() => {
        if (this.pending && !this.modal.classList.contains('active')) {
          this.settle(false, { close: false });
        }
      });
      this.modalObserver.observe(this.modal, { attributes: true, attributeFilter: ['class'] });
    }
    this.loaded = true;
  }

  createDetailGroup(groupId, labelText, valueId) {
    let group = document.getElementById(groupId);
    if (group) return group;

    group = document.createElement('div');
    group.id = groupId;
    group.className = 'form-group';
    group.hidden = true;
    const label = document.createElement('label');
    label.textContent = labelText;
    const value = document.createElement('div');
    value.id = valueId;
    value.className = 'confirm-value';
    group.append(label, value);
    this.details.appendChild(group);
    return group;
  }

  createSigningNotice() {
    let notice = document.getElementById('evmConfirmSigningNotice');
    if (notice) return notice;

    notice = document.createElement('div');
    notice.id = 'evmConfirmSigningNotice';
    notice.hidden = true;
    notice.style.color = 'var(--secondary-text-color)';
    notice.style.fontSize = 'var(--font-size-sm)';
    notice.style.lineHeight = '1.4';
    notice.style.padding = '4px 0';
    this.details.appendChild(notice);
    return notice;
  }

  render(prepared) {
    const {
      network,
      asset,
      validation,
      maximumFee,
      displayAmount,
      recipientLabel,
    } = prepared;
    this.recipient.textContent = recipientLabel || validation.recipient;
    this.amount.textContent = `${displayAmount} ${asset.tokenSymbol}`;
    this.asset.textContent = `${asset.tokenName} (${asset.tokenSymbol})`;
    this.networkValue.textContent = `${network.name} (Chain ID ${network.chainId})`;
    this.feeValue.textContent = `${formatUnits(maximumFee, 18)} ${network.nativeSymbol}`;
    this.signingNotice.textContent = 'Signature: your wallet key signs locally and never leaves this device.';

    const price = Number(asset.tokenPriceUsd);
    const amount = Number(displayAmount);
    const usdValue = price * amount;
    if (this.amountUsd) {
      const hasUsdValue = Number.isFinite(price) && Number.isFinite(amount) && Number.isFinite(usdValue);
      this.amountUsd.textContent = hasUsdValue ? `≈ ${formatConnectedUsd(usdValue)}` : '';
      this.amountUsd.style.display = hasUsdValue ? 'block' : 'none';
    }
    if (this.memoGroup) this.memoGroup.style.display = 'none';
    for (const group of [this.networkGroup, this.feeGroup]) {
      group.hidden = false;
    }
    this.signingNotice.hidden = false;
  }

  confirm(message, prepared) {
    if (!this.loaded) this.load();
    if (!this.modal || !prepared) {
      return Promise.resolve(globalThis.confirm?.(message) ?? false);
    }
    if (this.pending) this.settle(false);

    this.render(prepared);
    this.confirmButton.disabled = false;
    this.cancelButton.disabled = false;
    openModal(this.modal);
    return new Promise((resolve) => {
      this.pending = { resolve };
    });
  }

  handleAction(event, confirmed) {
    if (!this.pending) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.confirmButton.disabled = true;
    this.cancelButton.disabled = true;
    this.settle(confirmed);
  }

  settle(confirmed, { close = true } = {}) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    if (close) this.modal.classList.remove('active');
    for (const group of [this.networkGroup, this.feeGroup]) {
      group.hidden = true;
    }
    this.signingNotice.hidden = true;
    pending.resolve(Boolean(confirmed));
  }

  reset() {
    if (this.pending) this.settle(false);
  }
}

class EvmSendFormAdapter {
  constructor(controller) {
    this.controller = controller;
    this.loaded = false;
    this.refreshTimer = null;
    this.lookupTimer = null;
    this.lookupVersion = 0;
    this.recipientResolution = null;
  }

  load() {
    if (this.loaded) return;
    this.modal = document.getElementById('sendAssetFormModal');
    this.sendForm = document.getElementById('sendForm');
    this.usernameInput = document.getElementById('sendToAddress');
    this.amountInput = document.getElementById('sendAmount');
    this.submitButton = this.sendForm?.querySelector('button[type="submit"]');
    this.networkSelect = document.getElementById('sendNetwork');
    this.networkStatus = document.getElementById('sendNetworkStatus');
    this.assetSelectDropdown = document.getElementById('sendAsset');
    this.balanceWarning = document.getElementById('balanceWarning');
    this.usernameAvailable = document.getElementById('sendToAddressError');
    this.closeButton = document.getElementById('closeSendAssetFormModal');
    if (!this.sendForm || !this.usernameInput || !this.amountInput || !this.submitButton) return;

    this.sendForm.addEventListener('submit', (event) => this.handleSubmit(event), true);
    this.usernameInput.addEventListener(
      'input',
      (event) => this.handleRecipientInput(event),
      true,
    );
    for (const element of [
      this.amountInput,
      this.networkSelect,
      this.assetSelectDropdown,
    ]) {
      element?.addEventListener('input', () => this.scheduleRefresh());
      element?.addEventListener('change', () => this.scheduleRefresh());
    }
    this.closeButton?.addEventListener('click', () => this.resetContext());
    if (this.modal && globalThis.MutationObserver) {
      this.modalObserver = new MutationObserver(() => {
        if (!this.modal.classList.contains('active')) this.resetContext();
      });
      this.modalObserver.observe(this.modal, { attributes: true, attributeFilter: ['class'] });
    }
    this.loaded = true;
  }

  setRecipientStatus(message = '', status = 'error') {
    if (!this.usernameAvailable) return;
    this.usernameAvailable.textContent = message;
    this.usernameAvailable.style.color = status === 'success' ? '#28a745' : '#dc3545';
    this.usernameAvailable.style.display = message ? 'inline' : 'none';
  }

  clearRecipientLookup({ hideStatus = true } = {}) {
    clearTimeout(this.lookupTimer);
    this.lookupTimer = null;
    this.lookupVersion += 1;
    this.recipientResolution = null;
    if (hideStatus) this.setRecipientStatus();
  }

  getResolvedRecipient() {
    if (!this.recipientResolution) return null;
    const current = this.controller.recipients.normalizeRecipientInput(this.usernameInput.value);
    if (current.kind !== this.recipientResolution.kind) return null;
    if (current.input.toLowerCase() !== this.recipientResolution.input.toLowerCase()) return null;
    return this.recipientResolution;
  }

  async handleRecipientInput(event) {
    if (!this.isEvmSelected()) return;

    // The shared Liberdus form has its own username/address listener. EVM Assets
    // owns this event while an EVM asset is selected so the two flows cannot race.
    event.stopImmediatePropagation();
    this.clearRecipientLookup();
    this.submitButton.disabled = true;

    const recipient = this.controller.recipients.normalizeRecipientInput(event.target.value);
    if (recipient.kind === 'username') {
      event.target.value = recipient.username;
    }
    if (!recipient.input) {
      this.scheduleRefresh();
      return;
    }

    const version = this.lookupVersion;
    if (recipient.kind === 'address') {
      try {
        this.recipientResolution = await this.controller.recipients.resolve(recipient.input);
        if (version !== this.lookupVersion) return;
        this.setRecipientStatus('valid address', 'success');
      } catch (error) {
        if (version !== this.lookupVersion) return;
        this.setRecipientStatus(error?.message || 'enter a valid 0x address');
      }
      this.scheduleRefresh();
      return;
    }

    if (recipient.username.length < 3) {
      this.setRecipientStatus('too short');
      this.scheduleRefresh();
      return;
    }

    this.setRecipientStatus('checking…');
    this.lookupTimer = setTimeout(async () => {
      try {
        const resolution = await this.controller.recipients.resolve(recipient.username);
        if (version !== this.lookupVersion) return;
        this.recipientResolution = resolution;
        this.setRecipientStatus('found', 'success');
      } catch (error) {
        if (version !== this.lookupVersion) return;
        const messages = {
          USERNAME_NOT_FOUND: 'not found',
          USERNAME_IS_SELF: 'enter another username',
          USERNAME_ADDRESS_INVALID: 'wallet address unavailable',
        };
        this.setRecipientStatus(messages[error?.code] || 'network error');
      } finally {
        if (version === this.lookupVersion) this.scheduleRefresh();
      }
    }, LIBERDUS_USERNAME_LOOKUP_DELAY_MS);
  }

  isEvmSelected() {
    return this.controller.getNetwork(this.networkSelect?.value)?.source === 'evm';
  }

  scheduleRefresh() {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      if (!this.modal?.classList.contains('active') || !this.isEvmSelected()) return;
      this.controller.refreshSendButtonState(this);
    }, 0);
  }

  updateNetworkStatus() {
    const network = this.controller.getNetwork(this.networkSelect?.value);
    if (!this.networkStatus || network?.source !== 'evm') return;
    this.networkStatus.textContent = `${network.name} is connected for balances, receiving, and sending.`;
    this.networkStatus.dataset.status = network.connected ? 'connected' : 'ready';
    this.usernameInput.placeholder = 'Enter username or 0x wallet address';
  }

  applyContext() {
    this.clearRecipientLookup();
    this.updateNetworkStatus();
    this.scheduleRefresh();
  }

  resetContext() {
    clearTimeout(this.refreshTimer);
    this.clearRecipientLookup();
  }

  async handleSubmit(event) {
    if (!this.isEvmSelected()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    await this.controller.handleSendFormSubmit(this);
  }

  async close() {
    this.resetContext();
    if (this.closeButton) {
      this.closeButton.click();
    } else {
      this.modal?.classList.remove('active');
      this.sendForm?.reset();
    }
  }

  async refreshSendButtonDisabledState() {
    this.controller.refreshSendButtonState(this);
  }
}

class EvmAssetsController {
  constructor() {
    this.getAccount = () => null;
    this.getLiberdusAsset = () => null;
    this.openSend = () => {};
    this.openReceive = () => {};
    this.showToast = () => {};
    this.confirmationModal = new EvmSendConfirmationModal();
    this.confirmTransfer = (...args) => this.confirmationModal.confirm(...args);
    this.loaded = false;
    this.discovery = new WalletDiscoveryService({
      getAccount: () => this.getAccount(),
      getLiberdusAsset: () => this.getLiberdusAsset(),
    });
    this.recipients = new LiberdusEvmRecipientResolver({
      getAccount: () => this.getAccount(),
    });
    this.transactions = new EvmTransactionService({
      getAccount: () => this.getAccount(),
      refreshAssets: (options) => this.refresh(options),
      showToast: (...args) => this.showToast(...args),
      confirmTransfer: (...args) => this.confirmTransfer(...args),
      getManagedRpcUrl: (network) => this.discovery.getRpcUrl(network.id),
    });
    this.assetsModal = new AssetsModal(this);
    this.assetDetailsModal = new AssetDetailsModal(this);
    this.sendFormAdapter = new EvmSendFormAdapter(this);
  }

  configure({
    getAccount,
    getLiberdusAsset,
    openSend,
    openReceive,
    showToast,
    confirmTransfer,
  } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
    if (typeof getLiberdusAsset === 'function') this.getLiberdusAsset = getLiberdusAsset;
    if (typeof openSend === 'function') this.openSend = openSend;
    if (typeof openReceive === 'function') this.openReceive = openReceive;
    if (typeof showToast === 'function') this.showToast = showToast;
    if (typeof confirmTransfer === 'function') this.confirmTransfer = confirmTransfer;
  }

  load() {
    if (this.loaded) return;
    this.assetsModal.load();
    this.assetDetailsModal.load();
    this.confirmationModal.load();
    this.sendFormAdapter.load();
    document.getElementById('openAssets').addEventListener('click', () => this.assetsModal.open());
    this.loaded = true;
  }

  reset() {
    this.discovery.reset();
    this.recipients.reset();
    this.confirmationModal.reset();
  }

  close(modalId) {
    if (modalId === 'assetsModal') {
      this.assetsModal.close();
      return true;
    }
    if (modalId === 'assetDetailsModal') {
      this.assetDetailsModal.close();
      return true;
    }
    return false;
  }

  refresh(options) { return this.discovery.refresh(options); }
  rebuildCatalog() { return this.discovery.rebuildCatalog(); }
  getCatalog() { return this.discovery.getCatalog(); }
  getEvmCatalog() { return this.discovery.getEvmCatalog(); }
  getTotalUsd(options) { return this.discovery.getTotalUsd(options); }
  getStatus() { return this.discovery.getStatus(); }
  getUpdatedAt() { return this.discovery.getUpdatedAt(); }
  getNetwork(networkId) { return this.discovery.getNetwork(networkId); }
  getSelectedAsset(networkId, select) {
    return this.discovery.getSelectedAsset(networkId, select);
  }
  findAsset(networkId, assetKey, options) {
    return this.discovery.findAsset(networkId, assetKey, options);
  }
  populateNetworkSelect(select, options) {
    return this.discovery.populateNetworkSelect(select, options);
  }
  populateAssetSelect(select, networkId) {
    return this.discovery.populateAssetSelect(select, networkId);
  }
  validateTransfer({ networkId, assetKey, recipient, amount }) {
    const { walletNetwork, asset } = this.findAsset(networkId, assetKey, { evmOnly: true });
    return this.transactions.validate({
      network: walletNetwork,
      asset,
      recipient,
      amount,
    });
  }
  async sendTransfer({ networkId, assetKey, recipient, recipientLabel = null, amount }) {
    const { walletNetwork, asset } = this.findAsset(networkId, assetKey, { evmOnly: true });
    return this.transactions.send({
      network: walletNetwork,
      asset,
      recipient,
      recipientLabel,
      amount,
    });
  }
  openContextualSend(options) {
    const opening = this.openSend(options);
    this.sendFormAdapter.applyContext();
    return opening;
  }
  openContextualReceive(options) { return this.openReceive(options); }
  refreshSendButtonState(form) {
    const resolution = form.getResolvedRecipient();
    const amount = form.amountInput.value.trim();
    const validation = resolution && amount
      ? this.validateTransfer({
        networkId: form.networkSelect.value,
        assetKey: form.assetSelectDropdown.value,
        recipient: resolution.address,
        amount,
      })
      : { valid: false, message: '' };
    form.balanceWarning.textContent = !validation.valid ? validation.message : '';
    form.balanceWarning.style.display = validation.message ? 'inline' : 'none';
    form.submitButton.disabled = !validation.valid;
  }
  async handleSendFormSubmit(form) {
    form.submitButton.disabled = true;
    try {
      const previousResolution = form.getResolvedRecipient();
      if (!previousResolution) {
        throw new EvmTransferError(
          'Enter a valid Liberdus username or 0x wallet address',
          'RECIPIENT_NOT_RESOLVED',
        );
      }

      const resolution = await this.recipients.resolve(form.usernameInput.value, {
        force: previousResolution.kind === 'username',
      });
      if (
        previousResolution.kind === 'username'
        && resolution.address !== previousResolution.address
      ) {
        throw new EvmTransferError(
          'The wallet associated with this username changed. Review the recipient and try again.',
          'USERNAME_ASSOCIATION_CHANGED',
        );
      }
      form.recipientResolution = resolution;

      const result = await this.sendTransfer({
        networkId: form.networkSelect.value,
        assetKey: form.assetSelectDropdown.value,
        recipient: resolution.address,
        recipientLabel: resolution.username || resolution.display,
        amount: form.amountInput.value.trim(),
      });
      if (result.status === 'confirmed' || result.status === 'pending') {
        await form.close();
      }
      return result;
    } catch (error) {
      console.error('EVM transfer failed:', error);
      if (error?.code === 'USERNAME_ASSOCIATION_CHANGED') {
        form.clearRecipientLookup({ hideStatus: false });
        form.setRecipientStatus('recipient changed—review username');
      }
      this.showToast(error?.message || 'EVM transfer failed', 5000, 'error');
      return { status: 'failed', error };
    } finally {
      await form.refreshSendButtonDisabledState();
    }
  }
  getConnectionText() { return this.discovery.getConnectionText(); }
  formatTokenAmount(value) { return formatConnectedTokenAmount(value); }
}

export const evmAssets = new EvmAssetsController();
