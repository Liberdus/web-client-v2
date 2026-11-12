// Synthetic chat examples rendered without loading the client runtime.
class ChatPreview {
  static recipient = 'ari';
  static maxDraftBytes = 10_000;

  static populateDraft(screen) {
    const modal = screen.querySelector('#chatModal');
    modal.dataset.restoredDraft = '';
    modal.querySelector('.message-input').defaultValue = `Notes from the design review:\n${'• Confirm the revised payment flow.\n'.repeat(300)}`;
    modal.querySelector('.message-input-container').insertAdjacentHTML('afterbegin', '<div class="message-byte-counter"></div>');
    this.updateDraftState(modal);
  }

  static wireDraft(document) {
    const modal = document.querySelector('[data-restored-draft]');
    modal?.querySelector('.message-input').addEventListener('input', () => this.updateDraftState(modal));
  }

  static updateDraftState(modal) {
    const text = modal.querySelector('.message-input').value;
    const remaining = this.maxDraftBytes - new TextEncoder().encode(text).length;
    const counter = modal.querySelector('.message-byte-counter');
    counter.style.display = remaining <= this.maxDraftBytes * 0.1 ? 'block' : 'none';
    counter.style.color = remaining < 0 ? '#dc3545' : '#ffa726';
    counter.textContent = remaining < 0 ? `${-remaining} bytes - over limit` : `${remaining} bytes - left`;
    const hasText = text.trim().length > 0;
    const send = modal.querySelector('.send-button');
    send.disabled = remaining < 0;
    send.style.display = hasText ? 'flex' : 'none';
    modal.querySelector('.voice-record-button').style.display = hasText ? 'none' : 'flex';
  }

  static paymentRoutes = {
    payChoiceLibBtn: [{ id: 'sendAssetFormModal' }],
    payChoiceEvmBtn: [
      { id: 'assetsModal', next: '.connected-asset-button' },
      { id: 'assetDetailsModal', next: '#assetDetailsSend' },
      { id: 'evmSendModal' },
    ],
    payChoiceNearBtn: [
      { id: 'multichainModal', next: '.multichain-asset-button' },
      { id: 'multichainAssetModal', next: '#multichainAssetSend' },
      { id: 'nearIntentsSendModal' },
    ],
  };

  static paymentStatuses = {
    settled: 'Confirmed',
    unchecked: 'Checking…',
    pending: 'Confirming…',
    failed: 'Not confirmed',
    expired: 'Too old to check',
    unverifiable: 'Could not check yet',
  };

  static paymentExamples = {
    evm: [
      { status: 'settled', sent: true, amount: '25', symbol: 'USDC', network: 'Base', chainId: 8453, note: 'Thanks for the design review.\nMilestone 1 approved.' },
      { status: 'settled', amount: '0.01', symbol: 'ETH', network: 'Ethereum', chainId: 1, note: 'Native asset payment' },
      { status: 'unchecked', amount: '25', symbol: 'USDC', network: 'Base', chainId: 8453 },
      { status: 'pending', sent: true, amount: '0.01', symbol: 'ETH', network: 'Ethereum', chainId: 1, note: 'Confirming transfer' },
      { status: 'failed', amount: '10', symbol: 'USDC', network: 'Base', chainId: 8453, note: 'Payment could not be confirmed' },
      { status: 'expired', amount: '5', symbol: 'USDC', network: 'Base', chainId: 8453 },
      { status: 'unverifiable', amount: '0.5', symbol: 'ETH', network: 'EVM chain 999999', chainId: 999999, note: 'Network verification is unavailable.' },
    ],
    multichain: [
      { status: 'settled', sent: true, amount: '25', symbol: 'USDC', network: 'Ethereum', note: 'Thanks for the design review.' },
      { status: 'settled', amount: '0.002', symbol: 'BTC', network: 'Bitcoin', note: 'Milestone payment' },
      { status: 'unchecked', amount: '25', symbol: 'USDC', network: 'Base' },
      { status: 'pending', amount: '0.01', symbol: 'ETH', network: 'Ethereum', note: 'Confirming transfer' },
      { status: 'failed', amount: '10', symbol: 'USDC', network: 'Solana', note: 'Payment could not be confirmed' },
      { status: 'expired', amount: '5', symbol: 'USDC', network: 'Base' },
      { status: 'unverifiable', amount: '0.5', symbol: 'SOL', network: 'Solana' },
    ],
  };

