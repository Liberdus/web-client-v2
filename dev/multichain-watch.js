// Drives MultichainAssetModal's deposit watch without waiting on a real
// deposit: the balance is swapped underneath it and the poll must notice.
import { multichain } from '../intents-ui.js';
import { intentsAssets, normalizeIntentsToken, buildIntentsNetwork } from '../intents-assets.js';

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
const BTC = { assetId: 'nep141:btc.omft.near', decimals: 8, blockchain: 'btc', symbol: 'BTC', price: 86693 };

multichain.load();

// Stand in for the network: a fixed catalog whose balance we control.
let balances = { 'nep141:sol.omft.near': '0' };
intentsAssets.tokens = [SOL, BTC];
intentsAssets.accountId = '0xtest';
intentsAssets.refresh = async () => {
  intentsAssets.balances = balances;
  intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, balances);
  return intentsAssets.network;
};
await intentsAssets.refresh();

const modal = multichain.assetModal;
modal.open('intents:nep141:sol.omft.near');
log('opened with ' + document.getElementById('multichainAssetAmount').textContent);

// Skip the bridge call; start the watch directly on the current asset.
modal.startWatching(intentsAssets.getAsset('intents:nep141:sol.omft.near'));
log('watching, timer set: ' + (modal.watchTimer !== null));

// The deposit lands.
balances = { 'nep141:sol.omft.near': '10000000' };
log('balance changed underneath; waiting for the poll…');

const started = Date.now();
const done = await new Promise((resolve) => {
  const check = setInterval(() => {
    const banner = document.querySelector('.multichain-deposit-arrived');
    if (banner) { clearInterval(check); resolve(banner.textContent); }
    if (Date.now() - started > 25000) { clearInterval(check); resolve(null); }
  }, 500);
});

log(done ? 'BANNER: ' + done : 'TIMED OUT — the watch did not fire');
log('amount now: ' + document.getElementById('multichainAssetAmount').textContent);
log('timer cleared after firing: ' + (modal.watchTimer === null));
modal.close();
log('timer cleared after close: ' + (modal.watchTimer === null));
document.title = done ? 'WATCH OK' : 'WATCH FAILED';
