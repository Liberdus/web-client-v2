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
import { parseTokenAmount } from './intents-transfer.js';
import { signIntentPayload } from './intents.js';
import { assetIconMarkup, chainBrandColor, chainLogoUrl } from './asset-icons.js';
import { formatUnits } from './intents-assets.js';
import { intentsActivity, orderStatusFrom } from './intents-activity.js';

// What a new account is offered first: the largest coins, each on the one
// network its chip names. Six, so they sit in two even rows of three.
//
// USDT is the one that exists on many chains, so its chip -- like every
// chip -- carries its network, and its receive screen says the same: USDT on
// Tron sent to this address is lost.
const QUICK_RECEIVE = Object.freeze([
  'nep141:btc.omft.near',
  'nep141:eth.omft.near',
  'nep141:sol.omft.near',
  'nep141:xrp.omft.near',
  'nep245:v2_1.omni.hot.tg:56_11111111111111111111', // BNB on BNB Chain
  'nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near', // USDT on Ethereum
]);

// The hero total: thousands separated, always two decimals. formatUsd has
// neither separator nor grouping, and "$12345.67" is hard to read at 44px.
const heroUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// A skeleton row stands in for an asset while the first balances load. Three
// is enough to read as "a list is coming" without promising how long it is.
const SKELETON_ROW = `
  <div class="multichain-row is-skeleton" aria-hidden="true">
    <span class="multichain-skeleton is-mark"></span>
    <span class="multichain-row-main">
      <span class="multichain-skeleton is-name"></span>
      <span class="multichain-skeleton is-sub"></span>
    </span>
    <span class="multichain-row-values">
      <span class="multichain-skeleton is-name"></span>
      <span class="multichain-skeleton is-sub"></span>
    </span>
  </div>`;

// Once an order has been published its outcome can be unknown -- a settlement
// check that throws does not mean nothing was sent. Saying so, and pointing at
// the balance, is the only honest answer; offering the button again is how a
// second copy of the same order gets sent.
export const UNCONFIRMED = 'We could not confirm this went through. Check your balance before trying again.';
const SLOW = 'This is taking longer than usual. Check your balance in a few minutes before trying again.';
const NOT_THROUGH = 'This did not go through. Check your balance before trying again.';

// A deposit lands a minute or two after it is sent, long after the balance was
// last read. Without this the screen sits on a stale zero and looks broken --
// which is exactly how it looked the first time somebody deposited to it.
const DEPOSIT_WATCH_INTERVAL_MS = 10_000;
const DEPOSIT_WATCH_TIMEOUT_MS = 10 * 60_000;

export function formatUsd(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/A';
  return `$${amount.toFixed(2)}`;
}