  static renderEvmReceipt({ status, sent, amount, symbol, network, chainId, note }, index) {
    return `<div class="intents-payment-message evm-payment-message" data-verified="${status}" data-evm-payment="mock-evm-payment-${index}">
      <div class="payment-receipt-heading">
        ${symbol === 'ETH' ? '<img class="payment-receipt-logo" src="../media/ethereum_logo.png" alt="" width="20" height="20">' : ''}
        <div class="evm-payment-label">Payment ${sent ? 'sent' : 'received'}</div>
      </div>
      <div class="intents-payment-amount">${sent ? '−' : '+'}${amount} <span class="evm-payment-unit">${symbol}</span></div>
      <div class="intents-payment-chain">${network}</div>
      ${note ? `<section class="evm-payment-note" aria-label="Payment note"><div class="evm-payment-label">Note</div><div class="intents-payment-note">${note}</div></section>` : ''}
      <div class="evm-payment-meta">
        <div class="intents-payment-verified">${this.paymentStatuses[status]}</div>
        <div class="evm-payment-footer"><div class="message-time">10:1${index} AM</div></div>
      </div>
      <details class="evm-payment-details">
        <summary>Payment details</summary>
        <dl>
          <div><dt>Network</dt><dd>${network} · Chain ID ${chainId}</dd></div>
          <div><dt>Transaction</dt><dd><code>0x${String(index + 1).repeat(64)}</code></dd></div>
        </dl>
      </details>
    </div>`;
  }

  static renderNearReceipt({ status, sent, amount, symbol, network, note }, index) {
    return `<div class="intents-payment-message intents-payment-receipt" data-verified="${status}" data-intent-hash="mock-payment-${index}">
      <div class="payment-receipt-heading">
        <img class="payment-receipt-logo" src="../media/near_logo.png" alt="" width="20" height="20">
        <div class="intents-payment-label">Payment ${sent ? 'sent' : 'received'}</div>
      </div>
      <div class="intents-payment-amount" title="${amount} ${symbol}">${sent ? '−' : '+'}${amount} <span class="intents-payment-unit">${symbol}</span></div>
      <div class="intents-payment-chain">${network}</div>
      ${note ? `<section class="intents-payment-note-section" aria-label="Payment note"><div class="intents-payment-label">Note</div><div class="intents-payment-note">${note}</div></section>` : ''}
      <div class="intents-payment-meta">
        <div class="intents-payment-verified">${this.paymentStatuses[status]}</div>
        <div class="intents-payment-footer"><div class="message-time">10:0${index} AM</div></div>
      </div>
      <details class="intents-payment-details">
        <summary>Payment details</summary>
        <dl>
          <div><dt>Amount</dt><dd>${amount} ${symbol}</dd></div>
          <div><dt>Network</dt><dd>${network}</dd></div>
          <div><dt>Intent</dt><dd><code>mock-payment-${index}</code></dd></div>
        </dl>
      </details>
    </div>`;
  }

  static renderReceipts(group) {
    return this.paymentExamples[group].map((example, index) => {
      const markup = group === 'evm' ? this.renderEvmReceipt(example, index) : this.renderNearReceipt(example, index);
      return `<div data-chat-message-types="${group}" class="message ${example.sent ? 'sent' : 'received'}">${markup}</div>`;
    }).join('');
  }

  static appendModal(root, catalog, id) {
    const template = root.ownerDocument.createElement('template');
    template.innerHTML = catalog.get(id).markup.trim();
    const modal = template.content.firstElementChild;
    modal.classList.add('is-transition-complete');
    root.append(modal);
    return modal;
  }

  static populatePay(root, catalog, source) {
    const chooser = this.appendModal(root, catalog, 'payChoiceModal');
    chooser.classList.toggle('active', source === 'choice');
    chooser.querySelector('#payChoiceRecipient').textContent = `To @${this.recipient}`;
    const menu = root.querySelector('#chatHeaderContextMenu');
    if (menu && source === 'choice') menu.style.display = 'none';

    for (const { id, next } of Object.values(this.paymentRoutes).flat()) {
      const target = this.appendModal(root, catalog, id);
      window.populateWalletPreview(target, id);
      if (id === 'sendAssetFormModal') {
        target.querySelector('#sendToAddress').defaultValue = this.recipient;
        target.querySelector('#sendAmount').removeAttribute('value');
        target.querySelector('#sendMemo').defaultValue = '';
      }
      if (next) [...target.querySelectorAll(next)].slice(1).forEach((button) => button.remove());
    }
  }

