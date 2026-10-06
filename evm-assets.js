import {
  base642bin,
  bin2utf8,
  bin2base64,
  normalizeUnsignedFloat,
  BUTTON_COOLDOWN_MS,
  escapeHtml,
  escapeHtmlAttribute,
  normalizeHttpsUrl,
  normalizeResourceUrl,
  normalizeUsername,
  openModal,
  utf82bin,
  withButtonCooldown,
} from './lib.js';
import { getPublicKey, signMessage } from './crypto.js';
import keccak256 from './external/keccak256.js';

const DEFAULT_WALLET_PROBE_BASE_URL = 'https://163.245.216.178';
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const EVM_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ERC20_TRANSFER_SELECTOR = 'a9059cbb';
const EVM_REQUEST_TIMEOUT_MS = 20_000;
const EVM_BROADCAST_TIMEOUT_MS = 60_000;
const EVM_BROADCAST_ATTEMPTS = 3;
const EVM_RECEIPT_TIMEOUT_MS = 60_000;
const EVM_RECEIPT_POLL_MS = 2_000;
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

const ERC20_TRANSFER_TOPIC = bytesToHex(keccak256(utf82bin('Transfer(address,address,uint256)')));

export const EVM_CHAT_MESSAGE_TYPE = 'evm_transfer';
const EVM_NOTE_MAX_BYTES = 1000;

/** Validate untrusted chat claims once; amount remains an exact base-unit string. */
export function parseEvmTransferMessage(value) {
  if (!value || value.type !== EVM_CHAT_MESSAGE_TYPE || value.version !== 1) return null;
  if (!Number.isSafeInteger(value.chainId) || value.chainId <= 0) return null;
  if (typeof value.networkId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(value.networkId)) return null;
  if (typeof value.transactionHash !== 'string' || typeof value.from !== 'string' || typeof value.to !== 'string') return null;
  if (!EVM_HASH_PATTERN.test(value.transactionHash) || !EVM_ADDRESS_PATTERN.test(value.from)
    || !EVM_ADDRESS_PATTERN.test(value.to)) return null;
  if (value.assetKind !== 'native' && value.assetKind !== 'erc20') return null;
  if (value.assetKind === 'erc20' && (typeof value.contractAddress !== 'string' || !EVM_ADDRESS_PATTERN.test(value.contractAddress))) return null;
  if (value.assetKind === 'native' && value.contractAddress != null) return null;
  if (typeof value.rawAmount !== 'string' || !/^[1-9][0-9]{0,77}$/.test(value.rawAmount)
    || BigInt(value.rawAmount) >= 2n ** 256n) return null;
  if (!Number.isInteger(value.decimals) || value.decimals < 0 || value.decimals > 255) return null;
  if (typeof value.symbol !== 'string' || !value.symbol.trim() || value.symbol.length > 32) return null;
  if (value.note !== undefined && (typeof value.note !== 'string' || utf82bin(value.note).length > EVM_NOTE_MAX_BYTES)) return null;
  return {
    type: EVM_CHAT_MESSAGE_TYPE,
    version: 1,
    chainId: value.chainId,
    networkId: value.networkId,
    transactionHash: value.transactionHash.toLowerCase(),
    from: value.from.toLowerCase(),
    to: value.to.toLowerCase(),
    assetKind: value.assetKind,
    contractAddress: value.assetKind === 'erc20' ? value.contractAddress.toLowerCase() : null,
    rawAmount: value.rawAmount,
    decimals: value.decimals,
    symbol: value.symbol.trim(),
    ...(value.note ? { note: value.note } : {}),
  };
}

export function evmPaymentId(payment) {
  return `${payment.chainId}:${payment.transactionHash}`;
}

export function evmPaymentAmount(payment) {
  return formatUnits(payment.rawAmount, payment.decimals);
}

