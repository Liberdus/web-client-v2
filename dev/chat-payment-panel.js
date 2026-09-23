// Fills the real panel with plausible content so the layout can be judged.
import { chatPaymentPanel } from '../intents-chat-ui.js';
import { intentsAssets, buildIntentsNetwork } from '../intents-assets.js';

const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
const BTC = { assetId: 'nep141:btc.omft.near', decimals: 8, blockchain: 'btc', symbol: 'BTC', price: 86693 };

intentsAssets.tokens = [SOL, BTC];
intentsAssets.accountId = '0xtest';
intentsAssets.balances = { 'nep141:sol.omft.near': '5000000' };
intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);
intentsAssets.refresh = async () => intentsAssets.network;

chatPaymentPanel.configure({
  getAccount: () => ({ keys: { address: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1', secret: 'ab'.repeat(32) } }),
  onSent: async () => {},
  showToast: () => {},
});
chatPaymentPanel.load();
await chatPaymentPanel.open('0x0551f7c9a91ee579c9e40444ffc490001c323108', 'firefox');
document.getElementById('chatPaymentAmount').value = '0.001';
