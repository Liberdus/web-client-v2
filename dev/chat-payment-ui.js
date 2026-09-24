// Drives the real send screens offline -- from a chat and from the wallet --
// and checks what a hostile peer can and cannot get accepted as a payment.
//
// Nothing here reaches the network: the transfer service is stubbed before
// anything is pressed, so the paths after publishing -- receipt sent, receipt
// failed, outcome unknown -- can be exercised without moving anything. The
// title ends "OK" only if exactly the expected number of transfers went out.
import { mountMultichainScreens } from './mount-multichain.js';

await mountMultichainScreens();

const { chatPaymentPanel, usdToTokenAmount } = await import('../intents-chat-ui.js');
const { multichain } = await import('../intents-ui.js');
const { intentsAssets, buildIntentsNetwork } = await import('../intents-assets.js');
const { intentsChatPayments, parseTransferMessage, buildTransferMessage } = await import('../intents-chat.js');

const log = (m) => { document.getElementById('log').textContent += m + '\n'; };
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118.2 };
const BTC = { assetId: 'nep141:btc.omft.near', decimals: 8, blockchain: 'btc', symbol: 'BTC', price: 86693 };
const HASH = '8LKE47o44ybZQR9ozLyDnvMDTh4Ao5ipy2mJWsYByG5Q';
const PEER = '0x0551f7c9a91ee579c9e40444ffc490001c323108';
const BLOCKER = '0x1111111111111111111111111111111111111111';

const fund = (balances) => {
  intentsAssets.balances = balances;
  intentsAssets.network = buildIntentsNetwork(intentsAssets.tokens, intentsAssets.balances);
};
intentsAssets.tokens = [SOL, BTC];
intentsAssets.accountId = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
fund({ [SOL.assetId]: '10000000', [BTC.assetId]: '50000' });
intentsAssets.refresh = async () => intentsAssets.network;