export class EvmTransferError extends Error {
  constructor(message, code = 'EVM_TRANSFER_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'EvmTransferError';
    this.code = code;
    this.transactionHash = details.transactionHash || null;
    this.rpcError = details.rpcError;
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

export class LiberdusEvmRecipientResolver {
  constructor({
    getAccount = () => null,
    findContact = () => null,
  } = {}) {
    this.getAccount = getAccount;
    this.findContact = findContact;
  }

  normalizeRecipientInput(value) {
    const input = String(value || '').trim();
    if (EVM_ADDRESS_PATTERN.test(input)) {
      return Object.freeze({ kind: 'address', input, display: input, username: null });
    }
    const username = normalizeUsername(input);
    return Object.freeze({ kind: 'username', input: username, display: username, username });
  }

  resolve(value) {
    const recipient = this.normalizeRecipientInput(value);
    if (recipient.kind === 'address') {
      return Object.freeze({
        ...recipient,
        address: normalizeEvmAddress(recipient.input, 'recipient'),
      });
    }

    if (recipient.username.length < 3) {
      throw new EvmTransferError('Username is too short', 'USERNAME_TOO_SHORT');
    }

    const contact = this.findContact(recipient.username);
    if (!contact) {
      throw new EvmTransferError(
        'Add this username to Contacts before sending an EVM payment',
        'USERNAME_NOT_IN_CONTACTS',
      );
    }

    let address;
    try {
      address = liberdusLookupAddress(contact.address);
    } catch (error) {
      throw new EvmTransferError(
        'This contact does not have a valid EVM wallet address',
        'USERNAME_ADDRESS_INVALID',
        { cause: error },
      );
    }

    if (address === walletProbeAddress(this.getAccount()?.keys?.address)) {
      throw new EvmTransferError('Enter another user’s username', 'USERNAME_IS_SELF');
    }

    return Object.freeze({ ...recipient, address });
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

  async getNativeCurrency({ id, chainId }) {
    const configured = REQUIRED_NETWORKS.find((network) => network.source === 'evm'
      && network.id === id && network.chainId === chainId);
    if (configured) return { symbol: configured.nativeSymbol, decimals: 18 };

    // Portfolio native rows include zero balances, unlike the visible wallet catalog.
    const findNativeToken = () => this.portfolio?.tokens.find((token) => token.networkId === id
      && token.chainId === chainId && token.tokenType === 'native' && !token.contractAddress);
    let token = findNativeToken();
    if (!token) {
      await this.refresh();
      token = findNativeToken();
    }
    if (!token || typeof token.tokenSymbol !== 'string' || !token.tokenSymbol.trim()
      || !Number.isInteger(token.tokenDecimals) || token.tokenDecimals < 0 || token.tokenDecimals > 255) return null;
    return { symbol: token.tokenSymbol.trim(), decimals: token.tokenDecimals };
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
    hideToast = () => {},
    confirmTransfer,
    getManagedRpcUrl = () => null,
    getNativeCurrency,
    savePayment,
    saveSubmission,
    preparePaymentMessage,
    sendPaymentMessage,
    fetchFn = (...args) => fetch(...args),
  }) {
    this.getAccount = getAccount;
    this.refreshAssets = refreshAssets;
    this.showToast = showToast;
    this.hideToast = hideToast;
    this.confirmTransfer = confirmTransfer;
    this.getManagedRpcUrl = getManagedRpcUrl;
    this.getNativeCurrency = getNativeCurrency;
    this.savePayment = savePayment;
    this.saveSubmission = saveSubmission;
    this.preparePaymentMessage = preparePaymentMessage;
    this.sendPaymentMessage = sendPaymentMessage;
    this.fetchFn = fetchFn;
    this.requestId = 0;
    this.verifiedRpcEndpoints = new Map();
    this.paymentEvidence = new Map();
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
      : [managedRpcUrl, ...(network.rpcUrls || DEFAULT_EVM_RPC_URLS[network.id] || [])].filter(Boolean);
    if (!Array.isArray(urls) || urls.length === 0) {
      throw new EvmTransferError(
        `Sending is not configured for ${network.name || network.id}`,
        'RPC_NOT_CONFIGURED',
      );
    }
    return [...new Set(urls)];
  }

  async requestEndpoint(endpoint, method, params, networkId, timeoutMs = EVM_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
          { rpcError: payload.error },
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

  async isNonceConsumed(network, record) {
    // Finalized state can release the send guard even if this RPC has lost the
    // original hash. It does not establish whether this payment succeeded.
    const nonce = await this.request(network, 'eth_getTransactionCount', [record.payment.from, 'finalized']);
    return parseHexQuantity(nonce, 'finalized nonce') > parseHexQuantity(record.nonce, 'payment nonce');
  }

  async broadcast(network, record, account) {
    const deadline = Date.now() + EVM_BROADCAST_TIMEOUT_MS;
    const endpoints = this.getRpcUrls(network);
    const request = (endpoint, method, params) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new EvmTransferError('Submission check timed out', 'RPC_TIMEOUT');
      return this.requestEndpoint(endpoint, method, params, network.id, Math.min(EVM_REQUEST_TIMEOUT_MS, remaining));
    };
    record.broadcastState = 'attempting';
    this.saveSubmission(record, account);
    for (let attempt = 0; attempt < EVM_BROADCAST_ATTEMPTS && Date.now() < deadline; attempt++) {
      const endpoint = endpoints[attempt % endpoints.length];
      const previouslyUncertain = Boolean(record.broadcastUncertain);
      let submitted = false;
      try {
        if (this.verifiedRpcEndpoints.get(endpoint) !== network.chainId) {
          const chainId = parseHexQuantity(await request(endpoint, 'eth_chainId', []), 'chainId');
          if (chainId !== BigInt(network.chainId)) throw new EvmTransferError('RPC returned the wrong chain', 'CHAIN_ID_MISMATCH');
          this.verifiedRpcEndpoints.set(endpoint, network.chainId);
        }
        submitted = true;
        record.broadcastUncertain = true;
        this.saveSubmission(record, account);
        const hash = await request(endpoint, 'eth_sendRawTransaction', [record.rawTransaction]);
        if (typeof hash !== 'string' || hash.toLowerCase() !== record.payment.transactionHash) {
          throw new EvmTransferError('RPC did not return the expected transaction hash', 'INVALID_RPC_RESPONSE');
        }
        record.broadcastState = 'acknowledged';
        record.assetState = 'pending';
        delete record.broadcastError;
        this.saveSubmission(record, account);
        return record.assetState;
      } catch (error) {
        record.broadcastError = { code: error.rpcError?.code ?? error.code, message: error.message, data: error.rpcError?.data };
        // Only an explicit validation rejection, with no earlier ambiguous send,
        // permits a fresh payment. Nonce/known/internal errors need reconciliation.
        const rejected = error.code === 'RPC_RESPONSE_ERROR'
          && /^(insufficient funds|intrinsic gas too low|exceeds block gas limit|invalid sender|invalid chain id|transaction type not supported|rlp:)/i.test(error.message);
        if (submitted && rejected && !previouslyUncertain) {
          record.broadcastState = 'rejected';
          record.assetState = 'rejected';
          record.broadcastUncertain = false;
          delete record.rawTransaction;
          this.saveSubmission(record, account);
          return record.assetState;
        }
        this.saveSubmission(record, account);
      }
      // A null lookup does not prove absence. Try the original bytes again;
      // never prepare another nonce while this payment remains unresolved.
      for (const lookupEndpoint of endpoints) {
        if (Date.now() >= deadline) break;
        try {
          if (this.verifiedRpcEndpoints.get(lookupEndpoint) !== network.chainId) continue;
          const tx = await request(lookupEndpoint, 'eth_getTransactionByHash', [record.payment.transactionHash]);
          if (tx?.hash?.toLowerCase() !== record.payment.transactionHash) continue;
          record.broadcastState = 'acknowledged';
          record.assetState = 'pending';
          delete record.broadcastError;
          this.saveSubmission(record, account);
          return record.assetState;
        } catch { /* Keep the original broadcast error for the user. */ }
      }
      if (attempt + 1 < EVM_BROADCAST_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(1000, deadline - Date.now()))));
      }
    }
    // Failed chain checks before any send cannot leave an uncertain transfer.
    const status = record.broadcastUncertain ? 'unknown' : 'rejected';
    record.broadcastState = status;
    record.assetState = status;
    if (status === 'rejected') delete record.rawTransaction;
    this.saveSubmission(record, account);
    return record.assetState;
  }

  async withSubmissionProgress(operation) {
    const toastId = this.showToast('Submitting EVM transfer…', 0, 'loading', false, { dedupe: false });
    const slow = setTimeout(() => {
      const toast = document.getElementById(toastId);
      if (toast) toast.textContent = 'Connection is slow. Checking submission…';
    }, 8000);
    try {
      return await operation();
    } finally {
      clearTimeout(slow);
      this.hideToast(toastId);
    }
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
      prepared.chat ? `Chat message fee and toll: ${formatUnits(prepared.chat.totalRequired)} LIB` : 'Wallet transfer only; no chat message.',
      prepared.chat?.note ? `Note: ${prepared.chat.note}` : '',
      'The transaction will be signed locally with this account.',
    ].join('\n');
  }

  /** Cache network evidence, not verdicts: every claim must match independently. */
  async getPaymentEvidence(network, hash) {
    const key = `${network.id}:${network.chainId}:${hash}`;
    const cached = this.paymentEvidence.get(key);
    if (cached && cached.until > Date.now()) return cached.promise;
    const promise = (async () => {
      const [transaction, receipt] = await Promise.all([
        this.request(network, 'eth_getTransactionByHash', [hash]),
        this.request(network, 'eth_getTransactionReceipt', [hash]),
      ]);
      const block = receipt?.blockNumber
        ? await this.request(network, 'eth_getBlockByNumber', [receipt.blockNumber, false]) : null;
      return { transaction, receipt, block };
    })();
    // Share recent network evidence across claims; verdicts are never shared.
    if (this.paymentEvidence.size >= 100) this.paymentEvidence.clear();
    this.paymentEvidence.set(key, { until: Date.now() + 10_000, promise });
    return promise;
  }

  async verifyPayment(value, expectedFrom, expectedTo) {
    const payment = parseEvmTransferMessage(value);
    if (!payment || payment.from !== expectedFrom || payment.to !== expectedTo) return 'failed';
    const network = { id: payment.networkId, chainId: payment.chainId };
    return this.verifyPaymentOnNetwork(payment, network);
  }

  async verifyOutgoingPayment(record) {
    const payment = parseEvmTransferMessage(record.payment);
    if (record.kind !== 'outgoing' || !payment || payment.from !== walletProbeAddress(this.getAccount()?.keys?.address)) return 'failed';
    const network = { id: payment.networkId, chainId: payment.chainId };
    const state = await this.verifyPaymentOnNetwork(payment, network);
    if (state !== 'unverifiable') return state;
    if (record.broadcastState === 'nonce_used') return 'nonce_used';
    try {
      if (await this.isNonceConsumed(network, record)) return 'nonce_used';
    } catch { /* An unavailable finalized nonce leaves the outcome unresolved. */ }
    return state;
  }

  async verifyPaymentOnNetwork(payment, network) {
    try {
      const { transaction: tx, receipt, block } = await this.getPaymentEvidence(network, payment.transactionHash);
      if (!tx || tx.hash?.toLowerCase() !== payment.transactionHash) return 'unverifiable';
      if (!receipt) return 'pending';
      if (!block) return 'unverifiable';
      if (!EVM_HASH_PATTERN.test(block.hash) || receipt.blockHash !== block.hash || tx.blockHash !== block.hash) return 'pending';
      if (tx.hash?.toLowerCase() !== payment.transactionHash || receipt.transactionHash?.toLowerCase() !== payment.transactionHash) return 'unverifiable';
      if (tx.from?.toLowerCase() !== payment.from) return 'failed';
      if (parseHexQuantity(receipt.status, 'receipt status') !== 1n) {
        const matches = payment.assetKind === 'native'
          ? tx.to?.toLowerCase() === payment.to && parseHexQuantity(tx.value, 'value') === BigInt(payment.rawAmount)
          : tx.to?.toLowerCase() === payment.contractAddress && tx.input?.toLowerCase() === encodeErc20Transfer(payment.to, BigInt(payment.rawAmount));
        return matches ? 'reverted' : 'failed';
      }
      if (payment.assetKind === 'native') {
        if (tx.to?.toLowerCase() !== payment.to || parseHexQuantity(tx.value, 'value') !== BigInt(payment.rawAmount)) return 'failed';
        // RPC proves the transfer; wallet metadata independently verifies its display units.
        const currency = await this.getNativeCurrency(network);
        if (!currency) return 'unverifiable';
        return payment.decimals === currency.decimals && payment.symbol === currency.symbol ? 'settled' : 'failed';
      }
      if (tx.to?.toLowerCase() !== payment.contractAddress) return 'failed';
      const matchingTransfer = receipt.logs?.some((log) => !log.removed
        && log.address?.toLowerCase() === payment.contractAddress && log.topics?.length === 3
        && log.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC
        && log.topics[1]?.toLowerCase() === `0x${payment.from.slice(2).padStart(64, '0')}`
        && log.topics[2]?.toLowerCase() === `0x${payment.to.slice(2).padStart(64, '0')}`
        && /^0x[0-9a-fA-F]{64}$/.test(log.data) && BigInt(log.data) === BigInt(payment.rawAmount));
      if (!matchingTransfer) return 'failed';
      // Verify display metadata too: a valid transfer of a different token must not look like USDC.
      const [decimals, symbolData] = await Promise.all([
        this.request(network, 'eth_call', [{ to: payment.contractAddress, data: '0x313ce567' }, receipt.blockNumber]),
        this.request(network, 'eth_call', [{ to: payment.contractAddress, data: '0x95d89b41' }, receipt.blockNumber]),
      ]);
      const symbolBytes = hexToBytes(symbolData, 'symbol');
      let symbol;
      if (symbolBytes.length === 32) {
        symbol = new TextDecoder().decode(symbolBytes).replace(/\0+$/, '');
      } else {
        if (symbolBytes.length < 64 || BigInt(`0x${symbolData.slice(2, 66)}`) !== 32n) return 'unverifiable';
        const length = Number(BigInt(`0x${symbolData.slice(66, 130)}`));
        if (length > 128 || symbolBytes.length < 64 + length) return 'unverifiable';
        symbol = new TextDecoder().decode(symbolBytes.slice(64, 64 + length));
      }
      return BigInt(decimals) === BigInt(payment.decimals) && symbol.trim() === payment.symbol ? 'settled' : 'failed';
    } catch {
      return 'unverifiable';
    }
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

  async send({ network, asset, recipient, recipientLabel = null, amount, chat = null, beforeBroadcast = async () => {}, isCurrent = () => true }) {
    if (chat?.note && utf82bin(chat.note).length > EVM_NOTE_MAX_BYTES) throw new Error('Payment note exceeds 1000 bytes.');
    const prepared = await this.prepare({ network, asset, recipient, amount });
    prepared.recipientLabel = recipientLabel || prepared.validation.recipient;
    prepared.chat = chat;
    if (!isCurrent()) return { status: 'cancelled', transactionHash: null };
    const confirmed = await this.confirmTransfer(
      this.confirmationText(prepared, amount, recipientLabel),
      prepared,
    );
    if (!confirmed || !isCurrent()) return { status: 'cancelled', transactionHash: null };

    await beforeBroadcast();
    if (!isCurrent()) return { status: 'cancelled', transactionHash: null };
    const rawTransaction = await signEvmTransaction(
      prepared.transaction,
      prepared.validation.privateKey,
    );
    const transactionHash = bytesToHex(keccak256(hexToBytes(rawTransaction)));
    const payment = parseEvmTransferMessage({
      type: EVM_CHAT_MESSAGE_TYPE, version: 1, chainId: network.chainId, networkId: network.id, transactionHash,
      from: prepared.validation.from, to: prepared.validation.recipient,
      assetKind: asset.contractAddress ? 'erc20' : 'native', contractAddress: asset.contractAddress || null,
      rawAmount: prepared.validation.amountRaw.toString(), decimals: asset.tokenDecimals, symbol: asset.tokenSymbol,
      ...(chat?.note ? { note: chat.note } : {}),
    });
    if (!payment) throw new Error('Cannot record this asset transfer.');
    const record = {
      kind: 'outgoing', payment, networkId: network.id, username: chat?.username || null,
      createdAt: Date.now(), broadcastState: 'not_started', assetState: 'unknown',
      messageState: chat ? 'ready' : 'none',
      rawTransaction, nonce: prepared.transaction.nonce,
      ...(chat ? { messageCostLimit: chat.totalRequired } : {}),
    };
    const account = prepared.validation.account;
    // Check and sign the announcement before spending EVM assets; send only after acceptance.
    if (chat) await this.preparePaymentMessage(record, account);
    this.savePayment(record, account);
    // Normal account saves retain the original bytes for an exact submission retry.
    let status = await this.withSubmissionProgress(() => this.broadcast(network, record, account));
    let receipt = null;
    if (chat && status === 'pending') {
      try { await this.sendPaymentMessage(record, account); }
      catch (error) {
        if (!error.toastAlreadyShown) this.showToast(error.message, 0, 'error');
      }
    }
    if (!chat && status === 'pending') {
      try {
        receipt = await this.waitForReceipt(network, transactionHash);
        if (receipt) status = parseHexQuantity(receipt.status, 'receipt status') === 1n ? 'confirmed' : 'reverted';
      } catch { /* Receipt lookup failure leaves the broadcast pending. */ }
    }
    record.assetState = status;
    if (['confirmed', 'reverted'].includes(status)) delete record.rawTransaction;
    const message = status === 'rejected' ? `EVM submission rejected: ${record.broadcastError.message}. Review the form and try again.`
      : status === 'unknown' ? 'Submission could not be confirmed. The transfer may still go through. Use Retry submission in EVM Assets to check or resend the original transaction.'
      : `EVM transfer ${status}: ${transactionHash}`;
    const failed = ['reverted', 'rejected'].includes(status);
    this.showToast(message, failed || status === 'unknown' ? 0 : 5000, failed ? 'error' : status === 'unknown' ? 'warning' : 'info');
    if (!chat && ['confirmed', 'reverted'].includes(status)) record.notifiedAssetState = status;
    try {
      this.saveSubmission(record, account);
      status = record.assetState;
    } catch {
      this.showToast('Transfer may be sent. Check its hash before sending again.', 0, 'warning');
    }
    if (['confirmed', 'reverted'].includes(status)) {
      try { await this.refreshAssets({ force: true }); }
      catch {
        this.showToast('Transfer processed; balance refresh is temporarily unavailable.', 5000, 'warning');
      }
    }
    return { status, transactionHash, receipt, record };
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

function normalizeConnectedAssetLogoUrl(value) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (candidate.startsWith('./')) {
    const normalized = normalizeResourceUrl(candidate, window.location.href);
    return normalized && new URL(normalized).origin === window.location.origin ? normalized : '';
  }
  return normalizeHttpsUrl(candidate);
}

function connectedAssetLogoMarkup(asset, walletNetwork) {
  const logoUrl = normalizeConnectedAssetLogoUrl(asset.logoUrl);
  if (logoUrl) {
    return `<img src="${escapeHtmlAttribute(logoUrl)}" alt="" class="connected-asset-logo-image">`;
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
    this.loadingToastId = null;
  }

  load() {
    this.modal = document.getElementById('assetsModal');
    this.totalBalance = document.getElementById('assetsTotalBalance');
    this.refreshButton = document.getElementById('refreshAssetsBalance');
    this.networkSelect = document.getElementById('assetsNetwork');
    this.connectionSummary = document.getElementById('assetsConnectionSummary');
    this.assetsList = document.getElementById('connectedAssetsList');
    this.recovery = document.getElementById('evmPaymentRecovery');
    this.recoveryList = document.getElementById('evmPaymentRecoveryList');
    this.recoveryList.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-recover-payment]');
      if (!button) return;
      button.disabled = true;
      try { await this.controller.recoverPayment(button.dataset.recoverPayment, button.dataset.recoveryAction); }
      finally { button.disabled = false; }
    });

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
    if (!openModal(this.modal)) return;

    // A recently closed toast may still be fading out when the modal reopens.
    const toastId = this.controller.showToast('Loading EVM assets...', 0, 'loading', false, { dedupe: false });
    this.loadingToastId = toastId;
    try {
      await this.update();
    } finally {
      if (this.loadingToastId === toastId) this.hideLoadingToast();
    }
  }

  close() {
    this.modal.classList.remove('active');
    this.hideLoadingToast();
  }

  hideLoadingToast() {
    if (!this.loadingToastId) return;
    this.controller.hideToast(this.loadingToastId);
    this.loadingToastId = null;
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  async update({ force = false } = {}) {
    this.renderRecovery();
    this.connectionSummary.textContent = 'Connecting wallet networks…';
    this.connectionSummary.dataset.status = 'loading';
    await this.controller.refresh({ force });
  }

  renderBalances() {
    const totalUsd = this.controller.getTotalUsd({ evmOnly: true });
    this.totalBalance.textContent = totalUsd === null ? 'N/A' : totalUsd.toFixed(2);
    this.controller.populateNetworkSelect(this.networkSelect, { includeAll: true, evmOnly: true });
    this.connectionSummary.textContent = this.controller.getConnectionText();
    this.connectionSummary.dataset.status = this.controller.getStatus();
    this.render();
  }

  renderRecovery() {
    const account = this.controller.getAccount();
    if (!account) { this.recovery.hidden = true; return; }
    try {
      const records = this.controller.getPayments(account).filter((record) => record.kind === 'outgoing'
        && !(record.assetState === 'confirmed'
          && ['none', 'delivered', 'abandoned'].includes(record.messageState)));
      this.recovery.hidden = records.length === 0;
      this.recoveryList.innerHTML = records.map((record) => {
        const network = this.controller.getNetwork(record.networkId);
        const asset = network?.assets?.find((item) => (item.contractAddress?.toLowerCase() || null) === record.payment.contractAddress);
        const recipient = record.username || `${record.payment.to.slice(0, 8)}…${record.payment.to.slice(-6)}`;
        const actions = this.controller.getPaymentActions(record.payment);
        const button = (action, label) => `<button type="button" class="secondary-button" data-recover-payment="${escapeHtml(evmPaymentId(record.payment))}" data-recovery-action="${action}">${label}</button>`;
        const buttons = [
          actions.retrySubmission ? button('resubmit', 'Retry submission') : '',
          actions.retryTransfer ? button('review', 'Retry transfer') : '',
          actions.retryMessage ? button('retry', 'Retry message') : '',
          actions.checkAgain ? button('check', 'Check again') : '',
          actions.dismiss ? button('dismiss', 'Dismiss') : '',
        ].join('');
        let status = 'Confirming transfer';
        if (actions.retryTransfer) status = 'Transfer failed';
        else if (record.broadcastState === 'not_started' || record.broadcastState === 'attempting') status = 'Submitting transfer';
        else if (record.broadcastState === 'nonce_used') status = 'Outcome unavailable · Nonce already used';
        else if (record.assetState === 'unknown') status = 'Status unavailable';
        else if (record.assetState === 'confirmed') status = actions.retryMessage ? 'Message needs attention' : 'Confirming message';
        if (actions.checkAgain) status += ' · Checks paused';
        return `
          <div class="asset-item connected-asset-item evm-payment-pending-row">
            <div class="asset-logo connected-asset-logo">${connectedAssetLogoMarkup(asset || {}, network || { shortName: record.payment.symbol })}</div>
            <div class="asset-info">
              <div class="asset-name">${escapeHtml(evmPaymentAmount(record.payment))} ${escapeHtml(record.payment.symbol)}</div>
              <div class="asset-symbol">To ${escapeHtml(recipient)} · ${escapeHtml(network?.name || record.networkId)}</div>
              <div class="evm-payment-status">${escapeHtml(status)}</div>
              ${buttons ? `<div class="evm-payment-actions">${buttons}</div>` : ''}
            </div>
          </div>`;
      }).join('');
    } catch (error) {
      this.recovery.hidden = false;
      this.recoveryList.textContent = error.message;
    }
  }

  render() {
    const catalog = this.controller.getEvmCatalog();
    const selectedNetworkId = this.networkSelect?.value || 'all';
    const visibleNetworks = selectedNetworkId === 'all'
      ? catalog
      : catalog.filter((walletNetwork) => walletNetwork.id === selectedNetworkId);
    const assetUsdValue = ({ asset }) => asset.tokenValueUsd === null ? -Infinity : Number(asset.tokenValueUsd);
    const visibleAssets = visibleNetworks
      .flatMap((walletNetwork) => walletNetwork.assets.map((asset) => ({ walletNetwork, asset })))
      .sort((left, right) => assetUsdValue(right) - assetUsdValue(left));

    if (visibleAssets.length === 0) {
      this.assetsList.innerHTML = `
        <div class="empty-state">
          <div></div>
          <div>No EVM assets yet</div>
          <div>Refresh to check this wallet again</div>
        </div>
      `;
      return;
    }

    this.assetsList.innerHTML = `
      <section class="wallet-network-assets">
        ${visibleAssets.map(({ walletNetwork, asset }) => `
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
              <div class="wallet-network-chain">${escapeHtml(walletNetwork.name)}</div>
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
    `;
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
        networkId: this.networkId,
        assetKey: this.assetKey,
      });
    });
    document.getElementById('assetDetailsReceive').addEventListener('click', () => {
      this.controller.openContextualReceive({
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
    this.symbol.textContent = `${asset.tokenName} price`;
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
    this.modal = document.getElementById('evmSendConfirmModal');
    this.recipient = document.getElementById('evmConfirmRecipient');
    this.amount = document.getElementById('evmConfirmAmount');
    this.amountUsd = document.getElementById('evmConfirmAmountUSD');
    this.asset = document.getElementById('evmConfirmAsset');
    this.memoGroup = document.getElementById('evmConfirmMemoGroup');
    this.memo = document.getElementById('evmConfirmMemo');
    this.confirmButton = document.getElementById('confirmEvmSendButton');
    this.cancelButton = document.getElementById('cancelEvmSendButton');
    this.closeButton = document.getElementById('closeEvmSendConfirmModal');
    this.networkValue = document.getElementById('evmConfirmNetwork');
    this.feeValue = document.getElementById('evmConfirmFee');
    this.feeUsd = document.getElementById('evmConfirmFeeUSD');
    this.signingNotice = document.getElementById('evmConfirmSigningNotice');
    this.confirmButton.addEventListener('click', (event) => this.handleAction(event, true));
    this.cancelButton.addEventListener('click', (event) => this.handleAction(event, false));
    this.closeButton.addEventListener('click', (event) => this.handleAction(event, false));

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

  getUsdEstimate(amountInUnits, rawPrice) {
    if (typeof rawPrice !== 'number' && typeof rawPrice !== 'string') return '';
    if (typeof rawPrice === 'string' && !rawPrice.trim()) return '';

    const price = Number(rawPrice);
    const amount = Number(amountInUnits);
    const usdValue = price * amount;
    if (
      !Number.isFinite(price) || price < 0
      || !Number.isFinite(amount) || amount < 0
      || !Number.isFinite(usdValue)
    ) return '';

    return `≈ ${formatConnectedUsd(usdValue)}`;
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
    this.signingNotice.textContent = prepared.chat
      ? `Includes a chat payment message. Message fee and toll: ${formatUnits(prepared.chat.totalRequired)} LIB.`
      : 'Wallet transfer only; no chat message. Your key signs locally on this device.';
    if (prepared.duplicatePaymentWarning) {
      this.signingNotice.textContent = `${prepared.duplicatePaymentWarning} ${this.signingNotice.textContent}`;
    }

    if (this.amountUsd) {
      const estimate = this.getUsdEstimate(displayAmount, asset.tokenPriceUsd);
      this.amountUsd.textContent = estimate;
      this.amountUsd.style.display = estimate ? 'block' : 'none';
    }
    const nativeAsset = network.assets.find((entry) => (
      entry.networkId === network.id
      && entry.chainId === network.chainId
      && entry.tokenType === 'native'
      && !entry.contractAddress
    ));
    const feeEstimate = this.getUsdEstimate(formatUnits(maximumFee, 18), nativeAsset?.tokenPriceUsd);
    this.feeUsd.textContent = feeEstimate;
    this.feeUsd.style.display = feeEstimate ? 'block' : 'none';
    this.memoGroup.style.display = prepared.chat?.note ? 'block' : 'none';
    this.memo.textContent = prepared.chat?.note || '';
  }

  confirm(message, prepared) {
    if (!this.loaded) this.load();
    if (!this.modal || !prepared) {
      return Promise.resolve(globalThis.confirm?.(message) ?? false);
    }
    if (this.pending || this.modal.classList.contains('active')) {
      throw new EvmTransferError('A transfer is already awaiting confirmation.', 'MODAL_BUSY');
    }
    this.render(prepared);
    if (!openModal(this.modal)) throw new EvmTransferError('Please wait for the current modal to open, then try again.', 'MODAL_BUSY');
    this.confirmButton.disabled = false;
    this.cancelButton.disabled = false;
    return new Promise((resolve) => {
      this.pending = { resolve };
    });
  }

  handleAction(event, confirmed) {
    if (!this.pending) return;
    event.preventDefault();
    this.confirmButton.disabled = true;
    this.cancelButton.disabled = true;
    this.settle(confirmed);
  }

  settle(confirmed, { close = true } = {}) {
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    if (close) this.modal.classList.remove('active');
    pending.resolve(Boolean(confirmed));
  }

  reset() {
    if (this.pending) this.settle(false);
  }
}

class EvmSendModal {
  constructor(controller) {
    this.controller = controller;
    this.loaded = false;
    this.session = null;
    this.recipientResolution = null;
  }

  load() {
    if (this.loaded) return;
    this.modal = document.getElementById('evmSendModal');
    this.sendForm = document.getElementById('evmSendForm');
    this.usernameInput = document.getElementById('evmSendRecipient');
    this.amountInput = document.getElementById('evmSendAmount');
    this.memoInput = document.getElementById('evmSendMemo');
    this.memoGroup = document.getElementById('evmSendMemoGroup');
    this.memoCounter = this.memoGroup.querySelector('.memo-byte-counter');
    this.submitButton = this.sendForm.querySelector('button[type="submit"]');
    this.balanceWarning = document.getElementById('evmSendWarning');
    this.usernameAvailable = document.getElementById('evmSendRecipientStatus');
    this.balanceSymbol = document.getElementById('evmSendSymbol');
    this.balanceAmount = document.getElementById('evmSendBalance');
    this.assetLabel = document.getElementById('evmSendAssetLabel');
    this.qrFileInput = document.getElementById('evmSendQRFile');
    document.getElementById('closeEvmSendModal').addEventListener('click', () => this.close());
    this.sendForm.addEventListener('submit', (event) => this.handleSubmit(event));
    this.usernameInput.addEventListener('input', (event) => this.handleRecipientInput(event));
    this.memoInput.addEventListener('input', () => this.refreshSendButtonDisabledState());
    this.amountInput.addEventListener('input', () => {
      this.amountInput.value = normalizeUnsignedFloat(this.amountInput.value);
      this.refreshSendButtonDisabledState();
    });
    document.getElementById('evmSendAvailable').addEventListener('click', () => this.fillAmount());
    document.getElementById('evmSendScanQR').addEventListener('click', () => this.scanQR());
    document.getElementById('evmSendUploadQR').addEventListener('click', () => this.qrFileInput.click());
    this.qrFileInput.addEventListener('change', (event) => this.readQRFile(event));
    this.loaded = true;
  }

  open({ networkId, assetKey }) {
    if (this.modal.classList.contains('active')) return false;
    const { walletNetwork, asset } = this.controller.findAsset(networkId, assetKey, { evmOnly: true });
    if (!asset) {
      this.controller.showToast('This asset is no longer available. Refresh and try again.', 3000, 'warning');
      return false;
    }
    this.resetForm();
    this.assetLabel.textContent = `${asset.tokenName} (${asset.tokenSymbol}) · ${walletNetwork.name}`;
    this.balanceSymbol.textContent = asset.tokenSymbol;
    this.balanceAmount.textContent = `${this.controller.formatTokenAmount(asset.tokenAmount)} ${asset.tokenSymbol}`;
    if (!openModal(this.modal)) return false;
    const session = this.session = { networkId, assetKey, account: this.controller.getAccount() };
    this.refreshBalance(session);
    return true;
  }

  isCurrentSession(session) {
    return Boolean(session && this.session === session && session.account === this.controller.getAccount()
      && this.modal.classList.contains('active'));
  }

  getSelectedAsset() {
    if (!this.session) return null;
    return this.controller.findAsset(this.session.networkId, this.session.assetKey, { evmOnly: true }).asset;
  }

  async refreshBalance(session) {
    try {
      await this.controller.refresh();
      if (!this.isCurrentSession(session)) return;
      const asset = this.getSelectedAsset();
      this.balanceAmount.textContent = asset
        ? `${this.controller.formatTokenAmount(asset.tokenAmount)} ${asset.tokenSymbol}` : 'Unavailable';
      this.refreshSendButtonDisabledState();
    } catch (error) {
      if (!this.isCurrentSession(session)) return;
      this.balanceAmount.textContent = 'Unavailable';
      this.submitButton.disabled = true;
      this.controller.showToast('Unable to refresh asset balance', 3000, 'warning');
    }
  }

  fillAmount() {
    const asset = this.getSelectedAsset();
    if (!asset) return;
    this.amountInput.value = asset.tokenAmount || '0';
    this.refreshSendButtonDisabledState();
  }

  setRecipientStatus(message = '', status = 'error') {
    if (!this.usernameAvailable) return;
    this.usernameAvailable.textContent = message;
    this.usernameAvailable.style.color = status === 'success' ? '#28a745' : '#dc3545';
    this.usernameAvailable.style.display = message ? 'inline' : 'none';
  }

  clearRecipientLookup({ hideStatus = true } = {}) {
    this.recipientResolution = null;
    this.memoInput.value = '';
    this.memoGroup.hidden = true;
    this.memoInput.setCustomValidity('');
    this.memoCounter.style.display = 'none';
    if (hideStatus) this.setRecipientStatus();
  }

  getResolvedRecipient() {
    if (!this.recipientResolution) return null;
    const current = this.controller.recipients.normalizeRecipientInput(this.usernameInput.value);
    if (current.kind !== this.recipientResolution.kind) return null;
    if (current.input.toLowerCase() !== this.recipientResolution.input.toLowerCase()) return null;
    return this.recipientResolution;
  }

  handleRecipientInput(event) {
    this.clearRecipientLookup();
    this.submitButton.disabled = true;

    const recipient = this.controller.recipients.normalizeRecipientInput(event.target.value);
    if (recipient.kind === 'username') {
      event.target.value = recipient.username;
    }
    if (!recipient.input) {
      this.refreshSendButtonDisabledState();
      return;
    }

    if (recipient.kind === 'username' && recipient.username.length < 3) {
      this.setRecipientStatus('too short');
      this.refreshSendButtonDisabledState();
      return;
    }

    try {
      this.recipientResolution = this.controller.recipients.resolve(recipient.input);
      this.memoGroup.hidden = recipient.kind !== 'username';
      const status = recipient.kind === 'address'
        ? 'Valid address — wallet transfer only'
        : 'Contact found — includes a chat payment message';
      this.setRecipientStatus(status, 'success');
    } catch (error) {
      const messages = {
        USERNAME_NOT_IN_CONTACTS: 'Not in Contacts — add contact first',
        USERNAME_IS_SELF: 'enter another username',
        USERNAME_ADDRESS_INVALID: 'wallet address unavailable',
      };
      this.setRecipientStatus(messages[error?.code] || error?.message || 'enter a valid recipient');
    }
    this.refreshSendButtonDisabledState();
  }

  handleSubmit(event) {
    event.preventDefault();
    if (!this.isCurrentSession(this.session)) return;
    return this.controller.handleSendFormSubmit(this);
  }

  refreshSendButtonDisabledState() {
    if (this.isCurrentSession(this.session)) this.controller.refreshSendButtonState(this);
  }

  resetForm() {
    this.sendForm.reset();
    this.clearRecipientLookup();
    this.balanceWarning.textContent = '';
    this.balanceWarning.style.display = 'none';
    this.submitButton.disabled = true;
  }

  close() {
    this.session = null;
    this.modal?.classList.remove('active');
    if (this.loaded) this.resetForm();
  }

  scanQR() {
    const session = this.session;
    this.controller.openQRScanner((data) => {
      if (this.isCurrentSession(session)) this.fillFromQR(data);
    });
  }

  readQRFile(event) {
    const session = this.session;
    this.controller.readQRFile(event, {
      fillFromQR: (data) => { if (this.isCurrentSession(session)) this.fillFromQR(data); },
      resetForm: () => { if (this.isCurrentSession(session)) this.resetForm(); },
    });
  }

  fillFromQR(data) {
    this.resetForm();
    try {
      if (!data?.startsWith('liberdus://')) throw new Error('Invalid payment QR code format.');
      const payment = JSON.parse(bin2utf8(base642bin(data.slice('liberdus://'.length))));
      // Preserve the existing username/amount QR behavior; QR data does not change the selected asset.
      this.usernameInput.value = payment.u || '';
      this.amountInput.value = payment.a || '';
      this.usernameInput.dispatchEvent(new Event('input'));
      this.refreshSendButtonDisabledState();
    } catch (error) {
      this.controller.showToast('Invalid payment QR code format.', 3000, 'error');
    }
  }
}

class EvmReceiveModal {
  constructor(controller) {
    this.controller = controller;
    this.session = null;
  }

  load() {
    this.modal = document.getElementById('evmReceiveModal');
    this.assetLabel = document.getElementById('evmReceiveAssetLabel');
    this.amountInput = document.getElementById('evmReceiveAmount');
    this.balanceSymbol = document.getElementById('evmReceiveSymbol');
    this.toggleButton = document.getElementById('toggleEvmReceiveBalance');
    this.displayAddress = document.getElementById('evmReceiveAddress');
    this.copyButton = document.getElementById('copyEvmReceiveAddress');
    this.qrcodeContainer = document.getElementById('evmReceiveQRCode');
    this.preview = document.getElementById('evmReceiveQRPreview');
    document.getElementById('closeEvmReceiveModal').addEventListener('click', () => this.close());
    this.copyButton.addEventListener('click', () => this.copyAddress());
    this.displayAddress.addEventListener('click', () => this.copyAddress());
    this.toggleButton.addEventListener('click', () => this.handleToggleBalance());
    this.amountInput.addEventListener('input', () => {
      this.amountInput.value = normalizeUnsignedFloat(this.amountInput.value);
      this.scheduleQRCode();
    });
  }

  open({ networkId, assetKey }) {
    if (this.modal.classList.contains('active')) return false;
    const account = this.controller.getAccount();
    const { walletNetwork, asset } = this.controller.findAsset(networkId, assetKey, { evmOnly: true });
    if (!account || !asset) {
      this.controller.showToast('This asset is no longer available. Refresh and try again.', 3000, 'warning');
      return false;
    }
    this.close();
    this.session = { account, network: walletNetwork, asset, address: walletProbeAddress(account.keys.address) };
    this.amountInput.value = '';
    this.assetLabel.textContent = `${asset.tokenName} (${asset.tokenSymbol}) · ${walletNetwork.name}`;
    this.balanceSymbol.textContent = asset.tokenSymbol;
    this.displayAddress.textContent = this.session.address;
    this.updateQRCode();
    if (!openModal(this.modal)) {
      this.close();
      return false;
    }
    this.refreshAsset(this.session);
    return true;
  }

  isCurrentSession(session) {
    return Boolean(session && this.session === session && session.account === this.controller.getAccount());
  }

  async refreshAsset(session) {
    try {
      await this.controller.refresh();
      if (!this.isCurrentSession(session)) return;
      const { asset } = this.controller.findAsset(session.network.id, session.asset.key, { evmOnly: true });
      if (asset) session.asset = asset;
    } catch (error) {
      // Receiving still works with the selected address/asset; USD conversion may be unavailable.
      if (this.isCurrentSession(session)) this.controller.showToast('Asset prices could not be refreshed', 3000, 'warning');
    }
  }

  scheduleQRCode() {
    clearTimeout(this.qrTimer);
    const session = this.session;
    this.qrTimer = setTimeout(() => {
      if (this.isCurrentSession(session)) this.updateQRCode();
    }, 300);
  }

  createQRPaymentData() {
    const { account, network, asset, address } = this.session;
    const data = {
      u: account.username,
      n: network.id,
      c: network.chainId,
      i: asset.contractAddress || asset.key,
      s: asset.tokenSymbol,
      d: this.balanceSymbol.textContent.toUpperCase(),
      r: address,
    };
    const amount = this.amountInput.value.trim();
    if (amount) data.a = amount;
    return data;
  }

  updateQRCode() {
    if (!this.isCurrentSession(this.session)) return;
    this.qrcodeContainer.replaceChildren();
    this.preview.style.display = 'none';
    this.preview.textContent = '';
    try {
      const text = `liberdus://${bin2base64(utf82bin(JSON.stringify(this.createQRPaymentData())))}`;
      const bytes = qr.encodeQR(text, 'gif', { scale: 4 });
      const img = document.createElement('img');
      img.src = `data:image/gif;base64,${bin2base64(new Uint8Array(bytes))}`;
      img.width = 200;
      img.height = 200;
      img.alt = 'EVM payment request QR code';
      this.qrcodeContainer.appendChild(img);
      return text;
    } catch (error) {
      // A username-only fallback would lose the EVM network and asset identity.
      this.preview.textContent = 'Unable to generate the payment QR code. You can still copy your address.';
      this.preview.style.display = 'block';
    }
  }

  handleToggleBalance() {
    if (!this.isCurrentSession(this.session)) return;
    const { asset } = this.session;
    const price = Number(asset.tokenPriceUsd);
    if (!Number.isFinite(price) || price <= 0) {
      this.controller.showToast(`${asset.tokenSymbol}/USD price is unavailable`, 2500, 'warning');
      return;
    }
    const showUsd = this.balanceSymbol.textContent !== 'USD';
    this.balanceSymbol.textContent = showUsd ? 'USD' : asset.tokenSymbol;
    const amount = this.amountInput.value.trim();
    if (amount && Number.isFinite(Number(amount))) {
      this.amountInput.value = String(showUsd ? Number(amount) * price : Number(amount) / price);
    }
    this.updateQRCode();
  }

  async copyAddress() {
    const session = this.session;
    if (!this.isCurrentSession(session)) return;
    try {
      await navigator.clipboard.writeText(session.address);
      if (!this.isCurrentSession(session)) return;
      this.controller.showToast('Address copied to clipboard', 2000, 'success');
      this.copyButton.classList.add('success');
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => {
        if (this.isCurrentSession(session)) this.copyButton.classList.remove('success');
      }, 2000);
    } catch (error) {
      if (this.isCurrentSession(session)) this.controller.showToast('Failed to copy address', 3000, 'error');
    }
  }

  close() {
    this.session = null;
    clearTimeout(this.qrTimer);
    clearTimeout(this.copyTimer);
    this.modal?.classList.remove('active');
    this.copyButton?.classList.remove('success');
    if (this.displayAddress) this.displayAddress.textContent = '';
    this.qrcodeContainer?.replaceChildren();
  }
}

