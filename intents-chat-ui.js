// Sending crypto to a Liberdus contact.
//
// Sends an intents balance to another account. Their intents account is their
// Liberdus address, so there is nobody to look up and nothing to paste: from a
// conversation the recipient is whoever the chat is with, and from the wallet
// it is a contact picked from a list.
//
// Built from the swap screen's parts -- the same amount panel, token chip and
// picker, and the same confirmation screen -- so they read as one wallet.
//
// The value and the receipt settle on different networks, so the order matters
// and is fixed: publish the transfer, then send the chat message. If the
// message fails the sender is told plainly that the money moved and the receipt
// did not, because the opposite order would let a receipt exist for a payment
// that never happened. And once the transfer may be out, nothing on these
// screens can send it again -- only the receipt can be retried.

import { escapeHtml, openModal } from './lib.js';
import { intentsAssets } from './intents-assets.js';
import { intentsChatPayments } from './intents-chat.js';
import {
  AmountField, UNCONFIRMED, assetMark, formatDisplayAmount, formatUsd, multichain, priceOf,
} from './intents-ui.js';

// Kept importable from here: the dollar conversion is part of what sending means.
export { usdToTokenAmount } from './intents-ui.js';

const $ = (id) => document.getElementById(id);

// Inline so they take the control's colour (DESIGN.md §6).
const CARET = '<svg class="multichain-chip-caret" viewBox="0 0 24 24" aria-hidden="true">'
  + '<polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2.5" '
  + 'stroke-linecap="round" stroke-linejoin="round"/></svg>';
/**
 * Who to send to, when sending starts from the wallet.
 *
 * The app supplies the contacts and their avatars: this module knows nothing
 * of the address book, and the avatar has to honour the style the person
 * chose, which only the app knows how to draw.
 */
class ContactPicker {
  constructor(owner) {
    this.owner = owner;
    this.onPick = null;
    this.contacts = [];
  }

  load() {
    this.modal = $('chatSendContactModal');
    this.title = $('chatSendContactTitle');
    this.search = $('chatSendContactSearch');
    this.results = $('chatSendContactResults');
    $('closeChatSendContactModal').addEventListener('click', () => this.close());
    this.search.addEventListener('input', () => this.render());
    this.results.addEventListener('click', (event) => {
      const row = event.target.closest('[data-address]');
      if (!row) return;
      const contact = this.contacts.find((entry) => entry.address === row.dataset.address);
      const pick = this.onPick;
      this.close();
      if (contact) pick?.(contact);
    });
  }

  open({ title, onPick }) {
    this.onPick = onPick;
    this.title.textContent = title;
    this.search.value = '';
    this.contacts = this.owner.listContacts();
    this.render();
    openModal(this.modal);
    // Off-screen while it slides in; see DESIGN.md §6.
    setTimeout(() => this.search.focus({ preventScroll: true }), 350);
  }

  render() {
    if (!this.contacts.length) {
      this.results.innerHTML = '<p class="multichain-picker-none">No contacts yet. Add someone in Contacts first.</p>';
      return;
    }
    const query = this.search.value.trim().toLowerCase();
    const matches = query
      ? this.contacts.filter((contact) => [contact.name, contact.username]
        .some((text) => String(text || '').toLowerCase().includes(query)))
      : this.contacts;
    if (!matches.length) {
      this.results.innerHTML =
        `<p class="multichain-picker-none">No contact matches “${escapeHtml(this.search.value.trim())}”.</p>`;
      return;
    }
    this.results.innerHTML = `<div class="multichain-list">${matches.map((contact) => `
      <button type="button" class="multichain-row" data-address="${escapeHtml(contact.address)}">
        <span class="chat-send-contact-avatar" data-avatar-for="${escapeHtml(contact.address)}"></span>
        <span class="multichain-row-main">
          <span class="multichain-row-name">${escapeHtml(contact.name)}</span>
          ${contact.username && contact.username !== contact.name
            ? `<span class="multichain-row-chain">@${escapeHtml(contact.username)}</span>` : ''}
        </span>
      </button>`).join('')}</div>`;
    // Avatars are drawn asynchronously by the app; a row is usable before its
    // avatar arrives.
    for (const slot of this.results.querySelectorAll('[data-avatar-for]')) {
      Promise.resolve(this.owner.renderAvatar(slot.dataset.avatarFor, 40))
        .then((html) => { if (html) slot.innerHTML = html; })
        .catch(() => {});
    }
  }

