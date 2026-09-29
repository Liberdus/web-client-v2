// Fixed visual fixtures applied to generated production markup. No wallet services run here.
(() => {
  const address = '0x1111111111111111111111111111111111111111';
  const mark = (symbol, size = 40) => window.WALLET_ASSET_MARKS[symbol][size];
  const token = (symbol) => `${mark(symbol, 24)}<span>${symbol}</span>`;
  const assets = [
    { symbol: 'USDC', chain: 'Ethereum', amount: '125', value: '$125.00' },
    { symbol: 'ETH', chain: 'Ethereum', amount: '0.025', value: '$75.00' },
    { symbol: 'SOL', chain: 'Solana', amount: '0.5', value: '$75.00' },
  ];
  const assetRows = () => assets.map((asset) => `<button type="button" class="multichain-row multichain-asset-button" aria-label="${asset.symbol} on ${asset.chain}">${mark(asset.symbol)}<span class="multichain-row-main"><span class="multichain-row-name">${asset.symbol}</span><span class="multichain-row-chain">${asset.chain}</span></span><span class="multichain-row-values"><span class="multichain-row-amount">${asset.amount}</span><span class="multichain-row-usd">${asset.value}</span></span></button>`).join('');

  window.populateWalletPreview = (root, id, category) => {
    const find = (id) => {
      const element = root.querySelector(`#${id}`);
      if (!element) throw new Error(`Wallet preview is missing production element: ${id}`);
      return element;
    };
    const text = (id, value) => { find(id).textContent = value; };
    const html = (id, value) => { find(id).innerHTML = value; };
    const value = (id, value) => {
      const element = find(id);
      element.value = value;
      // Persist control state when the fixture is serialized into the iframe.
      if (element.tagName === 'SELECT') {
        [...element.options].forEach((option) => { option.defaultSelected = option.selected; });
      } else {
        element.setAttribute('value', value);
      }
    };
    const evm = category === 'evm';
    switch (id) {
      case 'walletScreen':
        text('walletTotalBalance', '248.42');
        text('multichainSummaryValue', '$275.00');
        html('assetsList', '<div class="asset-item"><div class="asset-logo"><img src="../media/liberdus_logo_50.png" class="asset-logo" alt="" /></div><div class="asset-info"><div class="asset-name">Liberdus</div><div class="asset-symbol">$0.841762 / LIB</div></div><div class="asset-balance">295.120000<br /><span class="asset-symbol">$248.420000</span></div></div>');
        break;
      case 'assetsModal':
        text('assetsTotalBalance', '750.00');
        html('connectedAssetsList', '<section class="wallet-network-assets"><button type="button" class="asset-item connected-asset-item connected-asset-button" data-network-id="ethereum" aria-label="View Ethereum details"><div class="asset-logo connected-asset-logo"><span class="connected-asset-logo-fallback">ETH</span></div><div class="asset-info"><div class="asset-name">Ethereum</div><div class="wallet-network-chain">Ethereum</div><div class="asset-symbol">$3,000.00 / ETH</div></div><div class="asset-balance">0.25 ETH<br /><span class="asset-symbol">$750.00</span></div></button></section>');
        break;
      case 'assetDetailsModal':
        Object.entries({ assetDetailsModalTitle: 'ETH', assetDetailsSymbol: 'Ethereum price', assetDetailsPrice: '$3,000.00', assetDetailsUpdated: 'Updated just now', assetDetailsName: 'Ethereum', assetDetailsBalanceSymbol: 'ETH', assetDetailsValue: '$750.00', assetDetailsAmount: '0.25 ETH', assetDetailsNetwork: 'Ethereum', assetDetailsChainId: '1', assetDetailsType: 'Native asset', assetDetailsDecimals: '18', assetDetailsContract: 'Native asset — no contract', assetDetailsMarketPrice: '$3,000.00', assetDetailsHoldingValue: '$750.00' }).forEach(([id, value]) => text(id, value));
        find('assetDetailsPrice').style.removeProperty('color');
        find('assetDetailsMarketPrice').style.removeProperty('color');
        html('assetDetailsLogo', '<span class="connected-asset-logo-fallback">ETH</span>');
        break;
      case 'sendAssetFormModal':
        find('sendNetworkGroup').hidden = !evm;
        value('sendNetwork', evm ? 'ethereum' : 'liberdus');
        text('sendNetworkStatus', evm ? 'Ethereum transfers are ready.' : 'Liberdus transfers are ready.');
        html('sendAsset', `<option>${evm ? 'Ethereum (ETH)' : 'Liberdus (LIB)'}</option>`);
        value('sendToAddress', evm ? address : 'ari');
        value('sendAmount', evm ? '0.01' : '10');
        text('balanceSymbol', evm ? 'ETH' : 'LIB');
        text('balanceAmount', evm ? '0.25 ETH' : '295.12 LIB');
        text('transactionFee', evm ? '0.0001 ETH' : '0.001 LIB');
        find('sendMemoGroup').hidden = evm;
        break;
      case 'sendAssetConfirmModal':
        text('confirmRecipient', evm ? address : 'ari');
        text('confirmAmount', evm ? '0.01 ETH' : '10 LIB');
        text('confirmAmountUSD', evm ? '≈ $30.00' : '$8.42');
        find('confirmAmountUSD').style.display = 'block';
        text('confirmAsset', evm ? 'Ethereum (ETH)' : 'Liberdus');
        if (evm) {
          root.querySelector('.confirmation-details').insertAdjacentHTML('beforeend', '<div class="form-group" id="evmConfirmNetworkGroup"><label>Network</label><div class="confirm-value" id="evmConfirmNetwork">Ethereum (Chain ID 1)</div></div><div class="form-group" id="evmConfirmFeeGroup"><label>Maximum network fee</label><div class="confirm-value" id="evmConfirmFee">0.0001 ETH</div></div><div id="evmConfirmSigningNotice" style="color:var(--secondary-text-color);font-size:var(--font-size-sm);line-height:1.4;padding:4px 0">Signature: your wallet key signs locally and never leaves this device.</div>');
        }
        break;
      case 'receiveModal':
        find('receiveNetworkGroup').hidden = !evm;
        value('receiveNetwork', evm ? 'ethereum' : 'liberdus');
        text('displayAddress', address);
        html('receiveAsset', `<option>${evm ? 'Ethereum (ETH)' : 'Liberdus (LIB)'}</option>`);
        text('receiveBalanceSymbol', evm ? 'ETH' : 'LIB');
        find('receiveMemoGroup').hidden = evm;
        break;
      case 'multichainModal':
        text('multichainTotalBalance', '$275.00');
        text('multichainHeroCaption', 'Across 2 networks');
        html('multichainAssetsList', assetRows());
        break;
      case 'multichainAssetModal':
        text('multichainAssetTitle', 'USDC · Ethereum');
        text('multichainAssetAmount', '125 USDC');
        text('multichainAssetValue', '$125.00');
        html('multichainAssetIcon', mark('USDC', 56));
        html('multichainAssetActivity', '<div class="multichain-list"><div class="multichain-row is-static" data-status="settled"><span class="multichain-activity-icon" data-icon="in" aria-hidden="true"></span><span class="multichain-row-main"><span class="multichain-row-name">Received</span><span class="multichain-row-chain">Today · From Ari</span></span><span class="multichain-row-values"><span class="multichain-row-amount">+25</span><span class="multichain-activity-status"></span></span></div></div>');
        break;
      case 'multichainReceiveModal':
        text('multichainReceiveTitle', 'Receive USDC · Ethereum');
        html('multichainReceiveBody', `<div class="multichain-deposit-headline"><div class="multichain-deposit-minimum">Send at least 1 USDC</div><div class="multichain-deposit-sub">about $1.00</div></div><div class="multichain-qr" id="multichainDepositQr"></div><button type="button" class="multichain-address"><span class="multichain-address-label">Address</span><span class="multichain-address-value">0x111111…111111</span><span class="multichain-address-copy">Copy</span></button><ul class="multichain-rules"><li>Send only <strong>USDC</strong> on <strong>Ethereum</strong>. Other assets or networks are lost.</li></ul>`);
        break;
      case 'multichainWithdrawModal':
        value('multichainWithdrawTo', address);
        value('multichainWithdrawAmount', '25');
        html('multichainWithdrawToken', token('USDC'));
        html('multichainWithdrawOutToken', token('USDC'));
        text('multichainWithdrawAvailable', '125 USDC available');
        text('multichainWithdrawOut', '24');
        find('multichainWithdrawOut').classList.remove('is-empty');
        text('multichainWithdrawOutUsd', '$24.00');
        text('multichainWithdrawOutChain', 'On Ethereum');
        text('multichainWithdrawFee', 'Estimated fee: 1 USDC');
        find('multichainWithdrawPreview').disabled = false;
        break;
      case 'multichainSwapModal':
        value('multichainSwapAmount', '25');
        html('multichainSwapFrom', token('USDC'));
        html('multichainSwapTo', token('SOL'));
        text('multichainSwapAvailable', '125 USDC available');
        text('multichainSwapOut', '0.165');
        text('multichainSwapOutUsd', '$24.75');
        text('multichainSwapToChain', 'On Solana');
        text('multichainSwapFloor', 'At least 0.164 SOL');
        find('multichainSwapPreview').disabled = false;
        break;
      case 'multichainTokenPickerModal':
        html('multichainTokenResults', `<div class="multichain-section-title">You hold</div><div class="multichain-list">${assetRows()}</div>`);
        break;
      case 'multichainConfirmModal':
        text('multichainConfirmTitle', 'Review swap');
        html('multichainConfirmHero', '<div class="multichain-confirm-amount">0.164 SOL</div><div class="multichain-confirm-sub">at least, on Solana</div>');
        html('multichainConfirmRows', '<dt>You pay</dt><dd>25 USDC</dd><dt>You get at least</dt><dd class="is-guaranteed">0.164 SOL</dd><dt>Network</dt><dd>Solana</dd>');
        text('multichainConfirmAction', 'Confirm swap');
        text('multichainConfirmNote', 'The final amount may be higher.');
        break;
      case 'chatSendContactModal':
        html('chatSendContactResults', '<div class="multichain-list"><button type="button" class="multichain-row"><span class="chat-send-contact-avatar"></span><span class="multichain-row-main"><span class="multichain-row-name">Ari Rivera</span><span class="multichain-row-chain">@ari</span></span></button></div>');
        break;
      case 'chatSendModal':
        text('chatSendTitle', 'Send to Ari');
        value('chatSendAmount', '25');
        html('chatSendAsset', token('USDC'));
        text('chatSendAvailable', '125 USDC available');
        find('chatSendButton').disabled = false;
        break;
    }
    const qrTarget = root.querySelector('#qrcode, #multichainDepositQr');
    if (qrTarget) {
      const bytes = window.qr.encodeQR('Mock preview only - not a payment address', 'gif', { scale: 4 });
      const image = document.createElement('img');
      image.src = `data:image/gif;base64,${btoa(String.fromCharCode(...new Uint8Array(bytes)))}`;
      image.alt = 'Illustrative QR code, not a payment address';
      qrTarget.append(image);
    }
  };
})();