class EvmAssetsController {
  constructor() {
    this.getAccount = () => null;
    this.getLiberdusAsset = () => null;
    this.openQRScanner = () => {};
    this.readQRFile = () => {};
    this.showToast = () => {};
    this.hideToast = () => {};
    this.syncSelect = () => {};
    this.findContact = () => null;
    this.confirmationModal = new EvmSendConfirmationModal();
    this.confirmTransfer = (...args) => this.confirmationModal.confirm(...args);
    this.loaded = false;
    this.sending = false;
    this.prepareChatPayment = null;
    this.preparePaymentMessage = null;
    this.sendChatPayment = null;
    this.getPayments = () => [];
    this.savePayment = () => { throw new Error('Payment storage is unavailable'); };
    this.saveSubmission = () => { throw new Error('Payment storage is unavailable'); };
    this.discovery = new WalletDiscoveryService({
      getAccount: () => this.getAccount(),
      getLiberdusAsset: () => this.getLiberdusAsset(),
    });
    this.recipients = new LiberdusEvmRecipientResolver({
      getAccount: () => this.getAccount(),
      findContact: (username) => this.findContact(username),
    });
    this.transactions = new EvmTransactionService({
      getAccount: () => this.getAccount(),
      refreshAssets: (options) => this.refresh(options),
      showToast: (...args) => this.showToast(...args),
      hideToast: (id) => this.hideToast(id),
      confirmTransfer: (text, prepared) => {
        const duplicate = this.getPayments(prepared.validation.account).some((record) => record.kind === 'outgoing'
          && ['pending', 'unknown'].includes(record.assetState)
          && record.payment.chainId === prepared.network.chainId
          && record.payment.to === prepared.validation.recipient
          && record.payment.contractAddress === (prepared.asset.contractAddress?.toLowerCase() || null)
          && record.payment.rawAmount === prepared.validation.amountRaw.toString());
        prepared.duplicatePaymentWarning = duplicate ? 'An earlier payment of this amount to this recipient is still unresolved. Continuing creates a separate payment that could pay them twice.' : '';
        return this.confirmTransfer(prepared.duplicatePaymentWarning ? `${prepared.duplicatePaymentWarning}\n\n${text}` : text, prepared);
      },
      getManagedRpcUrl: (network) => this.discovery.getRpcUrl(network.id),
      getNativeCurrency: (network) => this.discovery.getNativeCurrency(network),
      savePayment: (record, account) => this.savePayment(record, account),
      saveSubmission: (record, account) => this.saveSubmission(record, account),
      preparePaymentMessage: (record, account) => this.preparePaymentMessage(record, account),
      sendPaymentMessage: (record, account) => this.sendChatPayment(record, account),
    });
    this.assetsModal = new AssetsModal(this);
    this.assetDetailsModal = new AssetDetailsModal(this);
    this.sendModal = new EvmSendModal(this);
    this.receiveModal = new EvmReceiveModal(this);
  }