  close() {
    this.onPick = null;
    this.modal.classList.remove('active');
  }

  isActive() {
    return this.modal?.classList.contains('active') || false;
  }
}

export class ChatPaymentPanel {
  constructor() {
    this.loaded = false;
    this.recipientAddress = null;
    this.recipientName = null;
    this.assetKey = null;
    this.sending = false;
    // Set once the transfer is out and only the chat receipt is outstanding.
    this.pendingReceipt = null;
    // Set when the outcome is known or unknowable; the button only leaves.
    this.done = false;
    this.getAccount = () => null;
    this.onSent = null;
    this.showToast = () => {};
    this.listContacts = () => [];
    this.renderAvatar = () => '';
    this.prepareRecipient = async () => ({ blocked: false });
    this.contactPicker = new ContactPicker(this);
  }

  configure({ getAccount, onSent, showToast, listContacts, renderAvatar, prepareRecipient } = {}) {
    if (typeof getAccount === 'function') {
      this.getAccount = getAccount;
      intentsChatPayments.configure({ getAccount });
    }
    if (typeof onSent === 'function') this.onSent = onSent;
    if (typeof showToast === 'function') this.showToast = showToast;
    if (typeof listContacts === 'function') this.listContacts = listContacts;
    if (typeof renderAvatar === 'function') this.renderAvatar = renderAvatar;
    if (typeof prepareRecipient === 'function') this.prepareRecipient = prepareRecipient;
  }

  load() {
    if (this.loaded) return;
    this.modal = $('chatSendModal');
    this.title = $('chatSendTitle');
    this.form = $('chatSendForm');
    this.empty = $('chatSendEmpty');
    this.amountInput = $('chatSendAmount');
    this.assetChip = $('chatSendAsset');
    // Token or dollars, Max and the balance line: the same control as swap.
    this.amount = new AmountField({
      input: this.amountInput,
      currency: $('chatSendCurrency'),
      flip: $('chatSendFlip'),
      balance: $('chatSendAvailable'),
      max: $('chatSendMax'),
      getAsset: () => this.selectedAsset(),
      onChange: () => this.validate(),
    });
    this.noteToggle = $('chatSendNoteToggle');
    this.noteInput = $('chatSendNote');
    this.sendButton = $('chatSendButton');
    this.statusLine = $('chatSendStatus');

    $('closeChatSendModal').addEventListener('click', () => this.close());
    this.sendButton.addEventListener('click', () => this.primaryAction());
    this.assetChip.addEventListener('click', () => {
      multichain.tokenPicker.open({
        title: 'Send',
        // Only what can actually be sent: an empty asset would produce a
        // failure the person could have been spared.
        accepts: (asset) => asset.rawAmount !== '0',
        onPick: (key) => {
          this.assetKey = key;
          this.renderAsset();
          this.amount.assetChanged();
        },
      });
    });
    this.noteToggle.addEventListener('click', () => {
      this.noteToggle.hidden = true;
      this.noteInput.hidden = false;
      this.noteInput.focus({ preventScroll: true });
    });
    $('chatSendReceive').addEventListener('click', () => {
      // Receiving is a different task, and its screens sit below this one in
      // the stack; leave rather than open them underneath.
      this.close();
      void multichain.startDeposit();
    });

    this.contactPicker.load();
    // The asset screen's Send: pick a contact, then this same screen.
    multichain.configure({ onSend: (assetKey) => this.startFromWallet(assetKey) });
    this.loaded = true;
  }

  startFromWallet(assetKey) {
    this.load();
    this.contactPicker.open({
      title: 'Send to',
      onPick: (contact) => this.open(contact.address, contact.name, { assetKey }),
    });
  }

  selectedAsset() {
    return this.assetKey ? intentsAssets.getAsset(this.assetKey) : null;
  }

