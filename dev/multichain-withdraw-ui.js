// Drives the live withdraw screen against real 1Click pricing, stopping before
// the confirm button is pressed.
import { multichain } from '../intents-ui.js';
import { intentsAssets, buildIntentsNetwork } from '../intents-assets.js';
import { mountMultichainScreens } from './mount-multichain.js';

await mountMultichainScreens();

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
// The same symbol on a second chain, so the network question is asked.
const SOL_APTOS = { assetId: 'nep141:aptos-sol.omft.near', decimals: 8, blockchain: 'aptos', symbol: 'SOL', price: 118 };
const ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';

multichain.load();
multichain.configure({ getAccount: () => ({ keys: { address: ACCOUNT, secret: 'ab'.repeat(32) } }) });

intentsAssets.tokens = [SOL, SOL_APTOS];
intentsAssets.accountId = ACCOUNT;
intentsAssets.balances = { 'nep141:sol.omft.near': '10000000' };
intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);
intentsAssets.refresh = async () => intentsAssets.network;

const wd = multichain.withdrawModal;
wd.open('intents:nep141:sol.omft.near');
log('title: ' + document.getElementById('multichainWithdrawTitle').textContent);
log('available: ' + document.getElementById('multichainWithdrawAvailable').textContent);

document.getElementById('multichainWithdrawMax').click();
log('max: ' + document.getElementById('multichainWithdrawAmount').value);

document.getElementById('multichainWithdrawTo').value = '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj';
document.getElementById('multichainWithdrawAmount').value = '0.005';
const net = document.getElementById('multichainWithdrawNetworkField');
const netSel = document.getElementById('multichainWithdrawNetwork');
log('network asked when the symbol spans chains: ' + !net.hidden);
log('placeholder is what is selected: ' + JSON.stringify(netSel.options[netSel.selectedIndex].textContent));
log('options carry their mark: ' + JSON.stringify([...netSel.options].slice(1).map(o =>
  `${o.textContent}|${o.dataset.iconLabel}|${o.dataset.iconUrl ? 'logo' : 'drawn'}`)));

// Choosing is required before a quote makes sense.
netSel.value = [...netSel.options].find(o => o.textContent === 'Solana')?.value || '';
netSel.dispatchEvent(new Event('change'));

document.getElementById('multichainWithdrawPreview').click();
await new Promise((r) => setTimeout(r, 9000));
const sheet = document.getElementById('multichainConfirmModal');
log('confirm screen open: ' + sheet.classList.contains('active'));
log('\nconfirm:\n' + document.getElementById('multichainConfirmHero').innerText
  + '\n' + document.getElementById('multichainConfirmRows').innerText);
log('action: ' + document.getElementById('multichainConfirmAction').textContent.trim());
const ok = sheet.classList.contains('active');

// A refused amount must surface 1Click's own wording, on the form.
multichain.confirmModal.close();
document.getElementById('multichainWithdrawAmount').value = '0.0000001';
document.getElementById('multichainWithdrawPreview').click();
await new Promise((r) => setTimeout(r, 8000));
log('below minimum: ' + document.getElementById('multichainWithdrawStatus').textContent.trim());
document.title = ok ? 'WITHDRAW UI OK' : 'WITHDRAW UI FAILED';