export const assetMark = (asset, size) => assetIconMarkup({
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
export function formatDisplayAmount(value, significant = 4) {
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

/**
 * What is wrong with an amount typed against a balance: '' while there is
 * nothing to judge yet, a message when it cannot be sent, null when it can.
 *
 * Checked on the device rather than left to a quote or a simulation: an
 * amount over the balance would still price, and a figure for money you do
 * not have is a promise the next screen would have to take back.
 */
export function checkAmount(asset, value) {
  const text = String(value ?? '').trim();
  // Nothing typed yet, or only the start of a decimal, is not a mistake.
  if (!asset || !text || text === '.') return '';
  let raw;
  try {
    raw = parseTokenAmount(text, asset.tokenDecimals);
  } catch (error) {
    return error.message;
  }
  if (raw <= 0n) return '';
  if (raw > BigInt(asset.rawAmount)) return `That is more than your ${asset.tokenSymbol} balance.`;
  return null;
}

export const priceOf = (asset) => {
  const price = Number(asset?.tokenPriceUsd);
  return price > 0 ? price : null;
};

/**
 * Dollars typed, as a token amount.
 *
 * Six significant digits, rounded down: short enough to read back on a
 * confirmation -- a raw quotient at nine or eighteen decimals is not -- and
 * never more than the dollars typed. Returns '' when there is nothing to use.
 */
export function usdToTokenAmount(usd, asset) {
  const price = priceOf(asset);
  const dollars = Number(usd);
  if (!price || !(dollars > 0)) return '';
  const exact = dollars / price;
  const magnitude = Math.floor(Math.log10(exact));
  const places = Math.max(0, Math.min(asset.tokenDecimals, 5 - magnitude));
  const units = Math.floor(exact * 10 ** places);
  if (units <= 0) return '';
  const text = (units / 10 ** places).toFixed(places);
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

// Inline so it takes the control's colour (DESIGN.md §6).
const FLIP_ICON = '<svg class="multichain-amount-flip-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" '
  + 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/></svg>';

/**
 * An amount you can type in the token or in dollars.
 *
 * One control for every screen that spends an asset -- send and swap -- so
 * the rules below cannot drift between them:
 *
 *  - The figure under the field is the other unit, and tapping it switches.
 *  - What is spent is always a token amount. Dollars convert through
 *    usdToTokenAmount, rounded down.
 *  - A figure derived from a token amount (Max, or switching to dollars) is
 *    only a view: the exact token amount behind it is what gets spent, until
 *    the person types. Flipping 0.005 SOL to $0.59 and back must give 0.005,
 *    not a cents-rounded 0.00499153; Max must mean the whole balance.
 *  - No price, no dollars: the switch is hidden rather than guessing.
 */
export class AmountField {
  constructor({ input, currency, flip, balance, max, getAsset, onChange = () => {} }) {
    Object.assign(this, { input, currency, flip, balance, max, getAsset, onChange });
    this.unit = 'token';
    this.exactToken = null;
    input.addEventListener('input', () => {
      this.exactToken = null;
      this.changed();
    });
    flip.addEventListener('click', () => this.flipUnit());
    max.addEventListener('click', () => this.fillMax());
  }

  reset() {
    this.unit = 'token';
    this.exactToken = null;
    this.input.value = '';
    this.render();
  }

  /** A new asset: typed dollars stay put and convert at the new price. */
  assetChanged() {
    this.exactToken = null;
    this.changed();
  }

  changed() {
    this.render();
    this.onChange();
  }

  /**
   * The token amount this field describes, whichever unit it is typed in.
   * '' when nothing is typed; null when what is typed cannot be read.
   */
  tokenAmount() {
    const asset = this.getAsset();
    if (!asset) return '';
    if (this.exactToken !== null) return this.exactToken;
    const text = this.input.value.trim();
    if (this.unit === 'token') return text;
    if (!/^\d*\.?\d*$/.test(text)) return null;
    return usdToTokenAmount(text, asset);
  }

  /** '' while there is nothing to judge, a message when it cannot be spent, null when it can. */
  problem() {
    const asset = this.getAsset();
    const amount = this.tokenAmount();
    if (amount === null) return 'Enter an amount using digits only';
    if (this.unit === 'usd' && asset && Number(this.input.value) > 0 && !amount) {
      return `That is less than the smallest amount of ${asset.tokenSymbol} you can use.`;
    }
    return checkAmount(asset, amount);
  }

  fillMax() {
    const asset = this.getAsset();
    if (!asset) return;
    this.exactToken = asset.tokenAmount;
    this.input.value = this.unit === 'usd'
      ? (Number(asset.tokenAmount) * priceOf(asset)).toFixed(2)
      : asset.tokenAmount;
    this.changed();
  }

  flipUnit() {
    const price = priceOf(this.getAsset());
    if (!price) return;
    const amount = this.tokenAmount();
    if (this.unit === 'token') {
      this.unit = 'usd';
      this.input.value = Number(amount) > 0 ? (Number(amount) * price).toFixed(2) : '';
      // The dollars shown are rounded; what is spent stays what was typed.
      this.exactToken = Number(amount) > 0 ? amount : null;
    } else {
      this.unit = 'token';
      this.input.value = amount || '';
      this.exactToken = null;
    }
    this.changed();
    this.input.focus({ preventScroll: true });
  }

  setLocked(locked) {
    for (const control of [this.input, this.max, this.flip]) control.disabled = locked;
  }

  render() {
    const asset = this.getAsset();
    const price = priceOf(asset);
    if (!price && this.unit === 'usd') {
      this.unit = 'token';
      this.exactToken = null;
    }
    const inUsd = this.unit === 'usd';
    this.currency.hidden = !inUsd;
    this.input.placeholder = inUsd ? '0.00' : '0';

    // In the unit being typed, so what you can afford reads without converting.
    this.balance.textContent = !asset ? ''
      : inUsd ? `Balance ${formatUsd(Number(asset.tokenAmount) * price)}`
        : `Balance ${formatDisplayAmount(asset.tokenAmount, 6)}`;

    this.flip.hidden = !price;
    if (!price || !asset) return;
    const amount = this.tokenAmount();
    const value = Number(amount);
    const other = inUsd
      ? (value > 0 ? `≈ ${formatDisplayAmount(amount, 6)} ${asset.tokenSymbol}` : `Enter in ${asset.tokenSymbol}`)
      : (value > 0 ? `≈ ${formatUsd(value * price)}` : 'Enter in USD');
    this.flip.innerHTML = `<span>${escapeHtml(other)}</span>${FLIP_ICON}`;
    this.flip.setAttribute('aria-label', `Enter the amount in ${inUsd ? asset.tokenSymbol : 'US dollars'}`);
  }
}

/** Head and tail are what anyone checks; the middle is what can go. */
function truncateAddress(address) {
  const text = String(address ?? '');
  return text.length <= 24 ? text : `${text.slice(0, 10)}…${text.slice(-8)}`;
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
    this.receiveButton = document.getElementById('multichainReceiveAny');
    this.receiveButton.addEventListener('click', () => this.controller.startDeposit());
    this.sendButton = document.getElementById('multichainSendAny');
    // No asset chosen: the send screen starts on the largest holding.
    this.sendButton.addEventListener('click', () => this.controller.onSend(null));
    this.listHead = document.getElementById('multichainListHead');
    this.hideEmpty = document.getElementById('multichainHideEmpty');
    this.hideEmpty.addEventListener('change', () => {
      this.controller.updateSettings({ hideEmpty: this.hideEmpty.checked });
      this.render();
    });
    this.empty = document.getElementById('multichainEmpty');
    this.quick = document.getElementById('multichainQuick');
    this.quick.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-asset-key]');
      if (chip) this.controller.receiveModal.open(chip.dataset.assetKey);
    });

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

  /**
   * Balances already read are shown at once and refreshed behind a spinning
   * icon; only a first read, with nothing to show, gets the skeleton. A
   * screen that blanks itself on every refresh reads as losing your money.
   */
  async update({ force = false } = {}) {
    if (intentsAssets.getStatus() === 'connected') this.render();
    else this.renderLoading();
    this.setRefreshing(true);
    try {
      await this.controller.refresh({ force });
    } finally {
      this.setRefreshing(false);
    }
    this.render();
    this.controller.updateSummary();
  }

  setRefreshing(on) {
    this.refreshButton.classList.toggle('is-loading', on);
    this.refreshButton.setAttribute('aria-busy', String(on));
  }

  renderLoading() {
    this.totalBalance.innerHTML = '<span class="multichain-skeleton is-figure" aria-hidden="true"></span>';
    this.totalBalance.setAttribute('aria-label', 'Loading balance');
    this.caption.innerHTML = '<span class="multichain-skeleton is-caption" aria-hidden="true"></span>';
    this.statusLine.textContent = '';
    this.listHead.hidden = true;
    this.empty.hidden = true;
    this.assetsList.hidden = false;
    this.assetsList.setAttribute('aria-busy', 'true');
    this.assetsList.innerHTML = SKELETON_ROW.repeat(3);
    // Nothing is known to be held yet.
    this.sendButton.disabled = true;
  }

  render() {
    const network = intentsAssets.getNetwork();
    const status = intentsAssets.getStatus();
    const held = network.assets.filter((asset) => asset.rawAmount !== '0');

    this.totalBalance.removeAttribute('aria-label');
    this.assetsList.removeAttribute('aria-busy');
    // Nothing read is not the same as nothing held: $0.00 would claim a balance.
    const total = Number(network.totalValueUsd);
    this.totalBalance.textContent = status === 'unavailable' && network.assets.length === 0
      ? '—'
      : heroUsd.format(Number.isFinite(total) ? total : 0);
    // Says where the money actually is, which a bare total does not. Silent
    // when nothing is held: the empty balance already says it.
    const chains = [...new Set(held.map((asset) => asset.chainName))];
    this.caption.textContent = chains.length > 1
      ? `Across ${chains.length} networks`
      : chains.length === 1 ? `On ${chains[0]}` : '';
    // Only a problem earns this line (DESIGN.md §1.2); custody is a standing
    // fact, and lives in the footnote under the list.
    this.statusLine.textContent = status === 'unavailable'
      ? 'Balances are unavailable right now. Refresh to try again.'
      : '';
    this.sendButton.disabled = held.length === 0;

    // The list is what you hold, plus what you held before and spent to zero.
    // "Hide empty" drops those; the switch only appears when there are any.
    const { hideEmpty } = this.controller.settings();
    const zeros = network.assets.filter((asset) => asset.rawAmount === '0');
    const visible = hideEmpty ? held : network.assets;
    this.listHead.hidden = zeros.length === 0;
    this.hideEmpty.checked = hideEmpty;

    // Nothing held: the way to start, not a list of zeros. Only when the
    // balances were actually read -- "nothing here" is a claim.
    this.empty.hidden = !(status === 'connected' && held.length === 0 && visible.length === 0);
    if (!this.empty.hidden) this.renderQuickReceive();

    this.assetsList.hidden = visible.length === 0;
    if (visible.length === 0) {
      this.assetsList.replaceChildren();
      return;
    }

    this.assetsList.innerHTML = visible.map((asset) => `
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

  /** The coins a new account is offered first, each one tap from its address. */
  renderQuickReceive() {
    const assets = QUICK_RECEIVE
      .map((assetId) => intentsAssets.getCatalogAsset(`intents:${assetId}`))
      .filter(Boolean);
    this.quick.innerHTML = assets.map((asset) => `
      <button type="button" class="multichain-quick-chip" data-asset-key="${escapeHtml(asset.key)}"
        aria-label="Receive ${escapeHtml(assetTitle(asset))}">
        ${assetMark(asset, 32)}
        <span class="multichain-quick-symbol">${escapeHtml(asset.tokenSymbol)}</span>
        <span class="multichain-quick-network">${escapeHtml(asset.chainName)}</span>
      </button>`).join('');
  }
}

// Which glyph a row carries: money in, money out to a person, money out to
// another chain, or a swap.
const ACTIVITY_ICON = { deposit: 'in', received: 'in', sent: 'send', withdraw: 'out', swap: 'swap' };

// Only states that need saying. A finished entry says nothing (DESIGN.md §1.2).
const ACTIVITY_STATUS = {
  pending: 'Pending',
  checking: 'Checking…',
  failed: 'Failed',
  refunded: 'Refunded',
  unconfirmed: 'Not confirmed',
};

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const yearFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "Sep 23". */
export function activityTime(ms, now = Date.now()) {
  if (!ms) return '';
  const seconds = Math.max(0, (now - ms) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  const then = new Date(ms);
  const today = new Date(now);
  const sameDay = then.toDateString() === today.toDateString();
  if (sameDay) return `${Math.floor(seconds / 3600)} h ago`;
  const yesterday = new Date(now - 86_400_000);
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return then.getFullYear() === today.getFullYear() ? dayFormat.format(then) : yearFormat.format(then);
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
    this.sendButton = document.getElementById('multichainAssetSend');
    this.withdrawButton = document.getElementById('multichainAssetWithdraw');
    this.swapButton = document.getElementById('multichainAssetSwap');
    this.activity = document.getElementById('multichainAssetActivity');
    // Each load takes a number; an answer for an asset no longer on screen,
    // or superseded by a newer load, is dropped.
    this.activitySeq = 0;
    this.activityKey = null;

    document.getElementById('closeMultichainAssetModal')
      .addEventListener('click', () => this.close());
    this.receiveButton.addEventListener('click', () => this.controller.receiveModal.open(this.assetKey));
    this.sendButton.addEventListener('click', () => this.controller.onSend(this.assetKey));
    this.withdrawButton.addEventListener('click', () => this.controller.withdrawModal.open(this.assetKey));
    this.swapButton.addEventListener('click', () => this.controller.swapModal.open(this.assetKey));
  }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.render();
    openModal(this.modal);
    void this.loadActivity();
  }

  /**
   * Fill the activity list. A first look shows skeleton rows; a reload of
   * the same asset keeps what is on screen until the new answer lands.
   */
  async loadActivity() {
    const asset = intentsAssets.getAsset(this.assetKey);
    if (!asset) return;
    const seq = ++this.activitySeq;
    if (this.activityKey !== this.assetKey) {
      this.activity.setAttribute('aria-busy', 'true');
      this.activity.innerHTML = `<div class="multichain-list">${SKELETON_ROW.repeat(2)}</div>`;
    }
    this.activityKey = this.assetKey;

    const { entries, depositsUnavailable } = await intentsActivity.forAsset(intentsAssets.getAccountId(), asset);
    if (seq !== this.activitySeq) return;
    this.activity.removeAttribute('aria-busy');
    this.renderActivity(entries, depositsUnavailable, asset);

    // A received payment is a claim until checked; check the ones on screen
    // and update their rows in place.
    for (const entry of entries) {
      if (entry.status !== 'checking' || !entry.intentHash) continue;
      intentsActivity.verifyPayment(entry.intentHash).then((status) => {
        if (seq !== this.activitySeq) return;
        const row = [...this.activity.querySelectorAll('[data-entry-id]')]
          .find((element) => element.dataset.entryId === entry.id);
        if (row) this.renderActivityStatus(row, status);
      });
    }
  }

  renderActivity(entries, depositsUnavailable, asset) {
    // "No activity" would be a claim when deposits could not be read.
    const unavailable = depositsUnavailable
      ? '<p class="multichain-activity-note">Deposits could not be checked right now.</p>'
      : '';
    if (!entries.length) {
      this.activity.innerHTML = unavailable || '<p class="multichain-activity-note">No activity yet</p>';
      return;
    }
    this.activity.innerHTML = `<div class="multichain-list">${entries.map((entry) => {
      const when = activityTime(entry.time);
      const sub = [when, entry.detail].filter(Boolean).join(' · ');
      const sign = entry.direction < 0 ? '−' : '+';
      // No symbol: every row on this screen is in the asset the title names,
      // and repeating it down the list costs the room the row titles need.
      const amount = `${sign}${entry.estimated ? '≈' : ''}${formatDisplayAmount(entry.amount)}`;
      return `
        <div class="multichain-row is-static" data-entry-id="${escapeHtml(entry.id)}" data-status="${escapeHtml(entry.status)}">
          <span class="multichain-activity-icon" data-icon="${ACTIVITY_ICON[entry.kind] || 'in'}" aria-hidden="true"></span>
          <span class="multichain-row-main">
            <span class="multichain-row-name">${escapeHtml(entry.title)}</span>
            ${sub ? `<span class="multichain-row-chain">${escapeHtml(sub)}</span>` : ''}
          </span>
          <span class="multichain-row-values">
            <span class="multichain-row-amount" title="${escapeHtml(`${entry.amount} ${asset.tokenSymbol}`)}">${escapeHtml(amount)}</span>
            <span class="multichain-activity-status">${escapeHtml(ACTIVITY_STATUS[entry.status] || '')}</span>
          </span>
        </div>`;
    }).join('')}</div>${unavailable}`;
  }

  renderActivityStatus(row, status) {
    row.dataset.status = status;
    const label = row.querySelector('.multichain-activity-status');
    if (label) label.textContent = ACTIVITY_STATUS[status] || '';
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
    this.sendButton.disabled = asset.rawAmount === '0';
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
    // From the catalog, not the portfolio: receiving is how an asset you do
    // not hold yet becomes one you do.
    const asset = intentsAssets.getCatalogAsset(assetKey);
    const accountId = intentsAssets.getAccountId();
    if (!asset || !accountId) return;

    this.assetKey = assetKey;
    this.title.textContent = `Receive ${assetTitle(asset)}`;
    this.body.innerHTML = '<div class="multichain-quote-working">Getting your deposit address…</div>';
    this.stopWatching();
    openModal(this.modal);

    try {
      const target = await intentsDeposits.requestDepositTarget(accountId, asset.assetId);
      this.render(target, asset);
      this.startWatching(asset);
    } catch (error) {
      console.warn('Deposit address unavailable:', error);
      this.body.innerHTML =
        `<div class="multichain-quote-error">${escapeHtml(error.message || 'Could not get a deposit address right now.')}</div>`;
    }
  }

  /**
   * The minimum is the headline because it is the rule people break: a
   * deposit under it is never credited, and as a line in a list of warnings it
   * read as small print.
   */
  render(target, asset) {
    // On a memo chain the QR carries the bare address: a payment URI that drops
    // the memo would scan cleanly and lose the deposit.
    const uri = target.memo ? null : depositUri(target.chain, target.address);
    const name = target.assetName || asset.tokenSymbol;
    const hasMinimum = target.minDepositRaw && target.minDepositRaw !== '0';
    // Exact, never through formatDisplayAmount: cutting digits off a minimum
    // shows a smaller number than the bridge will accept, and a deposit of
    // that size is lost.
    const headline = hasMinimum
      ? `Send at least ${escapeHtml(target.minDeposit)} ${escapeHtml(name)}`
      : `Send any amount of ${escapeHtml(name)}`;
    const minimumUsd = hasMinimum && asset.tokenPriceUsd
      ? Number(target.minDeposit) * Number(asset.tokenPriceUsd)
      : null;
    // A value under a cent would print as $0.00, which says the minimum is
    // nothing; better to say nothing.
    const sub = minimumUsd !== null && minimumUsd >= 0.01 ? `about ${formatUsd(minimumUsd)}` : '';

    const rules = [
      `Send only <strong>${escapeHtml(name)}</strong> on <strong>${escapeHtml(target.chainName)}</strong>. Other assets or networks are lost.`,
    ];
    if (target.memo) {
      rules.unshift('Include the memo. A deposit without it is lost.');
    }
    if (target.siblings > 0) {
      rules.push(`This network carries more than one ${escapeHtml(name)} token; check your balance after the first deposit.`);
    }

    this.body.innerHTML = `
      <div class="multichain-deposit-headline">
        <div class="multichain-deposit-minimum">${headline}</div>
        ${sub ? `<div class="multichain-deposit-sub">${escapeHtml(sub)}</div>` : ''}
      </div>
      <div class="multichain-qr" id="multichainDepositQr"></div>
      ${this.copyPill('Address', target.address, truncateAddress(target.address))}
      ${target.memo ? this.copyPill('Memo', target.memo, target.memo) : ''}
      <ul class="multichain-rules">
        ${rules.map((rule) => `<li>${rule}</li>`).join('')}
      </ul>
    `;
    this.renderQr(uri || target.address);

    this.body.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', () => this.copyValue(button));
    });
  }

  /** A value to read and copy. The memo gets the same control as the
   *  address: losing either loses the deposit. */
  copyPill(label, value, shown) {
    return `
      <button type="button" class="multichain-address" data-copy="${escapeHtml(value)}"
        aria-label="Copy ${escapeHtml(label.toLowerCase())} ${escapeHtml(value)}">
        <span class="multichain-address-label">${escapeHtml(label)}</span>
        <span class="multichain-address-value">${escapeHtml(shown)}</span>
        <span class="multichain-address-copy">Copy</span>
      </button>`;
  }

  /** The whole pill is the target: a small icon next to a long string is a
   *  harder thing to hit than the string itself. */
  async copyValue(button) {
    const label = button.querySelector('.multichain-address-copy');
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = 'Copy'; }, 2000);
    } catch (error) {
      console.warn('Could not copy:', error);
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
      const current = intentsAssets.getCatalogAsset(assetKey);
      if (!current || current.rawAmount === startingAmount) return;

      this.stopWatching();
      const banner = document.createElement('div');
      banner.className = 'multichain-arrived';
      banner.textContent =
        `Received. Your ${current.tokenSymbol} balance is now ${formatDisplayAmount(current.tokenAmount, 6)}.`;
      this.body.prepend(banner);
      this.controller.assetModal.render();
      if (this.controller.assetModal.isActive()) void this.controller.assetModal.loadActivity();
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
    this.done = false;
    this.title.textContent = title;
    this.hero.innerHTML = hero;
    this.rows.innerHTML = rows.map(([label, value, emphasis]) => `
      <dt>${escapeHtml(label)}</dt>
      <dd${emphasis ? ' class="is-guaranteed"' : ''}>${escapeHtml(String(value))}</dd>
    `).join('');
    this.action.textContent = actionLabel;
    this.action.classList.replace('btn--secondary', 'btn--primary');
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
    // Long enough to outlast openModal's lock, which falls back to 1s when a
    // slide-in's transitionend never fires. Shorter, and a quick Review
    // press on a screen still sliding in would show nothing at all.
    if (attempt >= 20) {
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

  /**
   * The move is over, one way or another. From here the button only leaves:
   * nothing on this screen may be able to send the same thing twice.
   */
  finish(message, kind = '') {
    this.done = true;
    this.run = null;
    // "This cannot be undone" describes a decision that has now been made.
    this.note.textContent = '';
    this.setStatus(message, kind);
    this.action.textContent = 'Done';
    // Leaving is not a consequential action, so it is not blue.
    this.action.classList.replace('btn--primary', 'btn--secondary');
    this.action.disabled = false;
  }

  async confirm() {
    if (this.done) {
      this.controller.finishMove();
      return;
    }
    if (!this.run) return;
    this.action.disabled = true;
    try {
      await this.run(this);
    } catch (error) {
      // A finished sheet has already said what happened; a failed balance
      // refresh afterwards must not replace that with an error and a retry.
      if (this.done) {
        console.warn('After the move:', error);
        return;
      }
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
    this.clearForm();
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

  renderAvailable() {
    const asset = intentsAssets.getAsset(this.assetKey);
    this.available.textContent = asset
      ? `Available ${formatDisplayAmount(asset.tokenAmount, 6)} ${asset.tokenSymbol}`
      : '';
  }

  /** Emptied once an order is out, so Back cannot preview the same one again. */
  clearForm() {
    this.to.value = '';
    this.amount.value = '';
    this.renderAvailable();
  }

  async run(sheet, destinationAsset) {
    const asset = intentsAssets.getAsset(this.assetKey);
    const accountId = intentsAssets.getAccountId();
    const secretKey = this.controller.getSecretKey();
    if (!asset) {
      sheet.finish('That balance is no longer available.', 'error');
      return;
    }
    if (!accountId || !secretKey) {
      sheet.finish('Your account is not available. Sign in again to continue.', 'error');
      return;
    }

    let prepared;
    let signed;
    try {
      sheet.setStatus('Getting a live quote…');
      prepared = await intentsWithdrawals.prepare({
        accountId, asset, destinationAsset,
        destinationAddress: this.to.value.trim(),
        amount: this.amount.value.trim(),
      });

      // Rehearse before spending the relay's gas, and publish the signature
      // the verifier approved rather than a re-signed equivalent.
      sheet.setStatus('Checking…');
      signed = await signIntentPayload(prepared.payload, secretKey);
      const check = await intentsWithdrawals.simulate(signed);
      if (!check.ok) {
        sheet.setStatus(`This withdrawal would fail: ${check.reason}`, 'error');
        sheet.action.disabled = false;
        return;
      }
    } catch (error) {
      // Nothing has been published yet, so trying again is safe.
      sheet.setStatus(error.message || 'Could not get this withdrawal ready.', 'error');
      sheet.action.disabled = false;
      return;
    }

    sheet.setStatus('Sending…');
    // Recorded before sending: an outcome this screen cannot learn is the one
    // the activity list most needs, and 1Click can settle it from the
    // deposit address later.
    const orderId = intentsActivity.recordOrder({
      kind: 'withdraw',
      assetId: asset.assetId,
      symbol: asset.tokenSymbol,
      amount: prepared.amount,
      destinationChain: (destinationAsset || asset).chainName,
      destinationAddress: prepared.destinationAddress,
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
    });
    let outcome;
    try {
      outcome = await intentsWithdrawals.execute(prepared, secretKey, { signed });
    } catch (error) {
      // Expiry is checked before anything is published; every other failure
      // may come after it.
      if (error?.code === 'QUOTE_EXPIRED') {
        intentsActivity.forgetOrder(orderId);
        sheet.setStatus(error.message, 'error');
        sheet.action.disabled = false;
        return;
      }
      console.warn('Withdrawal outcome unknown:', error);
      outcome = null;
    }
    if (outcome) intentsActivity.updateOrder(orderId, { status: orderStatusFrom(outcome.status) });

    const chain = (destinationAsset || asset).chainName;
    this.clearForm();
    if (!outcome) sheet.finish(UNCONFIRMED, 'error');
    else if (outcome.status === 'SUCCESS') {
      sheet.finish(
        `Withdrawn. About ${formatDisplayAmount(prepared.amountOut)} ${asset.tokenSymbol} is on its way to ${chain}.`,
        'ok',
      );
    } else if (outcome.status === 'FAILED') sheet.finish(NOT_THROUGH, 'error');
    else sheet.finish(SLOW);

    await this.controller.refreshAfterMove();
    this.renderAvailable();
  }

  close() {
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

/**
 * Choosing a token: search, what you hold, then everything else.
 *
 * The catalog is hundreds of assets, and the same symbol sits on several
 * chains. A row per asset with the chain as its second line settles which
 * USDC is which without asking for the chain as a separate question first --
 * which is what the old network-then-asset pair of selects did.
 */
class MultichainTokenPicker {
  constructor(controller) {
    this.controller = controller;
    this.onPick = null;
    this.accepts = () => true;
  }

  load() {
    this.modal = document.getElementById('multichainTokenPickerModal');
    this.title = document.getElementById('multichainTokenPickerTitle');
    this.search = document.getElementById('multichainTokenSearch');
    this.results = document.getElementById('multichainTokenResults');

    document.getElementById('closeMultichainTokenPickerModal')
      .addEventListener('click', () => this.close());
    this.search.addEventListener('input', () => this.render());
    this.results.addEventListener('click', (event) => {
      const row = event.target.closest('[data-asset-key]');
      if (!row) return;
      const pick = this.onPick;
      this.close();
      pick?.(row.dataset.assetKey);
    });
  }

  /**
   * `accepts` narrows the catalog to what the task can use -- everything but
   * the asset being paid with, for a swap; what the bridge carries, for a
   * deposit.
   */
  open({ title = 'Choose a token', accepts = () => true, onPick }) {
    this.accepts = accepts;
    this.onPick = onPick;
    this.title.textContent = title;
    this.search.value = '';
    this.render();
    this.results.scrollTop = 0;
    openModal(this.modal);
    // Off-screen while it slides in; see DESIGN.md §6.
    setTimeout(() => this.search.focus({ preventScroll: true }), 350);
  }

  candidates() {
    return intentsAssets.listCatalogAssets().filter((asset) => this.accepts(asset));
  }

  render() {
    const query = this.search.value.trim().toLowerCase();
    const all = this.candidates();
    const held = all
      .filter((asset) => asset.rawAmount !== '0')
      .sort((a, b) => (Number(b.tokenValueUsd) || 0) - (Number(a.tokenValueUsd) || 0));
    const rest = all.filter((asset) => asset.rawAmount === '0');

    if (!query) {
      this.results.innerHTML = [
        held.length ? this.section('Your tokens', held) : '',
        this.section(held.length ? 'All tokens' : '', rest),
      ].join('');
      return;
    }

    // An exact symbol first, then symbols that start with the query, then any
    // match on name or network -- so "usd" puts USDC above a token merely
    // bridged by a network whose name contains it.
    const rank = (asset) => {
      const symbol = asset.tokenSymbol.toLowerCase();
      if (symbol === query) return 0;
      if (symbol.startsWith(query)) return 1;
      return 2;
    };
    const matches = [...held, ...rest]
      .filter((asset) => [asset.tokenSymbol, asset.tokenName, asset.chainName]
        .some((text) => String(text).toLowerCase().includes(query)))
      .map((asset, order) => ({ asset, order, rank: rank(asset) }))
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map(({ asset }) => asset);

    this.results.innerHTML = matches.length
      ? this.section('', matches)
      : `<p class="multichain-picker-none">No token matches “${escapeHtml(this.search.value.trim())}”.</p>`;
  }

  section(title, assets) {
    if (!assets.length) return '';
    return `
      ${title ? `<div class="multichain-section-title">${escapeHtml(title)}</div>` : ''}
      <div class="multichain-list">${assets.map((asset) => this.row(asset)).join('')}</div>`;
  }

  /** A held token shows what you have; anything else leaves the right side
   *  empty rather than repeating "0" down the list. */
  row(asset) {
    const held = asset.rawAmount !== '0';
    return `
      <button type="button" class="multichain-row" data-asset-key="${escapeHtml(asset.key)}"
        aria-label="${escapeHtml(assetTitle(asset))}">
        ${assetMark(asset, 40)}
        <span class="multichain-row-main">
          <span class="multichain-row-name">${escapeHtml(asset.tokenSymbol)}</span>
          <span class="multichain-row-chain">${escapeHtml(asset.chainName)}</span>
        </span>
        ${held ? `<span class="multichain-row-values">
          <span class="multichain-row-amount">${escapeHtml(formatDisplayAmount(asset.tokenAmount))}</span>
          <span class="multichain-row-usd">${escapeHtml(
            asset.tokenValueUsd === null ? 'Unpriced' : formatUsd(asset.tokenValueUsd),
          )}</span>
        </span>` : ''}
      </button>`;
  }

  close() {
    this.onPick = null;
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal.classList.contains('active');
  }
}

// Long enough that a number being typed is not priced at every digit, short
// enough that the estimate reads as following the typing.
const ESTIMATE_DELAY_MS = 400;

/**
 * Swap: what you pay and what you get, with the estimate live as you type.
 *
 * The estimate is a dry quote -- free and read-only -- so asking for one as
 * the amount changes costs nothing but a request. The Review button fetches a
 * fresh one before the confirmation screen, and that screen re-quotes again
 * before anything is signed: the number here is a guide, never the agreement.
 */
class MultichainSwapModal {
  constructor(controller) {
    this.controller = controller;
    this.assetKey = null;
    this.toKey = null;
    this.estimateTimer = null;
    // Each request takes a number; a reply that is not the latest is dropped,
    // so a slow answer for "0.0" cannot overwrite the one for "0.05".
    this.estimateSeq = 0;
  }

  load() {
    this.modal = document.getElementById('multichainSwapModal');
    this.title = document.getElementById('multichainSwapTitle');
    this.fromChip = document.getElementById('multichainSwapFrom');
    // Token or dollars, Max and the balance line: the same control as send.
    this.amountField = new AmountField({
      input: document.getElementById('multichainSwapAmount'),
      currency: document.getElementById('multichainSwapCurrency'),
      flip: document.getElementById('multichainSwapFlip'),
      balance: document.getElementById('multichainSwapAvailable'),
      max: document.getElementById('multichainSwapMax'),
      getAsset: () => this.fromAsset(),
      onChange: () => this.scheduleEstimate(),
    });
    this.out = document.getElementById('multichainSwapOut');
    this.toChip = document.getElementById('multichainSwapTo');
    this.outUsd = document.getElementById('multichainSwapOutUsd');
    this.toChain = document.getElementById('multichainSwapToChain');
    this.floor = document.getElementById('multichainSwapFloor');
    this.previewButton = document.getElementById('multichainSwapPreview');
    this.status = document.getElementById('multichainSwapStatus');

    document.getElementById('closeMultichainSwapModal')
      .addEventListener('click', () => this.close());
    this.previewButton.addEventListener('click', () => this.preview());
    this.toChip.addEventListener('click', () => {
      const from = intentsAssets.getAsset(this.assetKey);
      this.controller.tokenPicker.open({
        accepts: (asset) => asset.assetId !== from?.assetId,
        onPick: (key) => {
          this.toKey = key;
          this.renderTo();
          this.scheduleEstimate();
        },
      });
    });
  }

  fromAsset() { return intentsAssets.getAsset(this.assetKey); }

  toAsset() { return this.toKey ? intentsAssets.getCatalogAsset(this.toKey) : null; }

  open(assetKey) {
    const asset = intentsAssets.getAsset(assetKey);
    if (!asset) return;
    this.assetKey = assetKey;
    this.toKey = null;
    this.title.textContent = `Swap ${asset.tokenSymbol}`;
    this.fromChip.innerHTML = `${assetMark(asset, 24)}<span>${escapeHtml(asset.tokenSymbol)}</span>`;
    this.renderTo();
    this.clearForm();
    openModal(this.modal);
  }

  renderTo() {
    const to = this.toAsset();
    // The chevron is inline so it takes the chip's colour (DESIGN.md §6).
    const chevron = '<svg class="multichain-chip-caret" viewBox="0 0 24 24" aria-hidden="true">'
      + '<polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2.5" '
      + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
    this.toChip.classList.toggle('is-empty', !to);
    this.toChip.innerHTML = to
      ? `${assetMark(to, 24)}<span>${escapeHtml(to.tokenSymbol)}</span>${chevron}`
      : `<span>Choose token</span>${chevron}`;
    this.toChain.textContent = to ? `on ${to.chainName}` : '';
  }

  /** Back to "nothing estimated": the figures on screen must never describe
   *  a different amount from the one in the field. */
  resetEstimate() {
    clearTimeout(this.estimateTimer);
    this.estimateSeq += 1;
    this.out.textContent = '0';
    this.out.classList.add('is-empty');
    this.outUsd.textContent = '';
    this.floor.textContent = '';
    this.previewButton.disabled = true;
    this.status.hidden = true;
  }

  amountProblem() {
    return this.amountField.problem();
  }

  scheduleEstimate() {
    this.resetEstimate();
    const problem = this.amountProblem();
    if (problem) this.setStatus(problem, 'error');
    // '' is "nothing to price yet"; a message is a reason not to; null is go.
    if (problem !== null || !this.toAsset()) return;

    this.out.textContent = '…';
    const seq = this.estimateSeq;
    this.estimateTimer = setTimeout(() => this.estimate(seq), ESTIMATE_DELAY_MS);
  }

  async estimate(seq) {
    const fromAsset = this.fromAsset();
    const toAsset = this.toAsset();
    const accountId = intentsAssets.getAccountId();
    if (!fromAsset || !toAsset || !accountId) return;

    try {
      const quote = await intentsSwaps.preview({
        accountId, fromAsset, toAsset, amount: this.amountField.tokenAmount(),
      });
      if (seq !== this.estimateSeq) return;
      this.out.classList.remove('is-empty');
      this.out.textContent = formatDisplayAmount(quote.amountOut);
      this.outUsd.textContent = quote.amountOutUsd ? formatUsd(quote.amountOutUsd) : '';
      this.floor.textContent = quote.minAmountOut
        ? `At least ${formatDisplayAmount(quote.minAmountOut)} ${toAsset.tokenSymbol}, or your ${fromAsset.tokenSymbol} back`
        : '';
      this.previewButton.disabled = false;
    } catch (error) {
      if (seq !== this.estimateSeq) return;
      this.out.textContent = '—';
      this.setStatus(error.message || 'Could not price that swap.', 'error');
    }
  }

  /** A fresh quote for the confirmation, rather than the estimate on screen,
   *  which may be minutes old by the time Review is pressed. */
  async preview() {
    const fromAsset = this.fromAsset();
    const toAsset = this.toAsset();
    const accountId = intentsAssets.getAccountId();
    if (!fromAsset || !toAsset || !accountId) return;

    this.previewButton.disabled = true;
    this.status.hidden = true;
    // What was reviewed is what gets swapped, whatever the field shows by the
    // time Swap is pressed -- in dollars it shows a figure, not the amount.
    this.reviewedAmount = this.amountField.tokenAmount();

    try {
      const quote = await intentsSwaps.preview({
        accountId, fromAsset, toAsset, amount: this.reviewedAmount,
      });
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

  renderAvailable() {
    this.amountField.render();
  }

  /** Emptied once an order is out, so Back cannot preview the same one again. */
  clearForm() {
    this.amountField.reset();
    this.resetEstimate();
  }

  async run(sheet) {
    const fromAsset = this.fromAsset();
    const toAsset = this.toAsset();
    const accountId = intentsAssets.getAccountId();
    const secretKey = this.controller.getSecretKey();
    if (!fromAsset || !toAsset) {
      sheet.finish('That balance is no longer available.', 'error');
      return;
    }
    if (!accountId || !secretKey) {
      sheet.finish('Your account is not available. Sign in again to continue.', 'error');
      return;
    }

    let prepared;
    let signed;
    try {
      sheet.setStatus('Getting a live quote…');
      prepared = await intentsSwaps.prepare({
        accountId, fromAsset, toAsset, amount: this.reviewedAmount,
      });

      sheet.setStatus('Checking…');
      signed = await signIntentPayload(prepared.payload, secretKey);
      const check = await intentsSwaps.simulate(signed);
      if (!check.ok) {
        sheet.setStatus(`This swap would fail: ${check.reason}`, 'error');
        sheet.action.disabled = false;
        return;
      }
    } catch (error) {
      // Nothing has been published yet, so trying again is safe.
      sheet.setStatus(error.message || 'Could not get this swap ready.', 'error');
      sheet.action.disabled = false;
      return;
    }

    sheet.setStatus('Swapping…');
    // Recorded before sending, for the same reason as a withdrawal.
    const orderId = intentsActivity.recordOrder({
      kind: 'swap',
      fromAssetId: fromAsset.assetId,
      toAssetId: toAsset.assetId,
      fromSymbol: fromAsset.tokenSymbol,
      toSymbol: toAsset.tokenSymbol,
      amount: prepared.amount,
      amountOut: prepared.amountOut,
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
    });
    let outcome;
    try {
      outcome = await intentsSwaps.execute(prepared, secretKey, { signed });
    } catch (error) {
      // Expiry is checked before anything is published; every other failure
      // may come after it.
      if (error?.code === 'QUOTE_EXPIRED') {
        intentsActivity.forgetOrder(orderId);
        sheet.setStatus(error.message, 'error');
        sheet.action.disabled = false;
        return;
      }
      console.warn('Swap outcome unknown:', error);
      outcome = null;
    }
    if (outcome) {
      intentsActivity.updateOrder(orderId, {
        status: orderStatusFrom(outcome.status),
        ...(outcome.status === 'SUCCESS' && outcome.detail?.swapDetails?.amountOutFormatted
          ? { amountReceived: outcome.detail.swapDetails.amountOutFormatted } : {}),
      });
    }

    this.clearForm();
    if (!outcome) sheet.finish(UNCONFIRMED, 'error');
    else if (outcome.status === 'SUCCESS') {
      sheet.finish(`Swapped. Your ${toAsset.tokenSymbol} is in your wallet.`, 'ok');
    } else if (outcome.refunded) {
      // Not a failure: the floor protected the person from a worse fill.
      sheet.finish(`Could not fill at the agreed rate, so your ${fromAsset.tokenSymbol} was returned.`);
    } else if (outcome.status === 'FAILED') sheet.finish(NOT_THROUGH, 'error');
    else sheet.finish(SLOW);

    await this.controller.refreshAfterMove();
    this.renderAvailable();
  }

  close() {
    this.resetEstimate();
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
    // Sending to a contact lives with the chat payment code, which registers
    // itself here rather than being imported: it already imports this module.
    this.onSend = () => {};
    this.assetsModal = new MultichainModal(this);
    this.assetModal = new MultichainAssetModal(this);
    this.receiveModal = new MultichainReceiveModal(this);
    this.withdrawModal = new MultichainWithdrawModal(this);
    this.swapModal = new MultichainSwapModal(this);
    this.tokenPicker = new MultichainTokenPicker(this);
    this.confirmModal = new MultichainConfirmModal(this);
  }

  /**
   * Per-account wallet settings, kept with the account's saved state: which
   * assets it has held, and whether empty ones are hidden.
   */
  settings() {
    let saved = null;
    try {
      saved = this.getSettings?.();
    } catch {
      saved = null;
    }
    return {
      heldBefore: Array.isArray(saved?.heldBefore) ? saved.heldBefore : [],
      hideEmpty: Boolean(saved?.hideEmpty),
    };
  }

  updateSettings(patch) {
    this.saveSettings?.({ ...this.settings(), ...patch });
  }

  /** Where the signed-in account comes from; without it there is nothing to read. */
  getSecretKey() {
    return this.getAccount()?.keys?.secret || null;
  }

  configure({ getAccount, syncSelect, onSend, getSettings, saveSettings } = {}) {
    if (typeof onSend === 'function') this.onSend = onSend;
    if (typeof getSettings === 'function') this.getSettings = getSettings;
    if (typeof saveSettings === 'function') {
      this.saveSettings = saveSettings;
      intentsAssets.configure({
        getHeldBefore: () => this.settings().heldBefore,
        saveHeldBefore: (ids) => this.updateSettings({ heldBefore: ids }),
      });
    }
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
    this.tokenPicker.load();
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
      multichainTokenPickerModal: this.tokenPicker,
      multichainConfirmModal: this.confirmModal,
    };
    if (!screens[modalId]) return false;
    screens[modalId].close();
    return true;
  }

  refresh(options) {
    return intentsAssets.refresh(options);
  }

  /**
   * Receive anything the bridge carries. The listed assets are only what is
   * held plus two defaults, so without this every other chain was unreachable.
   *
   * The picker's rows are asset-on-chain, so one tap answers both "which
   * token" and "which network" -- no separate network question.
   */
  async startDeposit() {
    const button = this.assetsModal.receiveButton;
    button.disabled = true;
    try {
      await intentsDeposits.loadBridgeTokens();
    } catch (error) {
      console.warn('Deposit options unavailable:', error);
      this.assetsModal.statusLine.textContent = 'Could not load what you can receive. Try again in a moment.';
      return;
    } finally {
      button.disabled = false;
    }
    this.tokenPicker.open({
      title: 'Receive',
      accepts: (asset) => intentsDeposits.isDepositable(asset.assetId),
      onPick: (key) => this.receiveModal.open(key),
    });
  }

  /** Back to the asset the money moved from, with every form behind it closed. */
  finishMove() {
    this.confirmModal.close();
    this.withdrawModal.close();
    this.swapModal.close();
  }

  /** After money moves, every screen showing a balance is stale. */
  async refreshAfterMove() {
    await intentsAssets.refresh({ force: true });
    this.assetModal.render();
    if (this.assetModal.isActive()) void this.assetModal.loadActivity();
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