  setStatus(message, kind = '') {
    this.statusLine.hidden = !message;
    this.statusLine.textContent = message || '';
    this.statusLine.dataset.kind = kind;
  }

  async open(recipientAddress, recipientName = null, { assetKey = null } = {}) {
    this.load();
    this.recipientAddress = recipientAddress;
    this.recipientName = recipientName;
    this.sending = false;
    this.pendingReceipt = null;
    this.done = false;
    this.title.textContent = recipientName ? `Send to ${recipientName}` : 'Send';
    this.amount.reset();
    this.noteInput.value = '';
    this.noteInput.hidden = true;
    this.noteToggle.hidden = false;
    this.setStatus('');
    this.sendButton.textContent = 'Review payment';
    this.sendButton.classList.replace('btn--secondary', 'btn--primary');
    this.sendButton.disabled = true;
    this.lockForm(false);
    this.form.hidden = false;
    this.empty.hidden = true;
    this.assetChip.innerHTML = '<span>Loading…</span>';
    openModal(this.modal);

    await intentsAssets.refresh({ force: true });
    // The asset it was opened for, else the largest holding: the likeliest
    // thing to be sent, and a choice the picker is one tap from changing.
    const held = intentsAssets.getAssets()
      .filter((asset) => asset.rawAmount !== '0')
      .sort((a, b) => (Number(b.tokenValueUsd) || 0) - (Number(a.tokenValueUsd) || 0));
    if (!held.length) {
      this.form.hidden = true;
      this.empty.hidden = false;
      return;
    }
    const preferred = assetKey || this.assetKey;
    this.assetKey = held.some((asset) => asset.key === preferred) ? preferred : held[0].key;
    this.renderAsset();
    this.amount.changed();
    // Off-screen while it slides in; see DESIGN.md §6.
    setTimeout(() => this.amountInput.focus({ preventScroll: true }), 350);
  }

  renderAsset() {
    const asset = this.selectedAsset();
    if (!asset) return;
    this.assetChip.innerHTML = `${assetMark(asset, 24)}<span>${escapeHtml(asset.tokenSymbol)}</span>${CARET}`;
    this.assetChip.setAttribute('aria-label', `Sending ${asset.tokenSymbol} on ${asset.chainName}. Change`);
  }

  /** Live, so the button is only ever pressable for an amount that can go. */
  validate() {
    // After the money has gone, nothing may turn this back into a Send button.
    if (this.pendingReceipt || this.done) return;
    const problem = this.amount.problem();
    this.setStatus(problem || '', problem ? 'error' : '');
    this.sendButton.disabled = problem !== null;
  }

  close() {
    if (this.sending) return;
    this.modal.classList.remove('active');
    this.recipientAddress = null;
    this.pendingReceipt = null;
  }

  isActive() {
    return this.modal?.classList.contains('active') || false;
  }

  primaryAction() {
    if (this.done) return this.close();
    if (this.pendingReceipt) return this.sendReceipt();
    return this.review();
  }

  /**
   * The figures, the recipient and a last chance to go back -- on the shared
   * confirmation screen, which is what swap and withdraw end with too.
   */
  async review() {
    const asset = this.selectedAsset();
    const amount = this.amount.tokenAmount();
    if (!asset || !this.recipientAddress || this.amount.problem() !== null) return;

    // The receipt travels as a chat message, so a contact who is not taking
    // messages from you would get the money with no word of who sent it or
    // why. Refuse before anything moves, not after.
    this.sendButton.disabled = true;
    this.setStatus('Checking…');
    const recipient = await this.prepareRecipient(this.recipientAddress).catch(() => ({ blocked: false }));
    this.sendButton.disabled = false;
    if (recipient?.blocked) {
      this.setStatus(`${this.recipientName || 'This contact'} is not accepting messages from you, so a payment cannot reach them here.`, 'error');
      return;
    }
    this.setStatus('');

    const price = priceOf(asset);
    const usd = price ? Number(amount) * price : null;
    const name = this.recipientName || 'this contact';
    const note = this.noteInput.value.trim() || null;
    const shown = formatDisplayAmount(amount, 6);
    // Each fact once: the hero carries the amount and its value, the rows the
    // rest. The exact amount earns a row only when the hero had to trim it --
    // this is the screen where what is sent must be readable in full.
    const rows = [['To', name]];
    if (shown !== amount) rows.push(['Exact amount', `${amount} ${asset.tokenSymbol}`]);
    if (note) rows.push(['Note', note]);
    rows.push(['Network fee', 'None'], ['Arrives', 'Instantly']);

    multichain.confirmModal.open({
      title: 'Confirm payment',
      hero: `${assetMark(asset, 56)}
        <div class="multichain-confirm-amount">${escapeHtml(shown)} ${escapeHtml(asset.tokenSymbol)}</div>
        ${usd !== null ? `<div class="multichain-confirm-sub">about ${escapeHtml(formatUsd(usd))}</div>` : ''}`,
      rows,
      actionLabel: `Send ${asset.tokenSymbol}`,
      note: 'Payments cannot be undone.',
      run: (sheet) => this.run(sheet, { asset, amount, note }),
    });
  }

