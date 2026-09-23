// The "Send Crypto" panel in a conversation.
//
// Sends an intents balance to the person you are chatting with. Their intents
// account is their Liberdus address, so there is nobody to look up and nothing
// to paste: the recipient is whoever the chat is with.
//
// The value and the receipt settle on different networks, so the order matters
// and is fixed: publish the transfer, then send the chat message. If the
// message fails the sender is told plainly that the money moved and the receipt
// did not, because the opposite order would let a receipt exist for a payment
// that never happened.

import { escapeHtml } from './lib.js';
import { intentsAssets } from './intents-assets.js';
import { intentsChatPayments } from './intents-chat.js';

const $ = (id) => document.getElementById(id);

export class ChatPaymentPanel {
  constructor() {
    this.loaded = false;
    this.recipientAddress = null;
    this.sending = false;
    this.getAccount = () => null;
    this.onSent = null;
    this.showToast = () => {};
  }

  configure({ getAccount, onSent, showToast } = {}) {
    if (typeof getAccount === 'function') {
      this.getAccount = getAccount;
      intentsChatPayments.configure({ getAccount });
    }
    if (typeof onSent === 'function') this.onSent = onSent;
    if (typeof showToast === 'function') this.showToast = showToast;
  }

  load() {
    if (this.loaded) return;
    this.panel = $('chatPaymentPanel');
    this.intro = $('chatPaymentIntro');
    this.assetSelect = $('chatPaymentAsset');
    this.amountInput = $('chatPaymentAmount');
    this.maxButton = $('chatPaymentMax');
    this.noteInput = $('chatPaymentNote');
    this.statusLine = $('chatPaymentStatus');
    this.cancelButton = $('cancelChatPaymentButton');
    this.sendButton = $('sendChatPaymentButton');

    this.cancelButton.addEventListener('click', () => this.close());
    this.sendButton.addEventListener('click', () => this.send());
    this.maxButton.addEventListener('click', () => {
      const asset = this.selectedAsset();
      if (asset) this.amountInput.value = asset.tokenAmount;
    });
    this.loaded = true;
  }

  selectedAsset() {
    return intentsAssets.getAsset(this.assetSelect.value) || null;
  }

  setStatus(message, kind = '') {
    this.statusLine.hidden = !message;
    this.statusLine.textContent = message || '';
    this.statusLine.dataset.kind = kind;
  }

  async open(recipientAddress, recipientName = null) {
    this.load();
    this.recipientAddress = recipientAddress;
    this.sending = false;
    this.amountInput.value = '';
    this.noteInput.value = '';
    this.setStatus('');
    this.sendButton.disabled = false;
    this.intro.textContent = recipientName
      ? `Send crypto to ${recipientName}. It settles instantly with no network fee.`
      : 'Send crypto to this contact. It settles instantly with no network fee.';

    this.panel.style.display = 'flex';
    this.assetSelect.innerHTML = '<option>Loading…</option>';

    await intentsAssets.refresh({ force: true });
    this.renderAssets();
  }

  renderAssets() {
    // Only what can actually be sent. Offering an empty asset would produce a
    // failure the person could have been spared.
    const fundedAssets = intentsAssets.getAssets().filter((asset) => asset.rawAmount !== '0');
    this.assetSelect.innerHTML = '';

    if (fundedAssets.length === 0) {
      this.assetSelect.innerHTML = '<option value="">Nothing to send yet</option>';
      this.sendButton.disabled = true;
      this.setStatus('Deposit something into your multichain wallet first.', 'error');
      return;
    }

    for (const asset of fundedAssets) {
      const option = document.createElement('option');
      option.value = asset.key;
      option.textContent = `${asset.tokenSymbol} · ${asset.tokenAmount} available`;
      this.assetSelect.appendChild(option);
    }
  }

  close() {
    if (this.sending) return;
    this.panel.style.display = 'none';
    this.recipientAddress = null;
  }

  async send() {
    if (this.sending) return;
    const asset = this.selectedAsset();
    const secretKey = this.getAccount()?.keys?.secret;
    if (!asset || !this.recipientAddress || !secretKey) return;

    this.sending = true;
    this.sendButton.disabled = true;
    this.setStatus('Checking…');

    let prepared;
    try {
      prepared = await intentsChatPayments.prepare({
        asset,
        recipientAddress: this.recipientAddress,
        amount: this.amountInput.value.trim(),
        note: this.noteInput.value.trim() || null,
      });
    } catch (error) {
      this.setStatus(error.message || 'That payment is not valid.', 'error');
      this.sending = false;
      this.sendButton.disabled = false;
      return;
    }

    let sent;
    try {
      this.setStatus('Sending…');
      sent = await intentsChatPayments.send(prepared, secretKey, {
        asset,
        note: this.noteInput.value.trim() || null,
      });
    } catch (error) {
      this.setStatus(error.message || 'The payment failed. Nothing was sent.', 'error');
      this.sending = false;
      this.sendButton.disabled = false;
      return;
    }

    // The money has moved. From here a failure is about the receipt only, and
    // must be reported as such rather than as a failed payment.
    try {
      await this.onSent?.(this.recipientAddress, sent.message);
      this.sending = false;
      this.close();
      this.showToast(`Sent ${prepared.amount} ${prepared.symbol}`, 3000, 'success');
    } catch (error) {
      console.error('Chat payment receipt failed to send:', error);
      this.sending = false;
      this.sendButton.disabled = false;
      this.setStatus(
        `The ${escapeHtml(prepared.symbol)} was sent, but the chat receipt did not go through. `
        + 'Their balance has it; the message is missing.',
        'error',
      );
    }
  }
}

export const chatPaymentPanel = new ChatPaymentPanel();
