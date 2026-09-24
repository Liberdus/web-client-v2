// The Multichain screens: the wallet surface for balances the verifier holds
// for the account rather than on each asset's own chain.
//
// Shaped after the EVM Assets modal in evm-assets.js -- own menu entry, own
// screens, tap an asset for detail -- because that is the pattern this wallet
// already uses for assets that are not the native Liberdus balance.
//
// Receive, Withdraw and Swap are separate screens rather than panels that open
// underneath the balance. Each is a task with its own focus, and stacking them
// under a shared hero made the asset screen grow a third form every time one
// opened.
//
// Follows DESIGN.md: tokens only, the 8/16/32/48 scale, diagonal action icons
// (a chevron is an expand/collapse glyph), and no protocol nouns in product
// copy -- what the verifier is called belongs in the code, not on the screen.

import { BUTTON_COOLDOWN_MS, escapeHtml, openModal, withButtonCooldown } from './lib.js';
import { intentsAssets } from './intents-assets.js';
import { depositUri, intentsDeposits } from './intents-deposits.js';
import { intentsWithdrawals } from './intents-withdraw.js';
import { intentsSwaps } from './intents-swap.js';
import { signIntentPayload } from './intents.js';
import {
  assetBrandColor, assetIconMarkup, assetLogoUrl, chainBrandColor, chainLogoUrl,
} from './asset-icons.js';
import { formatUnits } from './intents-assets.js';

const CUSTODY_NOTE = 'Held for you, not on each asset’s own chain. Withdraw any time.';

// A deposit lands a minute or two after it is sent, long after the balance was
// last read. Without this the screen sits on a stale zero and looks broken --
// which is exactly how it looked the first time somebody deposited to it.
const DEPOSIT_WATCH_INTERVAL_MS = 10_000;
const DEPOSIT_WATCH_TIMEOUT_MS = 10 * 60_000;

function formatUsd(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/A';
  return `$${amount.toFixed(2)}`;
}

const assetMark = (asset, size) => assetIconMarkup({
  symbol: asset.tokenSymbol,
  blockchain: asset.blockchain,
  contractAddress: asset.contractAddress,
}, { size, escape: escapeHtml });

/**
 * Eighteen decimals is a machine's answer, not a person's. Amounts are cut to
 * a few significant digits wherever they are read rather than typed.
 *
 * Significant rather than fixed decimals: at four decimal places 0.00008510
 * renders as 0.0000, which is not a smaller number but a wrong one.
 */
function formatDisplayAmount(value, significant = 4) {
  const text = String(value ?? '0');
  if (!text.includes('.')) return text;
  const [whole, fraction] = text.split('.');
  if (whole !== '0') {
    const cut = fraction.slice(0, significant).replace(/0+$/, '');
    return cut ? `${whole}.${cut}` : whole;
  }
  const lead = fraction.search(/[1-9]/);
  if (lead === -1) return '0';
  const cut = fraction.slice(0, lead + significant).replace(/0+$/, '');
  return `0.${cut}`;
}

/**
 * A raw token amount as a decimal string, never via Number: at eighteen
 * decimals a fee comes back from Number as "5.6e-7", which is not a number
 * anyone can check against their wallet.
 */
function formatRawAmount(raw, decimals, significant = 4) {
  if (raw === null || raw === undefined || raw === '') return '0';
  try {
    return formatDisplayAmount(formatUnits(raw, decimals), significant);
  } catch {
    return '0';
  }
}

/** Head and tail are what anyone checks; the middle is what can go. */
function truncateAddress(address) {
  const text = String(address ?? '');
  return text.length <= 24 ? text : `${text.slice(0, 10)}…${text.slice(-8)}`;
}

/**
 * An <option> that carries its asset's mark.
 *
 * The icon travels as data attributes rather than markup: an <option> cannot
 * hold an image, and PopupSelect -- which stands in for the native control --
 * renders them.
 */
