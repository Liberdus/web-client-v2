// Fixed visual fixtures applied to generated production markup. No wallet services run here.
(() => {
  class WalletPreview {
    constructor(root) {
      this.root = root;
      this.address = '0x1111111111111111111111111111111111111111';
      this.assets = [
        { symbol: 'USDC', chain: 'Ethereum', amount: '125', value: '$125.00' },
        { symbol: 'ETH', chain: 'Ethereum', amount: '0.025', value: '$75.00' },
        { symbol: 'SOL', chain: 'Solana', amount: '0.5', value: '$75.00' },
      ];
      this.otherAsset = { symbol: 'USDT', chain: 'Ethereum', amount: '0', value: '$0.00' };
    }

    find(id) {
      const element = this.root.querySelector(`#${id}`);
      if (!element) throw new Error(`Wallet preview is missing production element: ${id}`);
      return element;
    }

    text(id, value) {
      this.find(id).textContent = value;
    }

    html(id, value) {
      this.find(id).innerHTML = value;
    }

    value(id, value) {
      const element = this.find(id);
      element.value = value;
      // Persist control state when the fixture is serialized into the iframe.
      if (element.tagName === 'SELECT') {
        [...element.options].forEach((option) => { option.defaultSelected = option.selected; });
      } else if (element.tagName === 'TEXTAREA') {
        element.textContent = value;
      } else {
        element.setAttribute('value', value);
      }
    }

    mark(symbol, size = 40) {
      return window.WALLET_ASSET_MARKS[symbol][size];
    }

    token(symbol, label = symbol) {
      return `${this.mark(symbol, 24)}<span>${label}</span>`;
    }

    assetRows(assets, overview = false) {
      return assets.map(({ symbol, chain, amount, value }) => `
        <button type="button" class="multichain-row${overview ? ' multichain-asset-button' : ''}" aria-label="${symbol} (${chain})">
          ${this.mark(symbol)}
          <span class="multichain-row-main">
            <span class="multichain-row-name">${symbol}</span>
            <span class="multichain-row-chain">${chain}</span>
          </span>
          ${overview || amount !== '0' ? `<span class="multichain-row-values wallet-value-stack">
            <span class="multichain-row-amount">${overview ? `${amount} ${symbol}` : amount}</span>
            <span class="multichain-row-usd">${value}</span>
          </span>` : ''}
        </button>`).join('');
    }

    showContactSuggestion(inputId, listId) {
      const input = this.find(inputId);
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-controls', listId);
      input.setAttribute('aria-expanded', 'true');
      this.value(inputId, 'ar');
      const list = this.find(listId);
      list.setAttribute('role', 'listbox');
      list.hidden = false;
      this.html(listId, `<div id="${listId}-option-0" class="contact-autocomplete-option" data-index="0" role="option" aria-selected="false">
        <span class="contact-autocomplete-avatar" aria-hidden="true">A</span>
        <span class="contact-autocomplete-text"><span>Ari Rivera</span><span class="contact-autocomplete-username">@ari</span></span>
      </div>`);
    }

    showNearAmount(prefix) {
      this.text(`${prefix}Available`, 'Balance 125');
      const flip = this.find(`${prefix}Flip`);
      flip.hidden = false;
      flip.setAttribute('aria-label', 'Enter the amount in US dollars');
      flip.innerHTML = `<span>≈ $25.00</span>
        <svg class="multichain-amount-flip-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>
        </svg>`;
    }

    populate(id, mode) {
      const isAddressRecipient = mode === 'address';
      const showSuggestions = mode === 'contacts';
      switch (id) {
        case 'walletScreen': {
          this.text('multichainSummaryValue', '$275.00');
          this.text('evmAssetsSummaryValue', '$750.00');
          this.text('walletBalanceUpdated', 'Updated 2m ago');
          this.find('walletBalanceUpdated').dateTime = '2026-11-11T23:49:00Z';
          this.html('assetsList', `<div class="asset-item">
            <img src="../media/liberdus_logo_50.png" class="asset-logo" alt="Liberdus" />
            <div class="asset-info"><div class="asset-name">Liberdus</div><div class="asset-symbol">1 LIB = $0.841762</div></div>
            <div class="asset-balance">
              <span class="wallet-native-quantity">295.12 LIB</span>
              <span class="wallet-native-usd">$248.42</span>
              <span class="wallet-price-status"></span>
            </div>
          </div>`);
          if (mode === 'prices') {
            this.text('multichainSummaryValue', '$200.00');
            this.text('multichainSummaryStatus', 'some prices unavailable');
            this.text('evmAssetsSummaryValue', '$ -');
            this.find('evmAssetsSummaryValue').style.color = 'var(--danger-color)';
            this.text('evmAssetsSummaryStatus', 'prices unavailable');
          }
          break;
        }
        case 'assetsModal':
          this.text('assetsTotalBalance', '$750.00');
          this.value('assetsNetwork', 'all');
          this.find('evmPaymentRecovery').hidden = false;
          this.html('evmPaymentRecoveryList', `<div class="asset-item connected-asset-item evm-payment-pending-row"><div class="asset-logo connected-asset-logo">${this.mark('ETH')}</div><div class="asset-info"><div class="asset-name">0.01 ETH</div><div class="asset-symbol">To ari · Ethereum</div><div class="evm-payment-status">Message needs attention</div><div class="evm-payment-actions"><button type="button" class="secondary-button">Retry message</button><button type="button" class="secondary-button">Dismiss</button></div></div></div>`);
          this.html('connectedAssetsList', `<section class="wallet-network-assets">
            <button type="button" class="asset-item connected-asset-item connected-asset-button" data-network-id="ethereum" data-asset-key="native" aria-label="View Ethereum details">
              <div class="asset-logo connected-asset-logo">${this.mark('ETH')}</div>
              <div class="asset-info"><div class="asset-name">Ethereum</div><div class="wallet-network-chain">Ethereum</div><div class="asset-symbol">$3,000.00 / ETH</div></div>
              <div class="asset-balance wallet-value-stack"><span>0.25 ETH</span><span class="asset-symbol">$750.00</span><span class="wallet-price-status"></span></div>
            </button>
          </section>`);
          break;
        case 'assetDetailsModal':
          Object.entries({ assetDetailsModalTitle: 'ETH', assetDetailsSymbol: 'Ethereum price', assetDetailsPrice: '$3,000.00', assetDetailsUpdated: 'Updated just now', assetDetailsName: 'Ethereum', assetDetailsBalanceSymbol: 'ETH', assetDetailsValue: '$750.00', assetDetailsAmount: '0.25 ETH', assetDetailsNetwork: 'Ethereum', assetDetailsChainId: '1', assetDetailsType: 'Native asset', assetDetailsDecimals: '18', assetDetailsContract: 'Native asset — no contract', assetDetailsMarketPrice: '$3,000.00', assetDetailsHoldingValue: '$750.00' }).forEach(([id, value]) => this.text(id, value));
          this.find('assetDetailsPrice').style.removeProperty('color');
          this.find('assetDetailsMarketPrice').style.removeProperty('color');
          this.html('assetDetailsLogo', this.mark('ETH'));
          break;
        case 'sendAssetFormModal':
          this.value('sendToAddress', 'ari');
          this.value('sendAmount', '10');
          this.value('sendMemo', 'Dinner share');
          this.text('balanceSymbol', 'LIB');
          this.text('balanceAmount', '295.120000 LIB');
          this.text('transactionFee', '0.00 LIB');
          if (showSuggestions) {
            this.showContactSuggestion('sendToAddress', 'sendToAddressSuggestions');
            this.root.querySelector('#sendForm button[type="submit"]').disabled = true;
          } else {
            const status = this.find('sendToAddressError');
            status.textContent = 'found';
            status.style.color = '#28a745';
            status.style.display = 'inline';
          }
          break;
        case 'sendAssetConfirmModal':
          this.text('confirmRecipient', 'ari');
          this.text('confirmAmount', '10 LIB');
          this.text('confirmAmountUSD', '≈ $8.42 USD');
          this.find('confirmAmountUSD').style.display = 'block';
          this.text('confirmAsset', 'Liberdus (LIB)');
          this.text('confirmMemo', 'Dinner share');
          this.find('confirmMemoGroup').style.display = 'block';
          break;
        case 'receiveModal':
          this.text('displayAddress', this.address);
          this.text('receiveBalanceSymbol', 'LIB');
          this.value('receiveAmount', '10');
          this.value('receiveMemo', 'Dinner share');
          break;
        case 'evmSendModal':
          this.text('evmSendAssetLabel', 'Ethereum (ETH) · Ethereum');
          this.value('evmSendRecipient', isAddressRecipient ? this.address : 'ari');
          if (showSuggestions) {
            this.showContactSuggestion('evmSendRecipient', 'evmSendRecipientSuggestions');
          } else {
            this.text('evmSendRecipientStatus', isAddressRecipient ? 'Valid address — wallet transfer only' : 'Username verified');
            this.find('evmSendRecipientStatus').style.display = 'inline';
            this.find('evmSendRecipientStatus').style.color = '#28a745';
          }
          if (!isAddressRecipient && !showSuggestions) {
            this.find('evmSendRecipientToll').hidden = false;
            this.text('evmSendRecipientToll', 'Sending to this contact will incur a toll of 0.001 LIB.');
          }
          this.value('evmSendAmount', '0.01');
          this.text('evmSendSymbol', 'ETH');
          this.text('evmSendBalance', '0.25 ETH');
          this.find('evmSendMemoGroup').hidden = isAddressRecipient || showSuggestions;
          if (!this.find('evmSendMemoGroup').hidden) this.value('evmSendMemo', 'Dinner share');
          break;
        case 'evmSendConfirmModal':
          this.text('evmConfirmRecipient', isAddressRecipient ? this.address : 'ari');
          this.text('evmConfirmAmount', '0.01 ETH');
          this.text('evmConfirmAmountUSD', '≈ $30.00');
          this.find('evmConfirmAmountUSD').style.display = 'block';
          this.text('evmConfirmAsset', 'Ethereum (ETH)');
          this.text('evmConfirmMemo', isAddressRecipient ? '' : 'Dinner share');
          this.find('evmConfirmMemoGroup').style.display = isAddressRecipient ? 'none' : 'block';
          this.text('evmConfirmNetwork', 'Ethereum (Chain ID 1)');
          this.text('evmConfirmFee', '0.0001 ETH');
          this.text('evmConfirmFeeUSD', '≈ $0.30');
          this.find('evmConfirmFeeUSD').style.display = 'block';
          this.text('evmConfirmSigningNotice', isAddressRecipient
            ? 'Wallet transfer only; no chat message. Your key signs locally on this device.'
            : 'Includes a chat payment message. Liberdus message fee: 0.0001 LIB. Recipient toll: 0.001 LIB.');
          break;
        case 'evmReceiveModal':
          this.text('evmReceiveAssetLabel', 'Ethereum (ETH) · Ethereum');
          this.text('evmReceiveAddress', this.address);
          this.text('evmReceiveSymbol', 'ETH');
          this.value('evmReceiveAmount', '0.01');
          this.value('evmReceiveMemo', 'Dinner share');
          break;
        case 'multichainModal':
          this.text('multichainTotalBalance', '$275.00');
          this.text('multichainHeroCaption', 'Across 2 networks');
          this.find('multichainListHead').hidden = false;
          this.find('multichainHideEmpty').defaultChecked = true;
          this.html('multichainAssetsList', this.assetRows(this.assets, true));
          break;
        case 'multichainAssetModal':
          if (mode === 'empty-asset') {
            this.text('multichainAssetTitle', 'USDT (Ethereum)');
            this.text('multichainAssetAmount', '0 USDT');
            this.text('multichainAssetValue', '$0.00');
            this.html('multichainAssetIcon', this.mark('USDT', 64));
            for (const id of ['multichainAssetSend', 'multichainAssetWithdraw', 'multichainAssetSwap']) this.find(id).disabled = true;
            this.html('multichainAssetActivity', '<p class="multichain-activity-note">No activity yet</p>');
            break;
          }
          this.text('multichainAssetTitle', 'USDC (Ethereum)');
          this.text('multichainAssetAmount', '125 USDC');
          this.text('multichainAssetValue', '$125.00');
          this.html('multichainAssetIcon', this.mark('USDC', 64));
          this.html('multichainAssetActivity', '<div class="multichain-list"><div class="multichain-row is-static" data-status="settled"><span class="multichain-activity-icon" data-icon="in" aria-hidden="true"></span><span class="multichain-row-main"><span class="multichain-row-name">Received</span><span class="multichain-row-chain">Today · From Ari</span></span><span class="multichain-row-values"><span class="multichain-row-amount">+25</span><span class="multichain-activity-status"></span></span></div></div>');
          break;
        case 'multichainRequestModal':
          this.text('multichainRequestTitle', 'Receive USDC (Ethereum)');
          this.text('multichainRequestAddress', this.address);
          this.text('multichainRequestUsername', 'alex');
          this.text('multichainRequestSymbol', 'USDC');
          this.value('multichainRequestAmount', '25');
          this.value('multichainRequestMemo', 'Dinner share');
          break;
        case 'multichainReceiveModal':
          this.text('multichainReceiveTitle', 'Deposit USDC (Ethereum)');
          this.html('multichainReceiveBody', `<div class="multichain-deposit-headline"><div class="multichain-deposit-minimum">Send at least 1 USDC</div><div class="multichain-deposit-sub">about $1.00</div></div><div class="multichain-qr" id="multichainDepositQr"></div><button type="button" class="multichain-address" aria-label="Copy address ${this.address}"><span class="multichain-address-label">Address</span><span class="multichain-address-value">0x11111111…11111111</span><span class="multichain-address-copy" aria-live="polite"></span></button><ul class="multichain-rules"><li>Send only <strong>USDC</strong> on <strong>Ethereum</strong>. Other assets or networks are lost.</li></ul>`);
          break;
        case 'multichainWithdrawModal':
          this.value('multichainWithdrawTo', this.address);
          this.value('multichainWithdrawAmount', '25');
          this.html('multichainWithdrawToken', this.token('USDC'));
          this.html('multichainWithdrawOutToken', this.token('USDC'));
          this.showNearAmount('multichainWithdraw');
          this.text('multichainWithdrawOut', '24');
          this.find('multichainWithdrawOut').classList.remove('is-empty');
          this.text('multichainWithdrawOutUsd', '$24.00');
          this.text('multichainWithdrawOutChain', 'On Ethereum');
          this.text('multichainWithdrawFee', 'Estimated fee: 1 USDC');
          this.find('multichainWithdrawPreview').disabled = false;
          break;
        case 'multichainSwapModal':
          this.value('multichainSwapAmount', '25');
          this.html('multichainSwapFrom', this.token('USDC'));
          this.html('multichainSwapTo', this.token('SOL'));
          this.showNearAmount('multichainSwap');
          this.text('multichainSwapOut', '0.165');
          this.text('multichainSwapOutUsd', '$24.75');
          this.text('multichainSwapToChain', 'On Solana');
          this.text('multichainSwapFloor', 'At least 0.164 SOL');
          this.find('multichainSwapPreview').disabled = false;
          break;
        case 'multichainTokenPickerModal':
          if (mode === 'other-assets') this.text('multichainTokenPickerTitle', 'Other assets');
          this.html('multichainTokenResults', `<div class="multichain-section-title">Your tokens</div><div class="multichain-list">${this.assetRows(this.assets)}</div>
            <div class="multichain-section-title">Popular</div><div class="multichain-list">${this.assetRows([this.otherAsset])}</div>`);
          break;
        case 'multichainConfirmModal':
          if (mode === 'payment' || mode === 'toll-increase') {
            const toll = mode === 'toll-increase' ? '0.002 LIB' : '0.001 LIB';
            this.text('multichainConfirmTitle', 'Confirm payment');
            this.html('multichainConfirmHero', `${this.mark('USDC', 56)}<div class="multichain-confirm-amount">25 USDC</div><div class="multichain-confirm-sub">about $25.00</div>`);
            this.html('multichainConfirmRows', `<dt>To</dt><dd>@ari</dd><dt>Asset network</dt><dd>Ethereum</dd><dt>Note</dt><dd>Dinner share</dd><dt>Network fee</dt><dd>None</dd><dt>Chat message toll</dt><dd>${toll}</dd><dt>Arrives</dt><dd>Instantly</dd>`);
            this.text('multichainConfirmAction', 'Send USDC');
            this.text('multichainConfirmNote', 'Payments cannot be undone.');
            if (mode === 'toll-increase') {
              const status = this.find('multichainConfirmStatus');
              status.hidden = false;
              status.dataset.kind = 'error';
              status.textContent = 'The chat message toll increased. Review the new amount and confirm again.';
            }
            break;
          }
          this.text('multichainConfirmTitle', 'Confirm swap');
          this.html('multichainConfirmHero', `${this.mark('SOL', 56)}<div class="multichain-confirm-amount">0.164 SOL</div><div class="multichain-confirm-sub">at least, on Solana</div>`);
          this.html('multichainConfirmRows', '<dt>You swap</dt><dd>25 USDC</dd><dt>Estimated</dt><dd>0.165 SOL</dd><dt>Guaranteed at least</dt><dd class="is-guaranteed">0.164 SOL</dd><dt>Takes about</dt><dd>30s</dd>');
          this.text('multichainConfirmAction', 'Swap USDC');
          this.text('multichainConfirmNote', 'The rate can move. You get at least the guaranteed amount, or your USDC back.');
          break;
        case 'nearIntentsSendModal':
          this.find('chatSendRecipientGroup').hidden = false;
          this.find('chatSendReceiptToll').hidden = false;
          this.find('chatSendAssetLabel').hidden = false;
          this.html('chatSendAssetLabel', this.token('USDC', 'USDC (Ethereum)'));
          this.value('chatSendAmount', '25');
          this.showNearAmount('chatSend');
          if (showSuggestions) {
            this.showContactSuggestion('chatSendRecipient', 'chatSendRecipientSuggestions');
          } else {
            this.value('chatSendRecipient', 'ari');
            this.text('chatSendRecipientStatus', 'Verified @ari');
            this.find('chatSendRecipientStatus').hidden = false;
            this.find('chatSendRecipientStatus').dataset.kind = 'ok';
            this.text('chatSendReceiptTollAmount', '0.001 LIB');
            this.find('chatSendNoteToggle').hidden = true;
            this.find('chatSendNote').hidden = false;
            this.value('chatSendNote', 'Dinner share');
            this.find('chatSendButton').disabled = false;
          }
          if (mode === 'qr-mismatch') {
            this.root.insertAdjacentHTML('beforeend', `<div class="toast-container" id="toastContainer">
              <div class="toast warning show sticky">From Wallet, open EVM Assets, then switch to ETH on Ethereum.<button type="button" class="toast-close-btn" aria-label="Close">&times;</button></div>
            </div>`);
          }
          break;
      }
      this.renderQrCode();
    }

    renderQrCode() {
      const qrTarget = this.root.querySelector('#qrcode, #evmReceiveQRCode, #multichainDepositQr, #multichainRequestQr');
      if (!qrTarget) return;
      const bytes = window.qr.encodeQR('Mock preview only - not a payment address', 'gif', { scale: 4 });
      const image = document.createElement('img');
      image.src = `data:image/gif;base64,${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;
      image.width = 200;
      image.height = 200;
      image.alt = 'Illustrative QR code, not a payment address';
      qrTarget.replaceChildren(image);
    }
  }

  window.populateWalletPreview = (root, id, mode) => new WalletPreview(root).populate(id, mode);
})();