  async run(sheet, { asset, amount, note }) {
    const secretKey = this.getAccount()?.keys?.secret;
    if (!secretKey) {
      sheet.finish('Your account is not available. Sign in again to continue.', 'error');
      return;
    }

    this.sending = true;
    sheet.setStatus('Sending…');

    let prepared;
    let sent;
    try {
      prepared = await intentsChatPayments.prepare({
        asset, recipientAddress: this.recipientAddress, amount, note,
      });
      sent = await intentsChatPayments.send(prepared, secretKey, { asset, note });
    } catch (error) {
      this.sending = false;
      // Refused while preparing or in rehearsal: nothing was published, so
      // trying again is safe.
      if (!prepared || error?.code === 'WOULD_FAIL') {
        sheet.setStatus(error.message || 'That payment is not valid.', 'error');
        sheet.action.disabled = false;
        return;
      }
      // A failure while publishing may come after the relay took it.
      console.warn('Payment outcome unknown:', error);
      this.finish(UNCONFIRMED, 'error');
      sheet.finish(UNCONFIRMED, 'error');
      return;
    }

    // The money has moved. From here a failure is about the receipt only, and
    // the form is locked so it cannot describe a second payment.
    this.lockForm(true);
    this.pendingReceipt = { message: sent.message, amount: prepared.amount, symbol: prepared.symbol };
    this.sending = false;
    void multichain.refreshAfterMove().catch(() => {});

    if (await this.sendReceipt()) {
      multichain.confirmModal.close();
      return;
    }
    sheet.finish(`Your ${prepared.symbol} was sent, but the chat message did not go through. Go back to send it again.`, 'error');
  }

  /**
   * Post the chat message for a transfer that has already gone. Safe to press
   * again: it only ever resends the message, never the money.
   */
  async sendReceipt() {
    const receipt = this.pendingReceipt;
    if (!receipt || this.sending) return false;
    this.sending = true;
    this.sendButton.disabled = true;
    try {
      await this.onSent?.(this.recipientAddress, receipt.message);
      this.sending = false;
      this.close();
      this.showToast(`Sent ${receipt.amount} ${receipt.symbol}`, 3000, 'success');
      return true;
    } catch (error) {
      console.error('Payment receipt failed to send:', error);
      this.sending = false;
      this.setStatus(`Your ${receipt.symbol} was sent, but the chat message did not go through.`, 'error');
      this.sendButton.textContent = 'Send the message again';
      this.sendButton.disabled = false;
      return false;
    }
  }

  /** Every control that could describe a different payment. */
  lockForm(locked) {
    this.amount.setLocked(locked);
    for (const control of [this.assetChip, this.noteInput, this.noteToggle]) control.disabled = locked;
  }

  /** The transfer's outcome is unknowable: leave, never resend. */
  finish(message, kind) {
    this.done = true;
    this.pendingReceipt = null;
    this.lockForm(true);
    this.setStatus(message, kind);
    this.sendButton.textContent = 'Done';
    // Leaving is not a consequential action, so it is not blue.
    this.sendButton.classList.replace('btn--primary', 'btn--secondary');
    this.sendButton.disabled = false;
  }
}

export const chatPaymentPanel = new ChatPaymentPanel();
