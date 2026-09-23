// The Multichain screen: the wallet surface for NEAR Intents balances.
//
// Shaped after the EVM Assets modal in evm-assets.js -- own menu entry, own
// modal, own total, tap an asset for detail -- because that is the pattern this
// wallet already uses for assets that are not the native Liberdus balance.
//
// Two departures from that pattern, both deliberate:
//
//   - The UI states custody. EVM assets are controlled by the account key on
//     chain; these are claims held by intents.near on the account's behalf, and
//     the difference is not something to leave to the reader.
//   - There is no Send. Until the transfer and withdraw intents are wired, a
//     send button here would be a promise the client cannot keep. Receive is
//     real today, so Receive is the only action offered.
//
// The view code lives here rather than in intents-assets.js so the data modules
// stay free of the DOM; this screen needs both of them, so neither is its home.

import { BUTTON_COOLDOWN_MS, escapeHtml, openModal, withButtonCooldown } from './lib.js';
import { intentsAssets } from './intents-assets.js';
import { bridgeChainDisplayName, depositUri, intentsDeposits } from './intents-deposits.js';

const CUSTODY_NOTE = 'Held for you by intents.near, not on each asset’s own chain. '
  + 'You can withdraw them to any supported chain with your account key.';

function formatUsd(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/A';
  return `$${amount.toFixed(2)}`;
}

/** Long balances are unreadable in a list; the detail view shows them in full. */
function formatAmount(value) {
  const text = String(value ?? '0');
  if (!text.includes('.')) return text;
  const [whole, fraction] = text.split('.');
  return `${whole}.${fraction.slice(0, 8)}`;
}

class MultichainModal {
  constructor(controller) {
    this.controller = controller;
  }

  load() {
    this.modal = document.getElementById('multichainModal');
    this.totalBalance = document.getElementById('multichainTotalBalance');
    this.refreshButton = document.getElementById('refreshMultichainBalance');
    this.assetsList = document.getElementById('multichainAssetsList');
    this.statusLine = document.getElementById('multichainStatus');

    document.getElementById('closeMultichainModal')
      .addEventListener('click', () => this.close());

    this.assetsList.addEventListener('click', (event) => {
      const button = event.target.closest('.multichain-asset-button');
      if (!button) return;
      this.controller.assetModal.open(button.dataset.assetKey);
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
    this.statusLine.textContent = 'Checking balances…';
    this.statusLine.dataset.status = 'loading';

    await this.controller.refresh({ force });
    this.render();
    this.controller.updateSummary();
  }

  render() {
    const network = intentsAssets.getNetwork();
    const status = intentsAssets.getStatus();

    this.totalBalance.textContent = formatUsd(network.totalValueUsd).replace('$', '');
    this.statusLine.dataset.status = status;
    this.statusLine.textContent = status === 'unavailable'
      ? 'Balances are unavailable right now. Pull to refresh to try again.'
      : CUSTODY_NOTE;

    if (network.assets.length === 0) {
      this.assetsList.innerHTML = `
        <div class="empty-state">
          <div></div>
          <div>No multichain assets yet</div>
          <div>Deposit Bitcoin or Solana to get started</div>
        </div>
      `;
      return;
    }

    this.assetsList.innerHTML = `
      <section class="wallet-network-assets">
        ${network.assets.map((asset) => `
          <button
            type="button"
            class="asset-item connected-asset-item connected-asset-button multichain-asset-button"
            data-asset-key="${escapeHtml(asset.key)}"
            aria-label="View ${escapeHtml(asset.tokenSymbol)} details"
          >
            <div class="asset-info">
              <div class="asset-name">${escapeHtml(asset.tokenSymbol)}</div>
              <div class="wallet-network-chain">${escapeHtml(asset.chainName)}</div>
            </div>
            <div class="asset-balance">
              ${escapeHtml(formatAmount(asset.tokenAmount))} ${escapeHtml(asset.tokenSymbol)}
              <br>
              <span class="asset-symbol">${escapeHtml(
                asset.tokenValueUsd === null ? 'Unpriced' : formatUsd(asset.tokenValueUsd),
              )}</span>
            </div>
          </button>
        `).join('')}
      </section>
    `;
  }
}

// A deposit lands a minute or two after it is sent, long after the balance was
// last read. Without this the screen sits on a stale zero and looks broken --
// which is exactly how it looked the first time somebody deposited to it.
const DEPOSIT_WATCH_INTERVAL_MS = 10_000;
const DEPOSIT_WATCH_TIMEOUT_MS = 10 * 60_000;

class MultichainAssetModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
    this.watchTimer = null;
    this.watchUntil = 0;
  }

