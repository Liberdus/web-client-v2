import {
  BUTTON_COOLDOWN_MS,
  escapeHtml,
  withButtonCooldown,
} from './lib.js';
import {
  calculateCatalogTotalUsd,
  createWalletNetworkCatalog,
  getEvmWalletNetworks,
  getWalletNetwork,
  walletProbeAddress,
} from './wallet-networks.js?v=1455-11';

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
    this.modal.classList.add('active');
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
                ${asset.tokenPriceUsd === null ? 'Price unavailable' : `${formatConnectedUsd(asset.tokenPriceUsd)} / ${escapeHtml(asset.tokenSymbol)}`}
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
      this.controller.openSend({
        mode: 'evm',
        networkId: this.networkId,
        assetKey: this.assetKey,
      });
    });
    document.getElementById('assetDetailsReceive').addEventListener('click', () => {
      this.controller.openReceive({
        mode: 'evm',
        networkId: this.networkId,
        assetKey: this.assetKey,
      });
    });
    document.getElementById('assetDetailsHistory').addEventListener('click', () => {
      this.controller.showToast('EVM transaction history is not available yet.', 3000, 'info');
    });
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
    this.modal.classList.add('active');
  }

  render(walletNetwork, asset) {
    const priceText = asset.tokenPriceUsd === null
      ? 'Price unavailable'
      : formatConnectedUsd(asset.tokenPriceUsd);
    const valueText = formatConnectedUsd(asset.tokenValueUsd);
    const amountText = `${formatConnectedTokenAmount(asset.tokenAmount)} ${asset.tokenSymbol}`;

    this.title.textContent = asset.tokenSymbol;
    this.symbol.textContent = asset.tokenName;
    this.price.textContent = priceText;
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
    this.contract.textContent = asset.contractAddress || 'Native asset — no contract';
    this.marketPrice.textContent = priceText;
    this.holdingValue.textContent = valueText;
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

class EvmAssetsController {
  constructor() {
    this.getAccount = () => null;
    this.getLiberdusAsset = () => null;
    this.openSend = () => {};
    this.openReceive = () => {};
    this.showToast = () => {};
    this.loaded = false;
    this.discovery = new WalletDiscoveryService({
      getAccount: () => this.getAccount(),
      getLiberdusAsset: () => this.getLiberdusAsset(),
    });
    this.assetsModal = new AssetsModal(this);
    this.assetDetailsModal = new AssetDetailsModal(this);
  }

  configure({ getAccount, getLiberdusAsset, openSend, openReceive, showToast } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
    if (typeof getLiberdusAsset === 'function') this.getLiberdusAsset = getLiberdusAsset;
    if (typeof openSend === 'function') this.openSend = openSend;
    if (typeof openReceive === 'function') this.openReceive = openReceive;
    if (typeof showToast === 'function') this.showToast = showToast;
  }

  load() {
    if (this.loaded) return;
    this.assetsModal.load();
    this.assetDetailsModal.load();
    document.getElementById('openAssets').addEventListener('click', () => this.assetsModal.open());
    this.loaded = true;
  }

  reset() {
    this.discovery.reset();
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
  getConnectionText() { return this.discovery.getConnectionText(); }
  formatTokenAmount(value) { return formatConnectedTokenAmount(value); }
}

export const evmAssets = new EvmAssetsController();
