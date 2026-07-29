import { escapeHtml } from './lib.js';
import {
  calculateCatalogTotalUsd,
  createWalletNetworkCatalog,
  getEvmWalletNetworks,
  getWalletNetwork,
  walletProbeAddress,
} from './wallet-networks.js?v=1455-11';

export class WalletDiscoveryService {
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
    return (configured || 'http://127.0.0.1:8788').replace(/\/+$/, '');
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

export function formatConnectedTokenAmount(value) {
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

export function formatConnectedUsd(value) {
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

export function connectedAssetLogoMarkup(asset, walletNetwork) {
  const logoUrl = typeof asset.logoUrl === 'string' ? asset.logoUrl : '';
  if (/^(?:https:\/\/|\.\/)/.test(logoUrl)) {
    return `<img src="${escapeHtml(logoUrl)}" alt="" class="connected-asset-logo-image">`;
  }
  return `<span class="connected-asset-logo-fallback">${escapeHtml(walletNetwork.shortName.slice(0, 3))}</span>`;
}

export function formatAssetDetailsUpdatedAt(timestamp) {
  if (!timestamp) return 'Updated just now';
  return `Updated ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))}`;
}

export function formatConnectedTokenType(asset) {
  const type = String(asset?.tokenType || '').toLowerCase();
  if (type === 'native') return 'Native asset';
  if (type === 'erc20') return 'ERC-20';
  return type ? type.toUpperCase() : 'Token';
}
