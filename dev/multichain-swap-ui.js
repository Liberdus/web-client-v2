// Drives the live swap screen against real 1Click pricing, stopping before the
// confirm button is pressed.
import { multichain } from '../intents-ui.js';
import { intentsAssets, buildIntentsNetwork } from '../intents-assets.js';

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
const USDC = { assetId: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1', decimals: 6, blockchain: 'near', symbol: 'USDC', price: 1 };
const ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';

multichain.load();
multichain.configure({ getAccount: () => ({ keys: { address: ACCOUNT, secret: 'ab'.repeat(32) } }) });

intentsAssets.tokens = [SOL, USDC];
intentsAssets.accountId = ACCOUNT;
intentsAssets.balances = { 'nep141:sol.omft.near': '10000000' };
intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);
intentsAssets.refresh = async () => intentsAssets.network;

const swap = multichain.swapModal;
swap.open('intents:nep141:sol.omft.near');
log('title: ' + document.getElementById('multichainSwapTitle').textContent);
log('available: ' + document.getElementById('multichainSwapAvailable').textContent);
log('networks: ' + JSON.stringify([...document.getElementById('multichainSwapNetwork').options].map(o => o.textContent)));
log('assets on that network: ' + JSON.stringify([...document.getElementById('multichainSwapTo').options].map(o => o.textContent)));

document.getElementById('multichainSwapMax').click();
log('max: ' + document.getElementById('multichainSwapAmount').value);

// Pick a network then an asset, the way the placeholders require.
const net = document.getElementById('multichainSwapNetwork');
net.value = [...net.options].find(o => o.value)?.value || '';
net.dispatchEvent(new Event('change'));
const assetSel = document.getElementById('multichainSwapTo');
assetSel.value = [...assetSel.options].find(o => o.value)?.value || '';
log('chosen network: ' + net.value + ' | asset: ' + assetSel.selectedOptions[0]?.textContent);

document.getElementById('multichainSwapAmount').value = '0.005';
document.getElementById('multichainSwapPreview').click();
await new Promise((r) => setTimeout(r, 9000));

const sheet = document.getElementById('multichainConfirmModal');
log('confirm screen open: ' + sheet.classList.contains('active'));
log('\nconfirm:\n' + document.getElementById('multichainConfirmHero').innerText
  + '\n' + document.getElementById('multichainConfirmRows').innerText);
const action = document.getElementById('multichainConfirmAction');
log('action: ' + action.textContent.trim());
document.title = sheet.classList.contains('active') ? 'SWAP UI OK' : 'SWAP UI FAILED';