const account = { keys: { address: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1', secret: 'ab'.repeat(32) } };
multichain.configure({ getAccount: () => account });
multichain.load();

let receiptFails = false;
let transfers = 0;
chatPaymentPanel.configure({
  getAccount: () => account,
  onSent: async () => { if (receiptFails) throw new Error('chat relay down'); },
  showToast: (m) => log('toast: ' + m),
  listContacts: () => [
    { address: PEER, name: 'firefox', username: 'firefox' },
    { address: BLOCKER, name: 'Dana', username: 'dana' },
  ],
  renderAvatar: () => '',
  prepareRecipient: async (address) => ({ blocked: address === BLOCKER }),
});
// Stand-ins for the network. Counting transfers is the point.
intentsChatPayments.prepare = async ({ amount }) => ({ amount, symbol: 'SOL', assetId: SOL.assetId });
intentsChatPayments.send = async () => { transfers += 1; return { intentHash: HASH, message: { type: 'intents_transfer' } }; };

const button = () => `${$('chatSendButton').textContent} (${$('chatSendButton').disabled ? 'disabled' : 'enabled'})`;
const type = (text) => { $('chatSendAmount').value = text; $('chatSendAmount').dispatchEvent(new Event('input')); };
const confirmOpen = () => $('multichainConfirmModal').classList.contains('active');
// The confirmation opens on top of the send screen; openModal waits out the
// slide-in first.
const review = async () => { $('chatSendButton').click(); await sleep(900); };
const pressConfirm = async () => { $('multichainConfirmAction').click(); await sleep(50); };

// --- dollars to token, the arithmetic on its own
const btc = intentsAssets.getAsset(`intents:${BTC.assetId}`);
log('$10 of BTC at $86,693 -> ' + usdToTokenAmount('10', btc) + ' BTC (never above $10: '
  + (Number(usdToTokenAmount('10', btc)) * 86693 <= 10) + ')');
log('$1,000 of SOL at $118.20 -> ' + usdToTokenAmount('1000', intentsAssets.getAsset(`intents:${SOL.assetId}`)));

// --- from a chat
chatPaymentPanel.load();
await chatPaymentPanel.open(PEER, 'firefox', { assetKey: `intents:${SOL.assetId}` });
log('\ntitle: ' + $('chatSendTitle').textContent + ' | chip: ' + $('chatSendAsset').textContent.trim());
log('button before an amount: ' + button());
type('0.005');
log('in SOL: ' + $('chatSendFlip').textContent + ' | ' + button());
$('chatSendFlip').click();
log('flipped to USD: $' + $('chatSendAmount').value + ' | shows ' + $('chatSendFlip').textContent);
$('chatSendFlip').click();
log('and back, untouched: ' + $('chatSendAmount').value + ' SOL (was 0.005)');
$('chatSendFlip').click();
type('0.25');
log('typed $0.25 -> ' + $('chatSendFlip').textContent);
type('5000');
log('$5000: ' + $('chatSendStatus').textContent + ' | ' + button());
type('0.25');

await review();
log('\nconfirm open: ' + confirmOpen() + ' | transfers so far ' + transfers);
log($('multichainConfirmHero').innerText.replace(/\n+/g, ' | '));
log($('multichainConfirmRows').innerText.replace(/\n/g, ' ').replace(/(Amount|Worth|Network|Arrives)/g, '| $1'));
log('action: ' + $('multichainConfirmAction').textContent);

// Receipt fails after the money moved: only the message may be retried.
receiptFails = true;
await pressConfirm();
log('\nreceipt failed -> sheet: ' + $('multichainConfirmStatus').textContent + ' | ' + $('multichainConfirmAction').textContent);
$('multichainConfirmAction').click(); // Done
await sleep(50);
log('back on the form: ' + button() + ' | amount locked ' + $('chatSendAmount').disabled);
type('9');
log('typing changes nothing: ' + button());
receiptFails = false;
$('chatSendButton').click();
await sleep(50);
log('receipt retried -> closed: ' + !chatPaymentPanel.isActive() + ' | transfers ' + transfers);

// Publishing fails with an unknown outcome: Done, never Send again.
await sleep(1100);
intentsChatPayments.send = async () => { transfers += 1; throw new Error('relay timeout'); };
await chatPaymentPanel.open(PEER, 'firefox');
type('0.005');
await review();
await pressConfirm();
log('\nunknown outcome -> sheet: ' + $('multichainConfirmAction').textContent + ' | form: ' + button());
$('multichainConfirmAction').click();
await sleep(50);
$('chatSendButton').click();
log('form Done closes: ' + !chatPaymentPanel.isActive() + ' | transfers ' + transfers);

// --- from the wallet: pick a contact, then the same screen
await sleep(1100);
intentsChatPayments.send = async () => { transfers += 1; return { intentHash: HASH, message: { type: 'intents_transfer' } }; };
chatPaymentPanel.startFromWallet(`intents:${BTC.assetId}`);
await sleep(400);
log('\nwallet picker rows: ' + [...document.querySelectorAll('#chatSendContactResults [data-address]')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()).join(' / '));
document.querySelector(`#chatSendContactResults [data-address="${BLOCKER}"]`).click();
await sleep(1100);
log('picked Dana -> ' + $('chatSendTitle').textContent + ' | asset ' + $('chatSendAsset').textContent.trim());
type('0.0001');
await review();
log('blocked contact: ' + $('chatSendStatus').textContent + ' | confirm opened ' + confirmOpen());

// Nothing held: the fix, in place.
chatPaymentPanel.close();
await sleep(400);
fund({});
await chatPaymentPanel.open(PEER, 'firefox');
log('\nempty wallet -> form hidden ' + $('chatSendForm').hidden + ', offers ' + $('chatSendReceive').textContent);

// Things a peer might try to get accepted as a payment claim.
const forged = [
  ['a script tag in the note', { note: '<img src=x onerror=alert(1)>' }],
  ['a zero amount', { amount: '0' }],
  ['a negative amount', { amount: '-5' }],
  ['a path in the intent hash', { intentHash: '../../x' }],
];
log('');
for (const [label, override] of forged) {
  const claim = parseTransferMessage(buildTransferMessage({
    assetId: SOL.assetId, symbol: 'SOL', chainName: 'Solana', amount: '0.01',
    decimals: 9, intentHash: HASH, ...override,
  }));
  log(`${label}: ${claim ? 'ACCEPTED -> ' + JSON.stringify(claim.note ?? claim.amount) : 'rejected'}`);
}
// One payment went, one whose outcome was unknown was attempted, and the
// blocked contact never reached the confirmation.
document.title = transfers === 2 ? 'CHAT UI OK' : `CHAT UI FAILED (${transfers} transfers)`;
