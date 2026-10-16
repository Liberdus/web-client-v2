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

    token(symbol) {
      return `${this.mark(symbol, 24)}<span>${symbol}</span>`;
    }

    assetRows() {
      return this.assets.map((asset) => `<button type="button" class="multichain-row multichain-asset-button" aria-label="${asset.symbol} on ${asset.chain}">${this.mark(asset.symbol)}<span class="multichain-row-main"><span class="multichain-row-name">${asset.symbol}</span><span class="multichain-row-chain">${asset.chain}</span></span><span class="multichain-row-values"><span class="multichain-row-amount">${asset.amount}</span><span class="multichain-row-usd">${asset.value}</span></span></button>`).join('');
    }

    populate(id, recipientMode) {
      const isAddressRecipient = recipientMode === 'address';
      switch (id) {
        case 'walletScreen': {
          this.text('multichainSummaryValue', '$275.00');
          this.text('evmAssetsSummaryValue', '$750.00');
          const refreshButton = this.find('refreshBalance');
          this.html('assetsList', '<div class="asset-item"><img src="../media/liberdus_logo_50.png" class="asset-logo" alt="Liberdus" /><div class="asset-info"><div class="asset-name">Liberdus</div><div class="asset-symbol">$0.841762 / LIB</div></div><div class="asset-balance">295.120000<br /><span class="asset-symbol">$248.420803</span></div></div>');
          this.find('assetsList').querySelector('.asset-item').append(refreshButton);
          break;
        }
        case 'assetsModal':
          this.text('assetsTotalBalance', '750.00');
          this.value('assetsNetwork', 'all');
          this.find('evmPaymentRecovery').hidden = false;
          this.html('evmPaymentRecoveryList', `<div class="asset-item connected-asset-item evm-payment-pending-row"><div class="asset-logo connected-asset-logo">${this.mark('ETH')}</div><div class="asset-info"><div class="asset-name">0.01 ETH</div><div class="asset-symbol">To ari · Ethereum</div><div class="evm-payment-status">Message needs attention</div><div class="evm-payment-actions"><button type="button" class="secondary-button">Retry message</button><button type="button" class="secondary-button">Dismiss</button></div></div></div>`);
          this.html('connectedAssetsList', `<section class="wallet-network-assets"><button type="button" class="asset-item connected-asset-item connected-asset-button" data-network-id="ethereum" data-asset-key="native" aria-label="View Ethereum details"><div class="asset-logo connected-asset-logo">${this.mark('ETH')}</div><div class="asset-info"><div class="asset-name">Ethereum</div><div class="wallet-network-chain">Ethereum</div><div class="asset-symbol">$3,000.00 / ETH</div></div><div class="asset-balance">0.25 ETH<br /><span class="asset-symbol">$750.00</span></div></button></section>`);
          break;
        case 'assetDetailsModal':
          Object.entries({ assetDetailsModalTitle: 'ETH', assetDetailsSymbol: 'Ethereum price', assetDetailsPrice: '$3,000.00', assetDetailsUpdated: 'Updated just now', assetDetailsName: 'Ethereum', assetDetailsBalanceSymbol: 'ETH', assetDetailsValue: '$750.00', assetDetailsAmount: '0.25 ETH', assetDetailsNetwork: 'Ethereum', assetDetailsChainId: '1', assetDetailsType: 'Native asset', assetDetailsDecimals: '18', assetDetailsContract: 'Native asset — no contract', assetDetailsMarketPrice: '$3,000.00', assetDetailsHoldingValue: '$750.00' }).forEach(([id, value]) => this.text(id, value));
          this.find('assetDetailsPrice').style.removeProperty('color');
          this.find('assetDetailsMarketPrice').style.removeProperty('color');
          this.html('assetDetailsLogo', this.mark('ETH'));
          break;
        case 'sendAssetFormModal':
          this.html('sendAsset', '<option value="liberdus">Liberdus (LIB)</option>');
          this.value('sendToAddress', 'ari');
          this.value('sendAmount', '10');
          this.value('sendMemo', 'Dinner share');
          this.text('balanceSymbol', 'LIB');
          this.text('balanceAmount', '295.120000 LIB');
          this.text('transactionFee', '0.00 LIB');
          break;
        case 'sendAssetConfirmModal':
          this.text('confirmRecipient', 'ari');
          this.text('confirmAmount', '10');
          this.text('confirmAmountUSD', '≈ $8.417620 USD');
          this.find('confirmAmountUSD').style.display = 'block';
          this.text('confirmAsset', 'LIB');
          this.text('confirmMemo', 'Dinner share');
          this.find('confirmMemoGroup').style.display = 'block';
          break;
        case 'receiveModal':
          this.text('displayAddress', this.address);
          this.html('receiveAsset', '<option value="liberdus">Liberdus (LIB)</option>');
          this.text('receiveBalanceSymbol', 'LIB');
          this.value('receiveAmount', '10');
          this.value('receiveMemo', 'Dinner share');
          break;
        case 'evmSendModal':
          this.text('evmSendAssetLabel', 'Ethereum (ETH) · Ethereum');
          this.value('evmSendRecipient', isAddressRecipient ? this.address : 'ari');
          this.text('evmSendRecipientStatus', isAddressRecipient
            ? 'Valid address — wallet transfer only'
            : 'Contact found — includes a chat payment message');
          this.find('evmSendRecipientStatus').style.display = 'inline';
          this.find('evmSendRecipientStatus').style.color = '#28a745';
          this.value('evmSendAmount', '0.01');
          this.text('evmSendSymbol', 'ETH');
          this.text('evmSendBalance', '0.25 ETH');
          this.find('evmSendMemoGroup').hidden = isAddressRecipient;
          this.value('evmSendMemo', isAddressRecipient ? '' : 'Dinner share');
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
            : 'Includes a chat payment message. Message fee and toll: 0.001 LIB.');
          break;
        case 'evmReceiveModal':
          this.text('evmReceiveAssetLabel', 'Ethereum (ETH) · Ethereum');
          this.text('evmReceiveAddress', this.address);
          this.text('evmReceiveSymbol', 'ETH');
          this.value('evmReceiveAmount', '0.01');
          break;
        case 'multichainModal':
          this.text('multichainTotalBalance', '$275.00');
          this.text('multichainHeroCaption', 'Across 2 networks');
          this.html('multichainAssetsList', this.assetRows());
          break;
        case 'multichainAssetModal':
          this.text('multichainAssetTitle', 'USDC · Ethereum');
          this.text('multichainAssetAmount', '125 USDC');
          this.text('multichainAssetValue', '$125.00');
          this.html('multichainAssetIcon', this.mark('USDC', 56));
          this.html('multichainAssetActivity', '<div class="multichain-list"><div class="multichain-row is-static" data-status="settled"><span class="multichain-activity-icon" data-icon="in" aria-hidden="true"></span><span class="multichain-row-main"><span class="multichain-row-name">Received</span><span class="multichain-row-chain">Today · From Ari</span></span><span class="multichain-row-values"><span class="multichain-row-amount">+25</span><span class="multichain-activity-status"></span></span></div></div>');
          break;
        case 'multichainReceiveModal':
          this.text('multichainReceiveTitle', 'Receive USDC · Ethereum');
          this.html('multichainReceiveBody', `<div class="multichain-deposit-headline"><div class="multichain-deposit-minimum">Send at least 1 USDC</div><div class="multichain-deposit-sub">about $1.00</div></div><div class="multichain-qr" id="multichainDepositQr"></div><button type="button" class="multichain-address"><span class="multichain-address-label">Address</span><span class="multichain-address-value">0x111111…111111</span><span class="multichain-address-copy">Copy</span></button><ul class="multichain-rules"><li>Send only <strong>USDC</strong> on <strong>Ethereum</strong>. Other assets or networks are lost.</li></ul>`);
          break;
        case 'multichainWithdrawModal':
          this.value('multichainWithdrawTo', this.address);
          this.value('multichainWithdrawAmount', '25');
          this.html('multichainWithdrawToken', this.token('USDC'));
          this.html('multichainWithdrawOutToken', this.token('USDC'));
          this.text('multichainWithdrawAvailable', '125 USDC available');
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
          this.text('multichainSwapAvailable', '125 USDC available');
          this.text('multichainSwapOut', '0.165');
          this.text('multichainSwapOutUsd', '$24.75');
          this.text('multichainSwapToChain', 'On Solana');
          this.text('multichainSwapFloor', 'At least 0.164 SOL');
          this.find('multichainSwapPreview').disabled = false;
          break;
        case 'multichainTokenPickerModal':
          this.html('multichainTokenResults', `<div class="multichain-section-title">You hold</div><div class="multichain-list">${this.assetRows()}</div>`);
          break;
        case 'multichainConfirmModal':
          this.text('multichainConfirmTitle', 'Confirm swap');
          this.html('multichainConfirmHero', `${this.mark('SOL', 56)}<div class="multichain-confirm-amount">0.164 SOL</div><div class="multichain-confirm-sub">at least, on Solana</div>`);
          this.html('multichainConfirmRows', '<dt>You swap</dt><dd>25 USDC</dd><dt>Estimated</dt><dd>0.165 SOL</dd><dt>Guaranteed at least</dt><dd class="is-guaranteed">0.164 SOL</dd><dt>Takes about</dt><dd>30s</dd>');
          this.text('multichainConfirmAction', 'Swap USDC');
          this.text('multichainConfirmNote', 'The rate can move. You get at least the guaranteed amount, or your USDC back.');
          break;
        case 'chatSendContactModal':
          this.html('chatSendContactResults', '<div class="multichain-list"><button type="button" class="multichain-row"><span class="chat-send-contact-avatar"></span><span class="multichain-row-main"><span class="multichain-row-name">Ari Rivera</span><span class="multichain-row-chain">@ari</span></span></button></div>');
          break;
        case 'chatSendModal':
          this.text('chatSendTitle', 'Send to Ari');
          this.value('chatSendAmount', '25');
          this.html('chatSendAsset', this.token('USDC'));
          this.text('chatSendAvailable', '125 USDC available');
          this.find('chatSendButton').disabled = false;
          break;
      }
      this.renderQrCode();
    }

    renderQrCode() {
      const qrTarget = this.root.querySelector('#qrcode, #evmReceiveQRCode, #multichainDepositQr');
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

  window.populateWalletPreview = (root, id, recipientMode) => new WalletPreview(root).populate(id, recipientMode);
})();
