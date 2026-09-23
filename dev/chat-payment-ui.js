// Exercises the chat-payment panel and the bubble markup, including what a
// hostile peer can and cannot get rendered.
import { chatPaymentPanel } from '../intents-chat-ui.js';
import { intentsAssets, buildIntentsNetwork } from '../intents-assets.js';
import { parseTransferMessage, buildTransferMessage } from '../intents-chat.js';

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
const BTC = { assetId: 'nep141:btc.omft.near', decimals: 8, blockchain: 'btc', symbol: 'BTC', price: 86693 };
const HASH = '8LKE47o44ybZQR9ozLyDnvMDTh4Ao5ipy2mJWsYByG5Q';

intentsAssets.tokens = [SOL, BTC];
intentsAssets.accountId = '0xtest';
intentsAssets.balances = { 'nep141:sol.omft.near': '10000000' };
intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);
intentsAssets.refresh = async () => intentsAssets.network;

chatPaymentPanel.configure({
  getAccount: () => ({ keys: { address: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1', secret: 'ab'.repeat(32) } }),
  onSent: async () => {},
  showToast: (m) => log('toast: ' + m),
});
chatPaymentPanel.load();
await chatPaymentPanel.open('0x0551f7c9a91ee579c9e40444ffc490001c323108', 'alice');

log('panel open: ' + (document.getElementById('chatPaymentPanel').style.display === 'flex'));
log('intro: ' + document.getElementById('chatPaymentIntro').textContent);
const opts = [...document.getElementById('chatPaymentAsset').options].map(o => o.textContent);
log('assets offered (funded only): ' + JSON.stringify(opts));
document.getElementById('chatPaymentMax').click();
log('max: ' + document.getElementById('chatPaymentAmount').value);

// With nothing funded the panel must refuse rather than offer an empty asset.
intentsAssets.balances = {};
intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);
chatPaymentPanel.renderAssets();
log('empty wallet -> send disabled: ' + document.getElementById('sendChatPaymentButton').disabled);
log('empty wallet -> status: ' + document.getElementById('chatPaymentStatus').textContent);

// Bubble markup, mirroring what app.js renders.
const bubble = (claim, verified) => `
  <div class="intents-payment-message" data-verified="${verified}" data-intent-hash="${claim.intentHash}">
    <div class="intents-payment-amount">${claim.amount} ${claim.symbol}</div>
    ${claim.chainName ? `<div class="intents-payment-chain">${claim.chainName}</div>` : ''}
    ${claim.note ? `<div class="intents-payment-note">${claim.note}</div>` : ''}
    <div class="intents-payment-verified">${{settled:'Confirmed on chain',pending:'Confirming…',failed:'Not confirmed'}[verified]}</div>
  </div>`;

const good = parseTransferMessage(buildTransferMessage({
  assetId: SOL.assetId, symbol: 'SOL', chainName: 'Solana', amount: '0.01',
  decimals: 9, intentHash: HASH, note: 'for lunch',
}));
document.getElementById('bubbles').innerHTML =
  bubble(good, 'settled') + bubble(good, 'pending') + bubble(good, 'failed');
log('\ngood claim renders: ' + !!good);

// Things a peer might try.
const forged = [
  ['a script tag in the note', { note: '<img src=x onerror=alert(1)>' }],
  ['a zero amount', { amount: '0' }],
  ['a negative amount', { amount: '-5' }],
  ['a path in the intent hash', { intentHash: '../../x' }],
];
for (const [label, override] of forged) {
  const claim = parseTransferMessage(buildTransferMessage({
    assetId: SOL.assetId, symbol: 'SOL', chainName: 'Solana', amount: '0.01',
    decimals: 9, intentHash: HASH, ...override,
  }));
  log(`${label}: ${claim ? 'ACCEPTED -> ' + JSON.stringify(claim.note ?? claim.amount) : 'rejected'}`);
}
document.title = 'CHAT UI OK';
