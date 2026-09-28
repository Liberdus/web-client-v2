// Drives the live withdraw screen against real 1Click pricing, stopping before
// the confirm button is pressed. Dry quotes only: nothing is signed or sent.
//
// The title ends "OK" when every check below passed.
import { multichain } from '../intents-ui.js';
import { intentsAssets, buildIntentsNetwork } from '../intents-assets.js';
import { mountMultichainScreens } from './mount-multichain.js';

await mountMultichainScreens();

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const failures = [];
const check = (name, ok, detail = '') => {
  log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures.push(name);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (id) => document.getElementById(id);
const type = (input, text) => {
  input.value = text;
  input.dispatchEvent(new Event('input'));
};
// Waits out the estimate: the debounce, then a real quote.
const settleEstimate = async () => {
  for (let i = 0; i < 40; i++) {
    await wait(300);
    if ($('multichainWithdrawOut').textContent !== '…') return;
  }
};

const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
// The same symbol on a second chain, so the network question is asked.
const SOL_APTOS = { assetId: 'nep141:aptos-sol.omft.near', decimals: 8, blockchain: 'aptos', symbol: 'SOL', price: 118 };
const ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
const SOL_ADDRESS = '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj';

multichain.load();
multichain.configure({ getAccount: () => ({ keys: { address: ACCOUNT, secret: 'ab'.repeat(32) } }) });

intentsAssets.tokens = [SOL, SOL_APTOS];
intentsAssets.accountId = ACCOUNT;
intentsAssets.balances = { 'nep141:sol.omft.near': '10000000' };
intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);
intentsAssets.refresh = async () => intentsAssets.network;

multichain.withdrawModal.open('intents:nep141:sol.omft.near');
log('title: ' + $('multichainWithdrawTitle').textContent);
log('balance: ' + $('multichainWithdrawAvailable').textContent);

const chips = [...$('multichainWithdrawNetworks').querySelectorAll('[role="radio"]')];
check('the network is asked when the symbol spans chains', !$('multichainWithdrawNetworks').hidden);
check('  none is chosen for you', chips.every((chip) => chip.getAttribute('aria-checked') === 'false'));
check('  so the address waits for it', $('multichainWithdrawTo').disabled,
  $('multichainWithdrawTo').placeholder);

log('chips: ' + chips.map((chip) => chip.querySelector('span:not(.asset-mark):not(.asset-mark-label)').textContent).join(', '));
chips.find((chip) => chip.dataset.assetKey === 'intents:nep141:sol.omft.near').click();
check('choosing Solana opens the address', !$('multichainWithdrawTo').disabled,
  $('multichainWithdrawTo').placeholder);

type($('multichainWithdrawTo'), '0x0551f7c9a91ee579c9e40444ffc490001c323108');
check('an EVM address is refused before any quote',
  $('multichainWithdrawToNote').dataset.kind === 'error', $('multichainWithdrawToNote').textContent);

type($('multichainWithdrawTo'), SOL_ADDRESS);
check('a Solana address clears it', $('multichainWithdrawToNote').textContent === '');

type($('multichainWithdrawAmount'), '0.005');
await settleEstimate();
const estimate = $('multichainWithdrawOut').textContent;
check('the estimate arrives live', /^\d/.test(estimate) && Number(estimate) < 0.005,
  `${estimate} ${$('multichainWithdrawOutChain').textContent} · ${$('multichainWithdrawOutUsd').textContent}`);
check('  with the fee in SOL', /^Network fee [\d.]+ SOL/.test($('multichainWithdrawFee').textContent),
  $('multichainWithdrawFee').textContent);
check('  and Review ready', !$('multichainWithdrawPreview').disabled);

$('multichainWithdrawPreview').click();
for (let i = 0; i < 40 && !$('multichainConfirmModal').classList.contains('active'); i++) await wait(300);
const sheet = $('multichainConfirmModal');
check('Review opens the confirm screen', sheet.classList.contains('active'));
log('\nconfirm:\n' + $('multichainConfirmHero').innerText + '\n' + $('multichainConfirmRows').innerText);
check('  asking for the reviewed amount', multichain.withdrawModal.reviewed?.amount === '0.005');
multichain.confirmModal.close();

// Dollars: what is spent is still a token amount.
$('multichainWithdrawFlip').click();
type($('multichainWithdrawAmount'), '1');
await settleEstimate();
check('dollars price too', /^\d/.test($('multichainWithdrawOut').textContent),
  `$1 -> ${multichain.withdrawModal.amountField.tokenAmount()} SOL -> ${$('multichainWithdrawOut').textContent}`);
$('multichainWithdrawFlip').click();

// Under the bridge minimum: 1Click's raw figure, in SOL.
type($('multichainWithdrawAmount'), '0.0000001');
await settleEstimate();
const below = $('multichainWithdrawStatus').textContent.trim();
check('the minimum is stated in SOL', /^The smallest amount you can withdraw to Solana right now is 0\.\d{1,8} SOL\.$/.test(below), below);

document.title = failures.length ? `WITHDRAW UI FAILED (${failures.length})` : 'WITHDRAW UI OK';
