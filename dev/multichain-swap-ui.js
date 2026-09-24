// Drives the live swap screen against real 1Click pricing, stopping before the
// confirm button is pressed.
import { multichain } from '../intents-ui.js';
import { intentsAssets, buildIntentsNetwork } from '../intents-assets.js';
import { mountMultichainScreens } from './mount-multichain.js';

await mountMultichainScreens();

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (id) => document.getElementById(id).textContent.trim();

swap.open('intents:nep141:sol.omft.near');
log('title: ' + text('multichainSwapTitle'));
log('balance: ' + text('multichainSwapAvailable'));
log('to chip before choosing: ' + text('multichainSwapTo'));
log('review disabled before choosing: ' + document.getElementById('multichainSwapPreview').disabled);

// Choose through the real picker, the way a person does. openModal holds a
// lock until the swap screen's slide-in ends.
await sleep(1100);
document.getElementById('multichainSwapTo').click();
const search = document.getElementById('multichainTokenSearch');
search.value = 'usdc';
search.dispatchEvent(new Event('input'));
const rows = [...document.querySelectorAll('#multichainTokenResults [data-asset-key]')];
log('picker rows for "usdc": ' + JSON.stringify(rows.map((r) => r.innerText.replace(/\s+/g, ' ').trim())));
rows[0]?.click();
log('picker closed on pick: ' + !document.getElementById('multichainTokenPickerModal').classList.contains('active'));
log('to chip: ' + text('multichainSwapTo') + ' ' + text('multichainSwapToChain'));

document.getElementById('multichainSwapMax').click();
log('max: ' + document.getElementById('multichainSwapAmount').value);
const amount = document.getElementById('multichainSwapAmount');
amount.value = '0.005';
amount.dispatchEvent(new Event('input'));
await sleep(6000);
log('\nlive estimate: ' + text('multichainSwapOut') + ' (' + text('multichainSwapOutUsd') + ')');
log('floor: ' + text('multichainSwapFloor'));
const status = document.getElementById('multichainSwapStatus');
if (!status.hidden) log('status: ' + status.textContent);

document.getElementById('multichainSwapPreview').click();
await sleep(8000);

const sheet = document.getElementById('multichainConfirmModal');
log('\nconfirm screen open: ' + sheet.classList.contains('active'));
log('confirm:\n' + document.getElementById('multichainConfirmHero').innerText
  + '\n' + document.getElementById('multichainConfirmRows').innerText);
log('action: ' + text('multichainConfirmAction'));
document.title = sheet.classList.contains('active') ? 'SWAP UI OK' : 'SWAP UI FAILED';