function assetOption(asset, { value, label }) {
  const url = assetLogoUrl({
    symbol: asset.tokenSymbol,
    blockchain: asset.blockchain,
    contractAddress: asset.contractAddress,
  });
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  option.dataset.iconLabel = asset.tokenSymbol.slice(0, 3);
  option.dataset.iconColor = assetBrandColor(asset.tokenSymbol);
  if (url) option.dataset.iconUrl = url;
  return option;
}

/** An <option> for a network, carrying that chain's own mark. */
function chainOption({ value, chainName, blockchain }) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = chainName;
  option.dataset.iconLabel = chainName.slice(0, 3).toUpperCase();
  option.dataset.iconColor = chainBrandColor(blockchain);
  const url = chainLogoUrl(blockchain);
  if (url) option.dataset.iconUrl = url;
  return option;
}

function placeholderOption(label) {
  const option = document.createElement('option');
  option.value = '';
  option.textContent = label;
  option.disabled = true;
  option.selected = true;
  return option;
}

/** "SOL (Solana)" -- the title says both, so no screen repeats it underneath. */
function assetTitle(asset) {
  return asset.chainName ? `${asset.tokenSymbol} (${asset.chainName})` : asset.tokenSymbol;
}

class MultichainModal {
  constructor(controller) {
    this.controller = controller;
  }

  load() {
    this.modal = document.getElementById('multichainModal');
    this.totalBalance = document.getElementById('multichainTotalBalance');
    this.caption = document.getElementById('multichainHeroCaption');
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
    await this.controller.refresh({ force });
    this.render();
    this.controller.updateSummary();
  }

  render() {
    const network = intentsAssets.getNetwork();
    const status = intentsAssets.getStatus();
    const held = network.assets.filter((asset) => asset.rawAmount !== '0');

    this.totalBalance.textContent = formatUsd(network.totalValueUsd);
    // Says where the money actually is, which a bare total does not.
    this.caption.textContent = held.length
      ? `Across ${new Set(held.map((a) => a.chainName)).size} networks`
      : 'Total value';
    this.statusLine.dataset.status = status;
    this.statusLine.textContent = status === 'unavailable'
      ? 'Balances are unavailable right now. Refresh to try again.'
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

    this.assetsList.innerHTML = network.assets.map((asset) => `
      <button
        type="button"
        class="multichain-row multichain-asset-button${asset.rawAmount === '0' ? ' is-empty' : ''}"
        data-asset-key="${escapeHtml(asset.key)}"
        aria-label="${escapeHtml(assetTitle(asset))}"
      >
        ${assetMark(asset, 40)}
        <span class="multichain-row-main">
          <span class="multichain-row-name">${escapeHtml(asset.tokenSymbol)}</span>
          <span class="multichain-row-chain">${escapeHtml(asset.chainName)}</span>
        </span>
        <span class="multichain-row-values">
          <span class="multichain-row-amount">${escapeHtml(formatDisplayAmount(asset.tokenAmount))}</span>
          <span class="multichain-row-usd">${escapeHtml(
            asset.tokenValueUsd === null ? 'Unpriced' : formatUsd(asset.tokenValueUsd),
          )}</span>
        </span>
      </button>
    `).join('');
  }
}

class MultichainAssetModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
  }

  load() {
    this.modal = document.getElementById('multichainAssetModal');
    this.title = document.getElementById('multichainAssetTitle');
    this.icon = document.getElementById('multichainAssetIcon');
    this.amount = document.getElementById('multichainAssetAmount');
    this.value = document.getElementById('multichainAssetValue');
    this.receiveButton = document.getElementById('multichainAssetReceive');
    this.withdrawButton = document.getElementById('multichainAssetWithdraw');
    this.swapButton = document.getElementById('multichainAssetSwap');

    document.getElementById('closeMultichainAssetModal')
      .addEventListener('click', () => this.close());
    this.receiveButton.addEventListener('click', () => this.controller.receiveModal.open(this.assetKey));
    this.withdrawButton.addEventListener('click', () => this.controller.withdrawModal.open(this.assetKey));
    this.swapButton.addEventListener('click', () => this.controller.swapModal.open(this.assetKey));
  }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.render();
    openModal(this.modal);
  }

  render() {
    const asset = intentsAssets.getAsset(this.assetKey);
    if (!asset) return;
    // The title carries symbol and chain, so the body never repeats them.
    this.title.textContent = assetTitle(asset);
    this.icon.innerHTML = assetMark(asset, 64);
    this.amount.textContent = `${formatDisplayAmount(asset.tokenAmount)} ${asset.tokenSymbol}`;
    this.value.textContent = asset.tokenValueUsd === null
      ? 'No price available'
      : formatUsd(asset.tokenValueUsd);
    // Nothing to send is not a state worth offering a form for.
    this.withdrawButton.disabled = asset.rawAmount === '0';
    this.swapButton.disabled = asset.rawAmount === '0';
  }

  close() {
    this.modal.classList.remove('active');
    this.controller.assetsModal.render();
    this.controller.updateSummary();
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * Receive: the deposit address is the whole screen.
 *
 * Watches the balance while it is open, because a deposit lands a minute or
 * two after it is sent and a screen that never updates reads as broken.
 */
class MultichainReceiveModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
    this.watchTimer = null;
    this.watchUntil = 0;
  }

  load() {
    this.modal = document.getElementById('multichainReceiveModal');
    this.title = document.getElementById('multichainReceiveTitle');
    this.body = document.getElementById('multichainReceiveBody');
    document.getElementById('closeMultichainReceiveModal')
      .addEventListener('click', () => this.close());
  }

  async open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    const accountId = intentsAssets.getAccountId();
    if (!asset || !accountId) return;

    this.assetKey = assetKey;
    this.title.textContent = `Receive ${assetTitle(asset)}`;
    this.body.innerHTML = '<div class="multichain-quote-working">Getting your deposit address…</div>';
    this.stopWatching();
    openModal(this.modal);

    try {
      const target = await intentsDeposits.requestDepositTarget(accountId, asset.assetId);
      this.render(target);
      this.startWatching(asset);
    } catch (error) {
      console.warn('Deposit address unavailable:', error);
      this.body.innerHTML =
        `<div class="multichain-quote-error">${escapeHtml(error.message || 'Could not get a deposit address right now.')}</div>`;
    }
  }

  render(target) {
    // On a memo chain the QR carries the bare address: a payment URI that drops
    // the memo would scan cleanly and lose the deposit.
    const uri = target.memo ? null : depositUri(target.chain, target.address);
    const rules = [];
    if (target.memo) {
      rules.push(`Include the memo <strong>${escapeHtml(target.memo)}</strong>. Without it the deposit is lost.`);
    }
    rules.push(`Send at least <strong>${escapeHtml(target.minDeposit)} ${escapeHtml(target.assetName)}</strong>.`);
    rules.push(`Send only on <strong>${escapeHtml(target.chainName)}</strong>. Another chain's funds are lost.`);
    if (target.siblings > 0) {
      rules.push(`This chain carries more than one ${escapeHtml(target.assetName)} token; check your balance after the first deposit.`);
    }

    this.body.innerHTML = `
      <div class="multichain-qr" id="multichainDepositQr"></div>
      <button type="button" class="multichain-address" id="multichainDepositAddress"
        data-address="${escapeHtml(target.address)}">
        <span class="multichain-address-value">${escapeHtml(target.address)}</span>
        <span class="multichain-address-copy">Copy</span>
      </button>
      ${target.memo ? `<div class="multichain-memo">Memo <strong>${escapeHtml(target.memo)}</strong></div>` : ''}
      <ul class="multichain-rules">
        ${rules.map((rule) => `<li>${rule}</li>`).join('')}
      </ul>
    `;
    this.renderQr(uri || target.address);

    document.getElementById('multichainDepositAddress')
      ?.addEventListener('click', (event) => this.copyAddress(event.currentTarget));
  }

  /** The whole pill is the target: a small icon next to a long string is a
   *  harder thing to hit than the string itself. */
  async copyAddress(button) {
    const label = button.querySelector('.multichain-address-copy');
    try {
      await navigator.clipboard.writeText(button.dataset.address);
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = 'Copy'; }, 2000);
    } catch (error) {
      console.warn('Could not copy the deposit address:', error);
      label.textContent = 'Press and hold to copy';
    }
  }

  renderQr(text) {
    const container = document.getElementById('multichainDepositQr');
    if (!container) return;
    try {
      const gifBytes = globalThis.qr.encodeQR(text, 'gif', { scale: 4 });
      const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
      const img = document.createElement('img');
      img.src = `data:image/gif;base64,${base64}`;
      img.alt = 'Deposit address QR code';
      // Left at its natural size: forcing a width puts module edges on
      // fractional pixels, and the module count changes with the payload.
      container.appendChild(img);
    } catch (error) {
      console.error('Failed to render deposit QR:', error);
      container.textContent = 'QR unavailable';
    }
  }

  startWatching(asset) {
    this.stopWatching();
    const startingAmount = asset.rawAmount;
    const assetKey = this.assetKey;
    this.watchUntil = Date.now() + DEPOSIT_WATCH_TIMEOUT_MS;

    this.watchTimer = setInterval(async () => {
      if (!this.isActive() || this.assetKey !== assetKey || Date.now() > this.watchUntil) {
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
      const banner = document.createElement('div');
      banner.className = 'multichain-arrived';
      banner.textContent = `Deposit received. Your ${current.tokenSymbol} balance is now ${current.tokenAmount}.`;
      this.body.prepend(banner);
      this.controller.assetModal.render();
      this.controller.assetsModal.render();
      this.controller.updateSummary();
    }, DEPOSIT_WATCH_INTERVAL_MS);
  }

  stopWatching() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  close() {
    this.stopWatching();
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * The confirmation, on its own screen.
 *
 * Shared by withdraw and swap: both end with the same question -- here are the
 * figures, do it or go back. Putting it under the form meant the numbers and
 * the fields that produced them were on screen together, and editing a field
 * left a quote describing a different transaction just below it.
 */
class MultichainConfirmModal {
  constructor(controller) {
    this.controller = controller;
    this.run = null;
  }

  load() {
    this.modal = document.getElementById('multichainConfirmModal');
    this.title = document.getElementById('multichainConfirmTitle');
    this.hero = document.getElementById('multichainConfirmHero');
    this.rows = document.getElementById('multichainConfirmRows');
    this.action = document.getElementById('multichainConfirmAction');
    this.note = document.getElementById('multichainConfirmNote');
    this.status = document.getElementById('multichainConfirmStatus');

    document.getElementById('closeMultichainConfirmModal')
      .addEventListener('click', () => this.close());
    this.action.addEventListener('click', () => this.confirm());
  }

  open({ title, hero, rows, actionLabel, note, run }) {
    this.run = run;
    this.title.textContent = title;
    this.hero.innerHTML = hero;
    this.rows.innerHTML = rows.map(([label, value, emphasis]) => `
      <dt>${escapeHtml(label)}</dt>
      <dd${emphasis ? ' class="is-guaranteed"' : ''}>${escapeHtml(String(value))}</dd>
    `).join('');
    this.action.textContent = actionLabel;
    this.action.disabled = false;
    this.note.textContent = note || '';
    this.status.hidden = true;
    this.show();
  }

  /**
   * openModal ignores a request while another modal is still transitioning,
   * and this screen is opened programmatically the moment a quote lands -- so
   * a refusal has to be retried rather than silently dropping the screen the
   * person is waiting for.
   */
  show(attempt = 0) {
    if (openModal(this.modal) || this.modal.classList.contains('active')) return;
    if (attempt >= 8) {
      console.warn('Confirmation screen could not be opened');
      return;
    }
    setTimeout(() => this.show(attempt + 1), 60);
  }

  setStatus(message, kind = '') {
    this.status.hidden = false;
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  async confirm() {
    if (!this.run) return;
    this.action.disabled = true;
    try {
      await this.run(this);
    } catch (error) {
      this.setStatus(error.message || 'That did not go through.', 'error');
      this.action.disabled = false;
    }
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

class MultichainWithdrawModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
  }

  load() {
    this.modal = document.getElementById('multichainWithdrawModal');
    this.title = document.getElementById('multichainWithdrawTitle');
    this.networkField = document.getElementById('multichainWithdrawNetworkField');
    this.networkSelect = document.getElementById('multichainWithdrawNetwork');
    this.to = document.getElementById('multichainWithdrawTo');
    this.amount = document.getElementById('multichainWithdrawAmount');
    this.max = document.getElementById('multichainWithdrawMax');
    this.available = document.getElementById('multichainWithdrawAvailable');
    this.previewButton = document.getElementById('multichainWithdrawPreview');
    this.status = document.getElementById('multichainWithdrawStatus');

    document.getElementById('closeMultichainWithdrawModal')
      .addEventListener('click', () => this.close());
    this.previewButton.addEventListener('click', () => this.preview());
    this.max.addEventListener('click', () => {
      const asset = intentsAssets.getAsset(this.assetKey);
      if (asset) this.amount.value = asset.tokenAmount;
    });
  }

  /** Where this symbol can land. One chain means no question to ask. */
  destinations() {
    const asset = intentsAssets.getAsset(this.assetKey);
    if (!asset) return [];
    return intentsAssets.listCatalogAssets()
      .filter((candidate) => candidate.tokenSymbol === asset.tokenSymbol);
  }

  selectedDestination() {
    return this.destinations().find((asset) => asset.key === this.networkSelect.value) || null;
  }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.title.textContent = `Withdraw ${asset.tokenSymbol}`;
    this.to.value = '';
    this.amount.value = '';
    this.available.textContent = `Available ${formatDisplayAmount(asset.tokenAmount, 6)} ${asset.tokenSymbol}`;
    this.status.hidden = true;

    // Only ask when there is a choice: a single-chain asset has one answer,
    // and the field stays hidden rather than posing a question with one option.
    const destinations = this.destinations();
    const several = destinations.length > 1;
    this.networkField.hidden = !several;
    this.networkSelect.replaceChildren();
    if (several) this.networkSelect.append(placeholderOption('Choose a network'));
    for (const candidate of destinations) {
      this.networkSelect.append(chainOption({
        value: candidate.key,
        chainName: candidate.chainName,
        blockchain: candidate.blockchain,
      }));
    }
    if (!several) this.networkSelect.value = assetKey;
    this.controller.syncSelect(this.networkSelect);
    openModal(this.modal);
    // A modal is still off-screen when this runs; focusing without
    // preventScroll parks it there (DESIGN.md §6).
    setTimeout(() => this.to.focus({ preventScroll: true }), 350);
  }

  async preview() {
    const asset = intentsAssets.getAsset(this.assetKey);
    const accountId = intentsAssets.getAccountId();
    if (!asset || !accountId) return;

    const destinationAsset = this.selectedDestination();
    this.status.hidden = true;
    this.previewButton.disabled = true;
    this.setStatus('Pricing…');

    try {
      const quote = await intentsWithdrawals.preview({
        accountId, asset, destinationAsset,
        destinationAddress: this.to.value.trim(),
        amount: this.amount.value.trim(),
      });
      this.status.hidden = true;
      this.openConfirm(asset, destinationAsset, quote);
    } catch (error) {
      this.setStatus(error.message || 'Could not price that withdrawal.', 'error');
    } finally {
      this.previewButton.disabled = false;
    }
  }

  openConfirm(asset, destinationAsset, quote) {
    const chain = (destinationAsset || asset).chainName;
    const symbol = asset.tokenSymbol;

    this.controller.confirmModal.open({
      title: 'Confirm withdrawal',
      hero: `${assetMark(asset, 56)}
        <div class="multichain-confirm-amount">${escapeHtml(formatDisplayAmount(quote.amountOut))} ${escapeHtml(symbol)}</div>
        <div class="multichain-confirm-sub">estimated, arriving on ${escapeHtml(chain)}</div>`,
      rows: [
        ['You send', `${formatDisplayAmount(quote.amountIn)} ${symbol}`],
        ['Network fee', `${formatRawAmount(quote.withdrawFee, asset.tokenDecimals)} ${symbol}`],
        ['You receive', `${formatDisplayAmount(quote.amountOut)} ${symbol}`],
        ['To', truncateAddress(quote.destinationAddress)],
        ['Arrives in about', `${quote.timeEstimateSeconds}s`],
      ],
      // The figures are directly above; repeating one in the button only makes
      // the label wrap.
      actionLabel: `Withdraw ${symbol}`,
      note: 'This cannot be undone.',
      run: (sheet) => this.run(sheet, destinationAsset),
    });
  }

  setStatus(message, kind = '') {
    this.status.hidden = false;
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  async run(sheet, destinationAsset) {
    const asset = intentsAssets.getAsset(this.assetKey);
    const accountId = intentsAssets.getAccountId();
    const secretKey = this.controller.getSecretKey();
    if (!asset || !accountId || !secretKey) return;

    sheet.setStatus('Getting a live quote…');

    try {
      const prepared = await intentsWithdrawals.prepare({
        accountId, asset, destinationAsset,
        destinationAddress: this.to.value.trim(),
        amount: this.amount.value.trim(),
      });

      // Rehearse before spending the relay's gas, and publish the signature
      // the verifier approved rather than a re-signed equivalent.
      sheet.setStatus('Checking…');
      const signed = await signIntentPayload(prepared.payload, secretKey);
      const check = await intentsWithdrawals.simulate(signed);
      if (!check.ok) {
        sheet.setStatus(`This withdrawal would fail: ${check.reason}`, 'error');
        sheet.action.disabled = false;
        return;
      }

      sheet.setStatus('Sending…');
      const outcome = await intentsWithdrawals.execute(prepared, secretKey, {
        signed,
        onStatus: (update) => sheet.setStatus(`Status: ${update.status.toLowerCase()}`),
      });

      sheet.setStatus(
        outcome.status === 'SUCCESS'
          ? `Sent. About ${prepared.amountOut} ${asset.tokenSymbol} is on its way.`
          : `Finished with status ${outcome.status}.`,
        outcome.status === 'SUCCESS' ? 'ok' : 'error',
      );
      await this.controller.refreshAfterMove();
      const updated = intentsAssets.getAsset(this.assetKey);
      if (updated) this.available.textContent = `Available ${formatDisplayAmount(updated.tokenAmount, 6)} ${updated.tokenSymbol}`;
    } catch (error) {
      sheet.setStatus(error.message || 'The withdrawal failed.', 'error');
      sheet.action.disabled = false;
    }
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * Swap: pick a network, then an asset on it.
 *
 * One flat list of every asset the catalog carries is hundreds of rows in which
 * the same symbol appears on six chains. Choosing the network first cuts it to
 * a handful and makes the second choice unambiguous -- USDC on Base and USDC on
 * Solana are different assets, and a single list hides that.
 */
class MultichainSwapModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
  }

  load() {
    this.modal = document.getElementById('multichainSwapModal');
    this.title = document.getElementById('multichainSwapTitle');
    this.networkSelect = document.getElementById('multichainSwapNetwork');
    this.assetSelect = document.getElementById('multichainSwapTo');
    this.amount = document.getElementById('multichainSwapAmount');
    this.max = document.getElementById('multichainSwapMax');
    this.available = document.getElementById('multichainSwapAvailable');
    this.previewButton = document.getElementById('multichainSwapPreview');
    this.status = document.getElementById('multichainSwapStatus');

    document.getElementById('closeMultichainSwapModal')
      .addEventListener('click', () => this.close());
    this.previewButton.addEventListener('click', () => this.preview());
    this.max.addEventListener('click', () => {
      const asset = intentsAssets.getAsset(this.assetKey);
      if (asset) this.amount.value = asset.tokenAmount;
    });
    this.networkSelect.addEventListener('change', () => this.renderAssetOptions());
  }

  /** Everything the catalog carries, minus the asset being spent. */
  candidates() {
    const from = intentsAssets.getAsset(this.assetKey);
    return intentsAssets.listCatalogAssets()
      .filter((asset) => asset.assetId !== from?.assetId);
  }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.title.textContent = `Swap ${asset.tokenSymbol}`;
    this.amount.value = '';
    this.available.textContent = `Available ${formatDisplayAmount(asset.tokenAmount, 6)} ${asset.tokenSymbol}`;
    this.status.hidden = true;

    // A placeholder rather than a silently pre-selected network: the first
    // chain alphabetically is not a choice anyone made.
    // Keep the chain id each display name came from; the mark needs it.
    const networks = new Map();
    for (const candidate of this.candidates()) {
      if (!networks.has(candidate.chainName)) networks.set(candidate.chainName, candidate.blockchain);
    }
    this.networkSelect.replaceChildren(placeholderOption('Choose a network'));
    for (const [chainName, blockchain] of [...networks].sort((a, b) => a[0].localeCompare(b[0]))) {
      this.networkSelect.append(chainOption({ value: chainName, chainName, blockchain }));
    }
    this.controller.syncSelect(this.networkSelect);
    this.renderAssetOptions();
    openModal(this.modal);
  }

  renderAssetOptions() {
    const chainName = this.networkSelect.value;
    const options = chainName
      ? this.candidates().filter((asset) => asset.chainName === chainName)
      : [];
    this.assetSelect.replaceChildren(
      placeholderOption(chainName ? 'Choose an asset' : 'Choose a network first'),
    );
    for (const asset of options) {
      this.assetSelect.append(assetOption(asset, { value: asset.key, label: asset.tokenSymbol }));
    }
    this.assetSelect.disabled = options.length === 0;
    this.controller.syncSelect(this.assetSelect);
  }

  async preview() {
    const fromAsset = intentsAssets.getAsset(this.assetKey);
    const toAsset = intentsAssets.getCatalogAsset(this.assetSelect.value);
    const accountId = intentsAssets.getAccountId();
    if (!fromAsset || !toAsset || !accountId) return;

    this.previewButton.disabled = true;
    this.setStatus('Pricing…');

    try {
      const quote = await intentsSwaps.preview({
        accountId, fromAsset, toAsset, amount: this.amount.value.trim(),
      });
      this.status.hidden = true;
      this.openConfirm(fromAsset, toAsset, quote);
    } catch (error) {
      this.setStatus(error.message || 'Could not price that swap.', 'error');
    } finally {
      this.previewButton.disabled = false;
    }
  }

  /**
   * The rate moves between quoting and filling, so the guaranteed minimum is
   * what the hero states: it is the number actually being agreed to, and the
   * estimate is the optimistic one.
   */
  openConfirm(fromAsset, toAsset, quote) {
    this.controller.confirmModal.open({
      title: 'Confirm swap',
      hero: `${assetMark(toAsset, 56)}
        <div class="multichain-confirm-amount">${escapeHtml(formatDisplayAmount(quote.minAmountOut ?? quote.amountOut))} ${escapeHtml(toAsset.tokenSymbol)}</div>
        <div class="multichain-confirm-sub">at least, on ${escapeHtml(toAsset.chainName)}</div>`,
      rows: [
        ['You swap', `${formatDisplayAmount(quote.amountIn)} ${fromAsset.tokenSymbol}`],
        ['Estimated', `${formatDisplayAmount(quote.amountOut)} ${toAsset.tokenSymbol}`],
        ['Guaranteed at least', `${quote.minAmountOut ? formatDisplayAmount(quote.minAmountOut) : '—'} ${toAsset.tokenSymbol}`, true],
        ['Takes about', `${quote.timeEstimateSeconds}s`],
      ],
      actionLabel: `Swap ${fromAsset.tokenSymbol}`,
      note: `The rate can move. You get at least the guaranteed amount, or your ${fromAsset.tokenSymbol} back.`,
      run: (sheet) => this.run(sheet),
    });
  }

  setStatus(message, kind = '') {
    this.status.hidden = false;
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  async run(sheet) {
    const fromAsset = intentsAssets.getAsset(this.assetKey);
    const toAsset = intentsAssets.getCatalogAsset(this.assetSelect.value);
    const accountId = intentsAssets.getAccountId();
    const secretKey = this.controller.getSecretKey();
    if (!fromAsset || !toAsset || !accountId || !secretKey) return;

    sheet.setStatus('Getting a live quote…');

    try {
      const prepared = await intentsSwaps.prepare({
        accountId, fromAsset, toAsset, amount: this.amount.value.trim(),
      });

      sheet.setStatus('Checking…');
      const signed = await signIntentPayload(prepared.payload, secretKey);
      const check = await intentsSwaps.simulate(signed);
      if (!check.ok) {
        sheet.setStatus(`This swap would fail: ${check.reason}`, 'error');
        sheet.action.disabled = false;
        return;
      }

      sheet.setStatus('Swapping…');
      const outcome = await intentsSwaps.execute(prepared, secretKey, {
        signed,
        onStatus: (update) => sheet.setStatus(`Status: ${update.status.toLowerCase()}`),
      });

      if (outcome.status === 'SUCCESS') {
        sheet.setStatus(`Swapped. Your ${toAsset.tokenSymbol} is in your wallet.`, 'ok');
      } else if (outcome.refunded) {
        // Not a failure: the floor protected the person from a worse fill.
        sheet.setStatus(
          `Could not fill at the agreed rate, so your ${fromAsset.tokenSymbol} was returned.`,
          'error',
        );
      } else {
        sheet.setStatus(`Finished with status ${outcome.status}.`, 'error');
      }

      await this.controller.refreshAfterMove();
      const updated = intentsAssets.getAsset(this.assetKey);
      if (updated) this.available.textContent = `Available ${formatDisplayAmount(updated.tokenAmount, 6)} ${updated.tokenSymbol}`;
    } catch (error) {
      sheet.setStatus(error.message || 'The swap failed.', 'error');
      sheet.action.disabled = false;
    }
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

class MultichainController {
  constructor() {
    this.loaded = false;
    this.getAccount = () => null;
    this.syncSelect = () => {};
    this.assetsModal = new MultichainModal(this);
    this.assetModal = new MultichainAssetModal(this);
    this.receiveModal = new MultichainReceiveModal(this);
    this.withdrawModal = new MultichainWithdrawModal(this);
    this.swapModal = new MultichainSwapModal(this);
    this.confirmModal = new MultichainConfirmModal(this);
  }

  /** Where the signed-in account comes from; without it there is nothing to read. */
  getSecretKey() {
    return this.getAccount()?.keys?.secret || null;
  }

  configure({ getAccount, syncSelect } = {}) {
    if (typeof getAccount === 'function') {
      this.getAccount = getAccount;
      intentsAssets.configure({ getAccount });
    }
    if (typeof syncSelect === 'function') this.syncSelect = syncSelect;
  }

  load() {
    if (this.loaded) return;
    this.assetsModal.load();
    this.assetModal.load();
    this.receiveModal.load();
    this.withdrawModal.load();
    this.swapModal.load();
    this.confirmModal.load();

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
    const screens = {
      multichainModal: this.assetsModal,
      multichainAssetModal: this.assetModal,
      multichainReceiveModal: this.receiveModal,
      multichainWithdrawModal: this.withdrawModal,
      multichainSwapModal: this.swapModal,
      multichainConfirmModal: this.confirmModal,
    };
    if (!screens[modalId]) return false;
    screens[modalId].close();
    return true;
  }

  refresh(options) {
    return intentsAssets.refresh(options);
  }

  /** After money moves, every screen showing a balance is stale. */
  async refreshAfterMove() {
    await intentsAssets.refresh({ force: true });
    this.assetModal.render();
    this.assetsModal.render();
    this.updateSummary();
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