  configure({
    getAccount,
    getLiberdusAsset,
    findContact,
    prepareChatPayment,
    preparePaymentMessage,
    sendChatPayment,
    getPayments,
    savePayment,
    saveSubmission,
    checkPayment,
    dismissPayment,
    openQRScanner,
    readQRFile,
    showToast,
    hideToast,
    confirmTransfer,
    syncSelect,
  } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
    if (typeof getLiberdusAsset === 'function') this.getLiberdusAsset = getLiberdusAsset;
    if (typeof findContact === 'function') this.findContact = findContact;
    if (typeof getPayments === 'function') this.getPayments = getPayments;
    if (typeof savePayment === 'function') this.savePayment = savePayment;
    if (typeof saveSubmission === 'function') this.saveSubmission = saveSubmission;
    if (typeof checkPayment === 'function') this.checkPayment = checkPayment;
    if (typeof dismissPayment === 'function') this.dismissPayment = dismissPayment;
    if (typeof preparePaymentMessage === 'function') this.preparePaymentMessage = preparePaymentMessage;
    if (typeof sendChatPayment === 'function') this.sendChatPayment = sendChatPayment;
    if (typeof prepareChatPayment === 'function') this.prepareChatPayment = prepareChatPayment;
    if (typeof openQRScanner === 'function') this.openQRScanner = openQRScanner;
    if (typeof readQRFile === 'function') this.readQRFile = readQRFile;
    if (typeof showToast === 'function') this.showToast = showToast;
    if (typeof hideToast === 'function') this.hideToast = hideToast;
    if (typeof confirmTransfer === 'function') this.confirmTransfer = confirmTransfer;
    if (typeof syncSelect === 'function') this.syncSelect = syncSelect;
  }