  load() {
    this.modal = document.getElementById('multichainAssetModal');
    this.title = document.getElementById('multichainAssetTitle');
    this.symbol = document.getElementById('multichainAssetSymbol');
    this.chain = document.getElementById('multichainAssetChain');
    this.amount = document.getElementById('multichainAssetAmount');
    this.value = document.getElementById('multichainAssetValue');
    this.receiveButton = document.getElementById('multichainAssetReceive');
    this.depositPanel = document.getElementById('multichainDepositPanel');

    document.getElementById('closeMultichainAssetModal')
      .addEventListener('click', () => this.close());
    this.receiveButton.addEventListener('click', () => this.showDeposit());
  }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;

    this.assetKey = assetKey;
    this.title.textContent = asset.tokenSymbol;
    this.symbol.textContent = asset.tokenSymbol;
    this.chain.textContent = asset.chainName;
    this.amount.textContent = `${asset.tokenAmount} ${asset.tokenSymbol}`;
    this.value.textContent = asset.tokenValueUsd === null
      ? 'No price available'
      : formatUsd(asset.tokenValueUsd);

    this.depositPanel.hidden = true;
    this.depositPanel.innerHTML = '';
    this.receiveButton.disabled = false;
    this.stopWatching();
    openModal(this.modal);
  }

  close() {
    this.stopWatching();
    this.modal.classList.remove('active');
    // The balance may have moved while this was open, so let the list behind
    // it catch up rather than showing a number this screen has already
    // superseded.
    this.controller.assetsModal.render();
    this.controller.updateSummary();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }

  /**
   * Deposit details are fetched on demand rather than with the balance: an
   * address is only needed when somebody asks to receive, and asking derives
   * one per chain on the bridge.
   */
  async showDeposit() {
    const asset = intentsAssets.getAsset(this.assetKey);
    const accountId = intentsAssets.getAccountId();
    if (!asset || !accountId) return;

    this.receiveButton.disabled = true;
    this.depositPanel.hidden = false;
    this.depositPanel.innerHTML = '<div class="multichain-deposit-loading">Getting your deposit address…</div>';

    try {
      const target = await intentsDeposits.requestDepositTarget(accountId, asset.assetId);
      this.renderDeposit(target);
      this.startWatching(asset);
    } catch (error) {
      console.warn('Deposit address unavailable:', error);
      this.depositPanel.innerHTML = `
        <div class="multichain-deposit-error">
          ${escapeHtml(error.message || 'Could not get a deposit address right now.')}
        </div>
      `;
      this.receiveButton.disabled = false;
    }
  }

  renderDeposit(target) {
    // On a memo chain the QR carries the bare address: a payment URI that drops
    // the memo would scan cleanly and lose the deposit.
    const uri = target.memo ? null : depositUri(target.chain, target.address);
    const qrText = uri || target.address;

    const rules = [];
    if (target.memo) {
      rules.push(`Include the memo <strong>${escapeHtml(target.memo)}</strong>. Without it the deposit is lost.`);
    }
    rules.push(`Send at least <strong>${escapeHtml(target.minDeposit)} ${escapeHtml(target.assetName)}</strong>. Less than that is not credited.`);
    rules.push(`Send only on <strong>${escapeHtml(target.chainName)}</strong>. Funds sent on another chain are lost.`);
    if (target.siblings > 0) {
      rules.push(`This chain carries more than one ${escapeHtml(target.assetName)} token; check your balance after the first deposit.`);
    }

    this.depositPanel.innerHTML = `
      <div class="multichain-deposit-qr" id="multichainDepositQr"></div>
      <div class="multichain-deposit-address" id="multichainDepositAddress">${escapeHtml(target.address)}</div>
      ${target.memo ? `<div class="multichain-deposit-memo">Memo: <strong>${escapeHtml(target.memo)}</strong></div>` : ''}
      <ul class="multichain-deposit-rules">
        ${rules.map((rule) => `<li>${rule}</li>`).join('')}
      </ul>
    `;

    this.renderQr(qrText);
  }

  /**
   * Watch for the deposit while the address is on screen.
   *
   * Polls the balance rather than the bridge's deposit list: the balance is
   * what the person is waiting to see, and it is the same single view call the
   * rest of this screen already makes. Stops as soon as it moves, and gives up
   * after ten minutes so a forgotten tab is not polling all day.
   */
  startWatching(asset) {
    this.stopWatching();
    const startingAmount = asset.rawAmount;
    const assetKey = this.assetKey;
    this.watchUntil = Date.now() + DEPOSIT_WATCH_TIMEOUT_MS;

    this.watchTimer = setInterval(async () => {
      if (!this.isActive() || this.assetKey !== assetKey) {
        this.stopWatching();
        return;
      }
      if (Date.now() > this.watchUntil) {
        this.stopWatching();
        return;
      }

      try {
        await intentsAssets.refresh({ force: true });
      } catch {
        return; // A failed poll is not worth reporting; the next one may work.
      }

      const current = intentsAssets.getAsset(assetKey);
      if (!current || current.rawAmount === startingAmount) return;

      this.stopWatching();
      this.showDepositArrived(current, startingAmount);
    }, DEPOSIT_WATCH_INTERVAL_MS);
  }

  stopWatching() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  showDepositArrived(asset, previousRawAmount) {
    this.amount.textContent = `${asset.tokenAmount} ${asset.tokenSymbol}`;
    this.value.textContent = asset.tokenValueUsd === null
      ? 'No price available'
      : formatUsd(asset.tokenValueUsd);

    const received = BigInt(asset.rawAmount) - BigInt(previousRawAmount);
    const banner = document.createElement('div');
    banner.className = 'multichain-deposit-arrived';
    banner.textContent = received > 0n
      ? `Deposit received. Your ${asset.tokenSymbol} balance is now ${asset.tokenAmount}.`
      : `Your ${asset.tokenSymbol} balance changed to ${asset.tokenAmount}.`;
    this.depositPanel.prepend(banner);

    this.controller.assetsModal.render();
    this.controller.updateSummary();
  }

  renderQr(text) {
    const container = document.getElementById('multichainDepositQr');
    if (!container) return;
    try {
      const gifBytes = globalThis.qr.encodeQR(text, 'gif', { scale: 4 });
      const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
      const img = document.createElement('img');
      img.src = `data:image/gif;base64,${base64}`;
      img.width = 200;
      img.height = 200;
      img.alt = 'Deposit address QR code';
      container.appendChild(img);
    } catch (error) {
      console.error('Failed to render deposit QR:', error);
      container.textContent = 'QR unavailable';
    }
  }
}