  static wirePay(document) {
    const trigger = document.querySelector('[data-pay-entry]');
    if (!trigger) return;
    const chooser = document.querySelector('#payChoiceModal');
    const menu = trigger.closest('#chatHeaderContextMenu');
    const menuButton = document.querySelector('#chatModal .menu-icon');
    const returnFocus = menuButton || trigger;
    menuButton?.addEventListener('click', () => {
      menu.style.display = 'block';
      trigger.focus();
    });
    trigger.addEventListener('click', () => {
      if (menu) menu.style.display = 'none';
      chooser.classList.add('active');
      chooser.querySelector('.back-button').focus();
    });
    if (menu) {
      trigger.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        trigger.click();
      });
    }

    for (const [buttonId, steps] of Object.entries(this.paymentRoutes)) {
      let previousModal = chooser;
      let previousButton = chooser.querySelector(`#${buttonId}`);
      for (const { id, next } of steps) {
        const target = document.getElementById(id);
        const backButton = target.querySelector('.back-button');
        const origin = previousModal;
        const originButton = previousButton;
        originButton.addEventListener('click', () => {
          origin.classList.remove('active');
          target.classList.add('active');
          backButton.focus();
        });
        backButton.addEventListener('click', () => {
          target.classList.remove('active');
          if (origin === chooser) returnFocus.focus();
          else {
            origin.classList.add('active');
            originButton.focus();
          }
        });
        previousModal = target;
        previousButton = next && target.querySelector(next);
      }
    }
    chooser.querySelectorAll('#closePayChoiceModal, #cancelPayChoice').forEach((button) => {
      button.addEventListener('click', () => {
        chooser.classList.remove('active');
        returnFocus.focus();
      });
    });
  }

  static populateMedia(root, media) {
    const modal = root.querySelector('#fullImageModal');
    const title = modal.querySelector('#fullImageModalTitle');
    const isVideo = media === 'video';
    modal.classList.toggle('is-video', isVideo);
    modal.dataset.mediaPreview = '';
    title.textContent = isVideo ? 'motion-preview.webm' : 'liberdus-preview.png';
    modal.querySelector('#fullImageRotate').hidden = false;
    if (isVideo) {
      const video = modal.querySelector('#fullImageViewerVideo');
      video.src = './media-preview.webm';
      video.hidden = false;
      video.preload = 'metadata';
      return;
    }
    const image = modal.querySelector('#fullImageViewerImage');
    image.src = '../media/liberdus_logo_512.png';
    image.alt = 'Liberdus preview';
    image.hidden = false;
    modal.querySelector('#fullImageZoomControls').hidden = false;
    modal.querySelector('#fullImageZoomOut').disabled = true;
  }

  static wireMedia(document) {
    const modal = document.querySelector('[data-media-preview]');
    if (!modal) return;
    const viewer = modal.querySelector('#fullImageViewer');
    const image = modal.querySelector('#fullImageViewerImage');
    const zoomOut = modal.querySelector('#fullImageZoomOut');
    const zoomIn = modal.querySelector('#fullImageZoomIn');
    let rotation = 0;
    let zoom = 1;
    let hideTimer;
    const updateZoom = (value) => {
      zoom = value;
      image.style.transform = `scale(${zoom})`;
      zoomOut.disabled = zoom === 1;
      zoomIn.disabled = zoom === 4;
    };
    const revealControls = () => {
      modal.classList.remove('is-chrome-hidden');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!modal.querySelector(':focus-visible')) modal.classList.add('is-chrome-hidden');
      }, 3000);
    };
    modal.addEventListener('pointermove', revealControls);
    modal.addEventListener('focusin', revealControls);
    modal.querySelector('#fullImageRotate').addEventListener('click', () => {
      rotation = (rotation + 90) % 360;
      viewer.style.setProperty('--media-rotation', `${rotation}deg`);
      viewer.classList.toggle('is-rotated', rotation !== 0);
      viewer.classList.toggle('is-sideways', rotation % 180 !== 0);
      updateZoom(1);
      revealControls();
    });
    zoomIn.addEventListener('click', () => updateZoom(Math.min(zoom + 0.5, 4)));
    zoomOut.addEventListener('click', () => updateZoom(Math.max(zoom - 0.5, 1)));
  }

  static wireDeleteFeedback(document) {
    const action = document.querySelector('.context-menu-option[data-action="delete-for-all"][role="button"]');
    if (!action) return;
    action.addEventListener('click', () => {
      if (document.querySelector('[data-delete-feedback]')) return;
      const feedback = document.createElement('div');
      feedback.className = 'toast-container';
      feedback.dataset.deleteFeedback = '';
      feedback.innerHTML = `<div class="toast error sticky show" role="status">
        You’re offline. Reconnect to delete this message for everyone.
        <button type="button" class="toast-close-btn" aria-label="Close">&times;</button>
      </div>`;
      feedback.querySelector('button').addEventListener('click', () => feedback.remove());
      document.body.append(feedback);
    });
    action.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      action.click();
    });
  }
}

window.ChatPreview = ChatPreview;
