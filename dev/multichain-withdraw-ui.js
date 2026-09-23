// Drives the wired withdraw UI against the real 1Click preview, stopping short
// of publishing: the confirm button is inspected, never clicked.
import { multichain } from '../intents-ui.js';
import { intentsAssets, buildIntentsNetwork } from '../intents-assets.js';

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
const ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';

multichain.load();
multichain.configure({ getAccount: () => ({ keys: { address: ACCOUNT, secret: 'ab'.repeat(32) } }) });

intentsAssets.tokens = [SOL];
intentsAssets.accountId = ACCOUNT;
intentsAssets.balances = { 'nep141:sol.omft.near': '10000000' }; // 0.01 SOL
intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);

const modal = multichain.assetModal;
modal.open('intents:nep141:sol.omft.near');
log('withdraw button disabled with a balance? ' + modal.withdrawButton.disabled);

document.getElementById('multichainAssetWithdraw').click();
log('panel shown: ' + !document.getElementById('multichainWithdrawPanel').hidden);
log('intro: ' + document.getElementById('multichainWithdrawIntro').textContent);

document.getElementById('multichainWithdrawMax').click();
log('max filled: ' + document.getElementById('multichainWithdrawAmount').value);

// A real dry quote against 1Click.
document.getElementById('multichainWithdrawTo').value = '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj';
document.getElementById('multichainWithdrawAmount').value = '0.005';
document.getElementById('multichainWithdrawPreview').click();

await new Promise((r) => setTimeout(r, 9000));
const quote = document.getElementById('multichainWithdrawQuote');
log('\nquote panel:\n' + quote.innerText);
const confirm = document.getElementById('multichainWithdrawConfirm');
log('confirm button present: ' + !!confirm);
log('confirm label: ' + (confirm ? confirm.textContent.trim() : '-'));

// Editing a field must invalidate the quote rather than leave stale numbers.
document.getElementById('multichainWithdrawAmount').value = '0.006';
document.getElementById('multichainWithdrawAmount').dispatchEvent(new Event('input'));
log('quote cleared after edit: ' + quote.hidden);

// And a refused amount must surface 1Click's own wording.
document.getElementById('multichainWithdrawAmount').value = '0.0000001';
document.getElementById('multichainWithdrawPreview').click();
await new Promise((r) => setTimeout(r, 8000));
log('below minimum: ' + quote.innerText.trim());

document.title = confirm ? 'UI OK' : 'UI FAILED';