  load() {
    if (this.loaded) return;
    this.assetsModal.load();
    this.assetDetailsModal.load();
    this.confirmationModal.load();
    this.sendModal.load();
    this.receiveModal.load();
    document.getElementById('openAssets').addEventListener('click', () => this.assetsModal.open());
    this.loaded = true;
  }

  reset() {
    this.discovery.reset();
    this.transactions.paymentEvidence.clear();
    this.confirmationModal.reset();
    this.sendModal.close();
    this.receiveModal.close();
  }

  close(modalId) {
    if (modalId === 'evmReceiveModal') {
      this.receiveModal.close();
      return true;
    }
    if (modalId === 'evmSendConfirmModal') {
      this.confirmationModal.reset();
      return true;
    }
    if (modalId === 'evmSendModal') {
      this.sendModal.close();
      return true;
    }
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

  async refresh(options) {
    const catalog = await this.discovery.refresh(options);
    if (this.assetsModal.modal?.classList.contains('active')) {
      this.assetsModal.renderBalances();
    }
    return catalog;
  }
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
    this.discovery.populateNetworkSelect(select, options);
    this.syncSelect(select);
  }
  populateAssetSelect(select, networkId) {
    this.discovery.populateAssetSelect(select, networkId);
    this.syncSelect(select);
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
  async sendTransfer({ networkId, assetKey, recipient, recipientLabel = null, amount, chat, beforeBroadcast, isCurrent }) {
    const { walletNetwork, asset } = this.findAsset(networkId, assetKey, { evmOnly: true });
    return this.transactions.send({
      network: walletNetwork,
      asset,
      recipient,
      recipientLabel,
      amount,
      chat,
      beforeBroadcast,
      isCurrent,
    });
  }
  openContextualSend(options) {
    return this.sendModal.open(options);
  }
  openContextualReceive(options) { return this.receiveModal.open(options); }
  refreshSendButtonState(form) {
    const resolution = form.getResolvedRecipient();
    const amount = form.amountInput.value.trim();
    const validation = resolution && amount
      ? this.validateTransfer({
        networkId: form.session.networkId,
        assetKey: form.session.assetKey,
        recipient: resolution.address,
        amount,
      })
      : { valid: false, message: '' };
    const noteBytes = resolution?.kind === 'username' ? utf82bin(form.memoInput.value).length : 0;
    const noteError = noteBytes > EVM_NOTE_MAX_BYTES ? 'Payment note exceeds 1000 bytes.' : '';
    form.memoInput.setCustomValidity(noteError);
    form.memoCounter.textContent = `${noteBytes} / ${EVM_NOTE_MAX_BYTES} bytes`;
    form.memoCounter.style.display = resolution?.kind === 'username' ? 'inline' : 'none';
    form.balanceWarning.textContent = noteError || (!validation.valid ? validation.message : '');
    form.balanceWarning.style.display = noteError || validation.message ? 'inline' : 'none';
    form.submitButton.disabled = this.sending || !validation.valid || Boolean(noteError);
  }
  getPaymentActions(payment, message = null) {
    const account = this.getAccount();
    if (!account) return {};
    const record = this.getPayments(account).find((item) => evmPaymentId(item.payment) === evmPaymentId(payment));
    const outgoing = record?.kind === 'outgoing' && payment.from === walletProbeAddress(account.keys.address);
    const failed = outgoing ? ['rejected', 'reverted'].includes(record.assetState)
      : message?.my && message.paymentReverted === true;
    return {
      retrySubmission: Boolean(outgoing && record.assetState === 'unknown' && record.rawTransaction
        && record.broadcastState !== 'nonce_used'),
      retryTransfer: Boolean(failed),
      retryMessage: Boolean(outgoing && record.username && record.assetState === 'confirmed'
        && ['ready', 'rejected', 'uncertain'].includes(record.messageState)),
      checkAgain: Boolean(record && ['pending', 'unknown'].includes(record.assetState) && record.checkAttempts >= 20),
      dismiss: Boolean(outgoing && (failed || record.broadcastState === 'nonce_used')),
    };
  }

  async recoverPayment(id, action = 'retry') {
    const account = this.getAccount();
    try {
      if (this.sending) throw new Error('Wait for the current payment operation to finish.');
      const record = this.getPayments(account).find((item) => item.kind === 'outgoing' && evmPaymentId(item.payment) === id);
      if (!record) throw new Error('This device has no outgoing operation to retry.');
      const actions = this.getPaymentActions(record.payment);
      if (action === 'resubmit' && actions.retrySubmission) {
        await this.retrySubmission(record, account);
        return;
      }
      if (action === 'check') {
        const toastId = this.showToast('Checking transfer status…', 0, 'loading');
        try {
          await this.checkPayment(record.payment, account);
          const latest = this.getPayments(account).find((item) => evmPaymentId(item.payment) === id);
          const message = !latest ? 'Payment completed.' : latest.checkAttempts === 0 ? 'Status check queued.'
            : latest.broadcastState === 'nonce_used' ? 'The nonce is already used. This payment outcome is still unverified; do not repeat the payment.'
            : latest.assetState === 'unknown' ? 'Status is still unavailable. Retry the original submission in EVM Assets.'
            : `Transfer ${latest.assetState}.${latest.username ? ` Chat message: ${latest.messageState}.` : ''}`;
          this.showToast(message, latest?.assetState === 'unknown' ? 0 : 5000, latest?.assetState === 'unknown' ? 'warning' : 'info');
        } finally { this.hideToast(toastId); }
        return;
      }
      if (action === 'review' && actions.retryTransfer) {
        await this.reviewPayment(record.payment, record.username || record.payment.to);
        return;
      }
      if (action === 'dismiss' && actions.dismiss) {
        this.dismissPayment(record, account);
        return;
      }
      if (action !== 'retry' || !actions.retryMessage) {
        throw new Error('Retry message is available only after the EVM transfer is confirmed.');
      }
      this.sending = true;
      try {
        const sent = await this.sendChatPayment(record, account);
        if (sent) this.showToast('Payment message submitted.', 5000, 'info');
      } finally {
        this.sending = false;
      }
    } catch (error) {
      if (!error.toastAlreadyShown) this.showToast(error.message, 0, 'error');
    } finally {
      if (this.assetsModal.isActive()) this.assetsModal.renderRecovery();
    }
  }

  async retrySubmission(record, account) {
    this.sending = true;
    try {
      // Check the original hash first. Retrying must never sign a new payment.
      this.transactions.paymentEvidence.clear();
      await this.transactions.withSubmissionProgress(async () => {
        const state = await this.transactions.verifyOutgoingPayment(record);
        // Message delivery can finish while the EVM request is in flight.
        record = this.getPayments(account).find((item) => item.kind === 'outgoing'
          && evmPaymentId(item.payment) === evmPaymentId(record.payment));
        if (!record || record.assetState !== 'unknown') return;
        if (state === 'failed') throw new Error('The saved transfer could not be verified.');
        if (state === 'nonce_used' || (state === 'unverifiable' && record.broadcastState === 'nonce_used')) {
          record.broadcastState = 'nonce_used';
          this.savePayment(record, account);
          this.showToast('The nonce is already used. This payment outcome is still unverified; do not repeat the payment.', 0, 'warning');
          return;
        }
        if (state === 'unverifiable') {
          const rawHash = bytesToHex(keccak256(hexToBytes(record.rawTransaction)));
          if (rawHash !== record.payment.transactionHash) throw new Error('Saved transaction does not match the payment hash.');
          if (record.username && record.messageState === 'ready') await this.preparePaymentMessage(record, account);
          const network = { id: record.payment.networkId, chainId: record.payment.chainId };
          await this.transactions.broadcast(network, record, account);
        } else {
          record.assetState = state === 'settled' ? 'confirmed' : state;
          record.broadcastState = 'acknowledged';
          if (state !== 'pending') delete record.rawTransaction;
        }
        record.checkAttempts = 0;
        record.nextCheckAt = 0;
        this.savePayment(record, account);
        if (['confirmed', 'reverted'].includes(record.assetState)) {
          void this.refresh({ force: true }).catch(() => {});
        }
        if (record.username && record.messageState === 'ready'
          && ['pending', 'confirmed'].includes(record.assetState)) {
          await this.sendChatPayment(record, account);
        }
        if (record.assetState === 'unknown') {
          this.showToast('Submission is still unconfirmed. You can retry this same submission later; do not create a new payment.', 0, 'warning');
        } else if (record.assetState === 'rejected') {
          this.showToast(`EVM submission rejected: ${record.broadcastError.message}`, 0, 'error');
        } else if (record.assetState === 'pending') {
          this.showToast('Original transfer submitted. Waiting for confirmation.', 5000, 'info');
        }
      });
    } finally {
      this.sending = false;
    }
    if (record) await this.checkPayment(record.payment, account);
  }

  async reviewPayment(payment, recipient) {
    const account = this.getAccount();
    try {
      if (this.sending) throw new Error('Wait for the current payment operation to finish.');
      if (payment.from !== walletProbeAddress(account.keys.address)) throw new Error('Only the sender can retry a transfer.');
      const record = this.getPayments(account).find((item) => item.kind === 'outgoing' && evmPaymentId(item.payment) === evmPaymentId(payment));
      if (record) {
        if (!['rejected', 'reverted'].includes(record.assetState)) throw new Error('Only a failed EVM transfer can be retried.');
      } else {
        this.transactions.paymentEvidence.clear();
        const state = await this.transactions.verifyPayment(payment, payment.from, payment.to);
        if (state !== 'reverted') throw new Error('A new transfer requires a verified failure. Check the original transfer again.');
      }
      const network = this.getEvmCatalog().find((item) => item.chainId === payment.chainId);
      const asset = network?.assets?.find((item) => (item.contractAddress?.toLowerCase() || null) === payment.contractAddress);
      if (!asset) throw new Error('Refresh EVM Assets to load this asset before retrying it.');
      if (this.getAccount() !== account) return;
      const form = this.sendModal;
      if (!form.open({ networkId: network.id, assetKey: asset.key })) return;
      form.usernameInput.value = recipient;
      form.amountInput.value = evmPaymentAmount(payment);
      form.usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      // Restore the note after recipient input clears the memo.
      form.memoInput.value = payment.note || '';
      form.refreshSendButtonDisabledState();
      this.showToast('Review the recipient and amount. Nothing has been sent.', 5000, 'info');
    } catch (error) {
      this.showToast(error.message, 0, 'warning');
    }
  }

  async handleSendFormSubmit(form) {
    if (this.sending) return;
    this.sending = true;
    const account = this.getAccount();
    const session = form.session;
    const isCurrent = () => form.isCurrentSession(session);
    const input = form.usernameInput.value;
    const note = form.memoInput.value.trim();
    const selection = { networkId: session.networkId, assetKey: session.assetKey, amount: form.amountInput.value.trim() };
    form.submitButton.disabled = true;
    try {
      const network = this.getNetwork(selection.networkId);
      const unresolved = this.getPayments(account).filter((record) => record.kind === 'outgoing'
        && record.payment.chainId === network?.chainId && record.assetState === 'unknown'
        && record.broadcastState !== 'nonce_used');
      for (let record of unresolved) {
        const consumed = await this.transactions.isNonceConsumed(network, record);
        // Preserve message delivery or execution updates received during the lookup.
        record = this.getPayments(account).find((item) => item.kind === 'outgoing'
          && evmPaymentId(item.payment) === evmPaymentId(record.payment));
        if (!record || record.assetState !== 'unknown' || record.broadcastState === 'nonce_used') continue;
        if (!consumed) throw new Error('An earlier transfer on this network is unresolved. Retry its submission in EVM Assets before making a new payment.');
        record.broadcastState = 'nonce_used';
        this.savePayment(record, account);
      }
      if (!isCurrent()) return { status: 'cancelled', transactionHash: null };
      const previousResolution = form.getResolvedRecipient();
      if (!previousResolution) {
        throw new EvmTransferError(
          'Enter a valid Liberdus username or 0x wallet address',
          'RECIPIENT_NOT_RESOLVED',
        );
      }

      const resolution = this.recipients.resolve(input);
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

      const chat = resolution.kind === 'username'
        ? { ...await this.prepareChatPayment(resolution, account), note } : null;
      const beforeBroadcast = async () => {
        if (resolution.kind === 'username') {
          const current = this.recipients.resolve(resolution.username);
          if (current.address !== resolution.address) throw new EvmTransferError('Contact changed. Review the username.', 'USERNAME_ASSOCIATION_CHANGED');
        }
        if (chat) {
          const current = await this.prepareChatPayment(resolution, account);
          if (BigInt(current.totalRequired) > BigInt(chat.totalRequired)) throw new Error('Message cost increased. Review the transfer again.');
        }
      };
      const result = await this.sendTransfer({
        ...selection,
        isCurrent,
        chat,
        beforeBroadcast,
        recipient: resolution.address,
        recipientLabel: resolution.username || resolution.display,
      });
      if (isCurrent() && ['pending', 'confirmed', 'reverted'].includes(result.status)) {
        await form.close();
      }
      return result;
    } catch (error) {
      console.error('EVM transfer failed:', error);
      if (!isCurrent()) return { status: 'cancelled', transactionHash: null };
      if (error?.code === 'USERNAME_ASSOCIATION_CHANGED') {
        form.clearRecipientLookup({ hideStatus: false });
        form.setRecipientStatus('recipient changed—review username');
      }
      this.showToast(error?.message || 'EVM transfer failed', 0, 'error');
      return { status: 'failed', error };
    } finally {
      this.sending = false;
      form.refreshSendButtonDisabledState();
    }
  }
  getConnectionText() { return this.discovery.getConnectionText(); }
  formatTokenAmount(value) { return formatConnectedTokenAmount(value); }
}

export const evmAssets = new EvmAssetsController();