class MultichainController {
  constructor() {
    this.loaded = false;
    this.assetsModal = new MultichainModal(this);
    this.assetModal = new MultichainAssetModal(this);
  }

  /** Where the signed-in account comes from; without it there is nothing to read. */
  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') {
      intentsAssets.configure({ getAccount });
    }
  }

  load() {
    if (this.loaded) return;
    this.assetsModal.load();
    this.assetModal.load();

    this.summaryButton = document.getElementById('multichainSummary');
    this.summaryValue = document.getElementById('multichainSummaryValue');

    document.getElementById('openMultichain')
      .addEventListener('click', () => this.assetsModal.open());
    this.summaryButton?.addEventListener('click', () => this.assetsModal.open());

    this.loaded = true;
  }

  reset() {
    intentsAssets.reset();
    intentsDeposits.reset();
    if (this.summaryValue) this.summaryValue.textContent = '$0.00';
  }

  close(modalId) {
    if (modalId === 'multichainModal') {
      this.assetsModal.close();
      return true;
    }
    if (modalId === 'multichainAssetModal') {
      this.assetModal.close();
      return true;
    }
    return false;
  }

  refresh(options) {
    return intentsAssets.refresh(options);
  }

  /**
   * The row on the wallet screen. Kept out of the native Total Balance on
   * purpose: that number is the Liberdus balance, and these are not it.
   */
  async updateSummary({ refresh = false } = {}) {
    if (!this.summaryValue) return;
    if (refresh) await intentsAssets.refresh();
    this.summaryValue.textContent = formatUsd(intentsAssets.getTotalUsd());
  }
}

export const multichain = new MultichainController();
export { bridgeChainDisplayName };
