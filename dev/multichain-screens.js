// Every multichain screen, one phone-width frame per state, so the layout can
// be judged as a set.
//
// Nothing here writes screen markup. Each frame mounts the modals from
// index.html (mount-multichain.js) and opens them through the real
// controller in intents-ui.js; the only fiction is the data -- the balances,
// the deposit address and the quotes. A harness that composes its own rows
// agrees with the mistake it was meant to catch.
//
// No network: balances, deposit addresses and quotes are all fixtures, so no
// stage can price or publish anything. The "after" stages press the real
// confirm button, which signs locally with a dummy key; prepare, simulate and
// execute are replaced before the press, so nothing leaves the page.

import { mountMultichainScreens } from './mount-multichain.js';

const T = (assetId, decimals, blockchain, symbol, price, extra = {}) =>
  ({ assetId, decimals, blockchain, symbol, price, ...extra });

const SOL = T('nep141:sol.omft.near', 9, 'sol', 'SOL', 118.2);
const BTC = T('nep141:btc.omft.near', 8, 'btc', 'BTC', 86693);
const USDC = T('nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near', 6, 'base', 'USDC', 1,
  { contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' });
// Eighteen decimals of balance: the value that exposed the precision problems.
const ETH = T('nep141:base.omft.near', 18, 'base', 'ETH', 2773);

// The same symbol on several chains, so the picker has rows to tell apart.
const USDC_SOL = T('nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near', 6, 'sol', 'USDC', 1,
  { contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' });
const USDT = T('nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near', 6, 'eth', 'USDT', 1,
  { contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7' });
const NEAR = T('nep141:wrap.near', 24, 'near', 'NEAR', 2.61);

// A memo chain, so the receive screen's memo path is visible somewhere.
const XLM = T('nep141:stellar.omft.near', 7, 'stellar', 'XLM', 0.27);

// The rest of what a new account is offered first.
const ETH_MAIN = T('nep141:eth.omft.near', 18, 'eth', 'ETH', 2693.8);
const XRP = T('nep141:xrp.omft.near', 6, 'xrp', 'XRP', 1.48);
const BNB = T('nep245:v2_1.omni.hot.tg:56_11111111111111111111', 18, 'bsc', 'BNB', 769.4);

const TOKENS = [SOL, BTC, USDC, ETH, USDC_SOL, USDT, NEAR, XLM, ETH_MAIN, XRP, BNB];

// What the bridge carries, in its own field names. NEAR is left out, so the
// Receive picker's filter has something to filter.
const B = (token, identifier, minimum) => ({
  intents_token_id: token.assetId,
  defuse_asset_identifier: identifier,
  asset_name: token.symbol,
  decimals: token.decimals,
  min_deposit_amount: minimum,
});
const BRIDGE_TOKENS = [
  B(SOL, 'sol:mainnet:native', '1250000'),
  B(BTC, 'btc:mainnet:native', '10000'),
  B(USDC, `eth:8453:${USDC.contractAddress}`, '1000000'),
  B(ETH, 'eth:8453:native', '400000000000000'),
  B(USDC_SOL, `sol:mainnet:${USDC_SOL.contractAddress}`, '1000000'),
  B(USDT, `eth:1:${USDT.contractAddress}`, '5000000'),
  B(XLM, 'stellar:mainnet:native', '0'),
  B(ETH_MAIN, 'eth:1:native', '100000000000'),
  B(XRP, 'xrp:mainnet:native', '2000000'),
  B(BNB, 'eth:56:native', '100000000000'),
];
const DEPOSIT_ADDRESSES = {
  'sol:mainnet': { address: '12gRNH1VMbWKFQo4nMcUq83N3sWqxouU1FqFBeembtFb', memo: null },
  'stellar:mainnet': { address: 'GBL5JNQ7P3X4Z6SHOTNVQBYTUO7AXZCB6BSX2RUPSJLVY3DAX3QEWMXT', memo: '4061789215' },
  'eth:56': { address: '0x50354ee509E2E19D5273D43c808429140D7967B9', memo: null },
};
const BALANCES = {
  [SOL.assetId]: '5000000',
  [USDC.assetId]: '12400000',
  [ETH.assetId]: '851234567890123',
};
const ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
const PEER = '0x0551f7c9a91ee579c9e40444ffc490001c323108';
const key = (token) => `intents:${token.assetId}`;
// Signs fixture payloads only; never holds anything.
const DUMMY_SECRET = 'ab'.repeat(32);

const WITHDRAW_QUOTE = Object.freeze({
  amountIn: '0.000851234567890123',
  amountOut: '0.000845634567890123',
  withdrawFee: '560000000000',
  timeEstimateSeconds: 12,
  destinationAddress: '0xC5CD2Abfe6b3b0Df1b8e2E1D0c7f2b9f1a2Cf5d2',
});

const SWAP_QUOTE = Object.freeze({
  amountIn: '0.005',
  amountOut: '0.589412',
  minAmountOut: '0.583518',
  amountOutUsd: '0.5894',
  timeEstimateSeconds: 20,
});

// openModal holds a lock until the slide-in ends; with transitions off in the
// frame, that is its 1s fallback. A screen opened on top of another waits it
// out, as a person's second tap would.
const settle = () => new Promise((resolve) => setTimeout(resolve, 1100));
const type = (input, text) => {
  input.value = text;
  input.dispatchEvent(new Event('input'));
};


/** Each stage opens one screen the way the app would reach it. */
const STAGES = [
  ['list', 'List', ({ multichain }) => multichain.assetsModal.open()],

  // A first read that never answers, so the skeleton stays to be looked at.
  ['list-loading', 'List — first load', ({ multichain, intentsAssets }) => {
    intentsAssets.status = 'idle';
    intentsAssets.refresh = () => new Promise(() => {});
    void multichain.assetsModal.open();
  }],

  // Balances already read, refreshing behind them.
  ['list-refreshing', 'List — refreshing', ({ multichain, intentsAssets }) => {
    intentsAssets.refresh = () => new Promise(() => {});
    void multichain.assetsModal.open();
  }],

  ['list-empty', 'List — a new account', ({ multichain, intentsAssets }) => {
    intentsAssets.balances = {};
    intentsAssets.rebuildNetwork();
    return multichain.assetsModal.open();
  }],

  // A new account taps a chip: straight to that coin's address.
  ['receive-from-chip', 'Receive — from a chip', async ({ multichain, intentsAssets }) => {
    intentsAssets.balances = {};
    intentsAssets.rebuildNetwork();
    await multichain.assetsModal.open();
    await settle();
    document.querySelector(`.multichain-quick-chip[data-asset-key="${key(BNB)}"]`).click();
  }],

  // ETH on Base was held once and is now spent; the switch appears.
  ['list-spent', 'List — an asset spent to zero', ({ multichain, intentsAssets, settings }) => {
    settings.heldBefore = [ETH.assetId];
    intentsAssets.balances = { [SOL.assetId]: '5000000' };
    intentsAssets.rebuildNetwork();
    return multichain.assetsModal.open();
  }],

  ['list-spent-hidden', 'List — hiding empty', ({ multichain, intentsAssets, settings }) => {
    settings.heldBefore = [ETH.assetId];
    settings.hideEmpty = true;
    intentsAssets.balances = { [SOL.assetId]: '5000000' };
    intentsAssets.rebuildNetwork();
    return multichain.assetsModal.open();
  }],

  ['list-unavailable', 'List — balances unreadable', ({ multichain, intentsAssets }) => {
    intentsAssets.tokens = [];
    intentsAssets.balances = null;
    intentsAssets.rebuildNetwork();
    intentsAssets.status = 'unavailable';
    return multichain.assetsModal.open();
  }],

  ['asset', 'Asset — with activity', ({ multichain }) => multichain.assetModal.open(key(SOL))],

  ['asset-activity-loading', 'Asset — activity loading', ({ multichain, intentsActivity }) => {
    intentsActivity.forAsset = () => new Promise(() => {});
    multichain.assetModal.open(key(SOL));
  }],

  ['asset-activity-empty', 'Asset — no activity yet', ({ multichain }) => multichain.assetModal.open(key(ETH))],

  ['asset-activity-offline', 'Asset — deposits unreachable', ({ multichain, intentsActivity }) => {
    intentsActivity.configure({ fetchDeposits: async () => { throw new Error('bridge down'); } });
    multichain.assetModal.open(key(ETH));
  }],

  ['receive-picker', 'Receive — choosing what', async ({ multichain }) => {
    multichain.assetsModal.open();
    await settle();
    document.getElementById('multichainReceiveAny').click();
  }],

  ['receive', 'Receive', ({ multichain }) => multichain.receiveModal.open(key(SOL))],

  ['receive-unheld', 'Receive — an asset not held yet', async ({ multichain }) => {
    multichain.assetsModal.open();
    await settle();
    document.getElementById('multichainReceiveAny').click();
    await settle();
    document.querySelector(`#multichainTokenResults [data-asset-key="${key(USDC_SOL)}"]`).click();
  }],

  ['receive-memo', 'Receive — a memo chain', ({ multichain }) => multichain.receiveModal.open(key(XLM))],

  ['withdraw', 'Withdraw', ({ multichain }) => {
    multichain.withdrawModal.open(key(SOL));
    document.getElementById('multichainWithdrawTo').value = '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj';
    document.getElementById('multichainWithdrawAmount').value = '0.005';
  }],

  ['swap', 'Swap — just opened', ({ multichain }) => multichain.swapModal.open(key(SOL))],

  ['picker', 'Token picker', async ({ multichain }) => {
    multichain.swapModal.open(key(SOL));
    await settle();
    document.getElementById('multichainSwapTo').click();
  }],

  ['picker-search', 'Token picker — searching', async ({ multichain }) => {
    multichain.swapModal.open(key(SOL));
    await settle();
    document.getElementById('multichainSwapTo').click();
    type(document.getElementById('multichainTokenSearch'), 'usdc');
  }],

  ['picker-none', 'Token picker — no match', async ({ multichain }) => {
    multichain.swapModal.open(key(SOL));
    await settle();
    document.getElementById('multichainSwapTo').click();
    type(document.getElementById('multichainTokenSearch'), 'dogecoin');
  }],

  // Picks through the real picker, then types: the estimate is a stubbed quote.
  ['swap-estimate', 'Swap — estimate showing', async ({ multichain, services }) => {
    services.intentsSwaps.preview = async () => SWAP_QUOTE;
    multichain.swapModal.open(key(SOL));
    await settle();
    document.getElementById('multichainSwapTo').click();
    document.querySelector(`#multichainTokenResults [data-asset-key="${key(USDC)}"]`).click();
    type(document.getElementById('multichainSwapAmount'), '0.005');
    await new Promise((resolve) => setTimeout(resolve, 600));
  }],

  // Picks, switches to dollars and types, with the estimate stubbed.
  ['swap-usd', 'Swap — typing in dollars', async ({ multichain, services }) => {
    services.intentsSwaps.preview = async ({ amount }) => ({ ...SWAP_QUOTE, amountIn: amount });
    multichain.swapModal.open(key(SOL));
    multichain.swapModal.toKey = key(USDC);
    multichain.swapModal.renderTo();
    document.getElementById('multichainSwapFlip').click();
    type(document.getElementById('multichainSwapAmount'), '0.50');
    await new Promise((resolve) => setTimeout(resolve, 600));
  }],

  ['swap-over', 'Swap — more than the balance', ({ multichain }) => {
    multichain.swapModal.open(key(SOL));
    multichain.swapModal.toKey = key(USDC);
    multichain.swapModal.renderTo();
    type(document.getElementById('multichainSwapAmount'), '1');
  }],

  ['confirm-withdraw', 'Confirm withdrawal', ({ multichain, intentsAssets }) => {
    multichain.withdrawModal.assetKey = key(ETH);
    multichain.withdrawModal.openConfirm(intentsAssets.getAsset(key(ETH)), null, WITHDRAW_QUOTE);
  }],

  ['confirm-swap', 'Confirm swap', ({ multichain, intentsAssets }) => {
    multichain.swapModal.assetKey = key(SOL);
    multichain.swapModal.openConfirm(
      intentsAssets.getAsset(key(SOL)), intentsAssets.getCatalogAsset(key(USDC)), SWAP_QUOTE,
    );
  }],

  ['chat-send', 'Send in a chat', async ({ chatSend }) => {
    await chatSend.open(PEER, 'firefox');
    type(document.getElementById('chatSendAmount'), '0.005');
  }],

  ['chat-send-note', 'Send in a chat — with a note', async ({ chatSend }) => {
    await chatSend.open(PEER, 'firefox');
    type(document.getElementById('chatSendAmount'), '0.005');
    document.getElementById('chatSendNoteToggle').click();
    document.getElementById('chatSendNote').value = 'for coffee';
  }],

  ['chat-send-usd', 'Send — typing in dollars', async ({ chatSend }) => {
    await chatSend.open(PEER, 'firefox', { assetKey: key(SOL) });
    document.getElementById('chatSendFlip').click();
    type(document.getElementById('chatSendAmount'), '10');
  }],

  ['chat-send-confirm', 'Send — confirming', async ({ chatSend }) => {
    await chatSend.open(PEER, 'firefox', { assetKey: key(USDC) });
    type(document.getElementById('chatSendAmount'), '2.5');
    document.getElementById('chatSendNoteToggle').click();
    document.getElementById('chatSendNote').value = 'for coffee';
    await settle();
    document.getElementById('chatSendButton').click();
  }],

  ['send-contact', 'Send from the wallet — choosing who', async ({ multichain }) => {
    multichain.assetModal.open(key(SOL));
    await settle();
    document.getElementById('multichainAssetSend').click();
  }],

  ['chat-send-empty', 'Send in a chat — nothing to send', async ({ chatSend, intentsAssets }) => {
    intentsAssets.balances = {};
    intentsAssets.rebuildNetwork();
    await chatSend.open(PEER, 'firefox');
  }],

  ['withdraw-sent', 'After a withdrawal', (ctx) => pressConfirm(ctx, 'withdraw', { status: 'SUCCESS' })],

  ['withdraw-unconfirmed', 'After a withdrawal whose outcome is unknown', (ctx) =>
    pressConfirm(ctx, 'withdraw', new Error('settlement check timed out'))],

  ['swap-refunded', 'After a swap the rate moved against', (ctx) =>
    pressConfirm(ctx, 'swap', { status: 'REFUNDED', refunded: true })],
];

/**
 * Reaches the confirm screen with the form behind it filled in, then presses
 * the real button. `result` is what execute resolves to, or throws.
 */
async function pressConfirm({ multichain, intentsAssets, services }, kind, result) {
  const service = kind === 'withdraw' ? services.intentsWithdrawals : services.intentsSwaps;
  service.prepare = async () => ({ payload: { fixture: true }, amountOut: WITHDRAW_QUOTE.amountOut });
  service.simulate = async () => ({ ok: true });
  service.execute = async () => {
    if (result instanceof Error) throw result;
    return result;
  };

  if (kind === 'withdraw') {
    const form = multichain.withdrawModal;
    form.assetKey = key(ETH);
    form.to.value = WITHDRAW_QUOTE.destinationAddress;
    form.amount.value = WITHDRAW_QUOTE.amountIn;
    form.openConfirm(intentsAssets.getAsset(key(ETH)), null, WITHDRAW_QUOTE);
  } else {
    const form = multichain.swapModal;
    form.assetKey = key(SOL);
    form.toKey = key(USDC);
    // What Review would have captured.
    form.reviewedAmount = SWAP_QUOTE.amountIn;
    form.openConfirm(intentsAssets.getAsset(key(SOL)), intentsAssets.getCatalogAsset(key(USDC)), SWAP_QUOTE);
  }
  await multichain.confirmModal.confirm();
}

function renderGallery() {
  document.body.className = 'gallery';
  for (const [id, label] of STAGES) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="stage-label">${label}</div>
      <iframe class="stage" id="stage-${id}" src="?screen=${id}" title="${label}"></iframe>`);
  }
}

async function renderFrame(id) {
  document.body.className = 'frame';
  const stage = STAGES.find(([name]) => name === id);
  if (!stage) throw new Error(`No stage called ${id}`);

  await mountMultichainScreens();
  // Imported after mounting: nothing in these modules touches the DOM at load,
  // but keeping the order obvious costs nothing.
  const { multichain } = await import('../intents-ui.js');
  const { intentsAssets } = await import('../intents-assets.js');
  const { intentsDeposits } = await import('../intents-deposits.js');
  const { intentsWithdrawals } = await import('../intents-withdraw.js');
  const { intentsSwaps } = await import('../intents-swap.js');
  const { chatPaymentPanel: chatSend } = await import('../intents-chat-ui.js');
  const { intentsActivity } = await import('../intents-activity.js');

  intentsAssets.tokens = TOKENS;
  intentsAssets.tokensFetchedAt = Date.now();
  intentsAssets.accountId = ACCOUNT;
  intentsAssets.balances = BALANCES;
  intentsAssets.status = 'connected';
  intentsAssets.rebuildNetwork();
  // Never reaches the network: the fixture is the whole portfolio, and a stage
  // that wants a quote supplies its own.
  intentsAssets.refresh = async () => intentsAssets.getNetwork();
  const offline = async () => { throw new Error('No pricing in this harness'); };
  intentsSwaps.preview = offline;
  intentsWithdrawals.preview = offline;
  // The real target logic over fixture bridge tokens; only the address itself,
  // which the bridge derives, is made up.
  intentsDeposits.bridgeTokens = BRIDGE_TOKENS;
  intentsDeposits.bridgeTokensFetchedAt = Date.now();
  intentsDeposits.requestDepositTarget = async (accountId, assetId) => {
    const target = intentsDeposits.describeDepositTarget(assetId);
    return Object.freeze({ ...target, ...DEPOSIT_ADDRESSES[target.chain] });
  };

  // Activity from fixtures: the deposit is the shape the bridge really
  // returns, and nothing here reaches it.
  const hour = 3_600_000;
  let orders = [
    { id: 'o1', kind: 'swap', fromAssetId: SOL.assetId, toAssetId: USDC.assetId, fromSymbol: 'SOL', toSymbol: 'USDC',
      amount: '0.003', amountOut: '0.35', time: Date.now() - 20 * 60_000, status: 'pending', depositAddress: 'dep-pending' },
    { id: 'o2', kind: 'withdraw', assetId: SOL.assetId, amount: '0.002', destinationChain: 'Solana',
      destinationAddress: '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj', time: Date.now() - 30 * hour, status: 'refunded' },
    { id: 'o3', kind: 'swap', fromAssetId: USDC.assetId, toAssetId: SOL.assetId, fromSymbol: 'USDC', toSymbol: 'SOL',
      amount: '1', amountOut: '0.0084', amountReceived: '0.008461', time: Date.now() - 50 * hour, status: 'done' },
  ];
  intentsActivity.configure({
    getOrders: () => orders,
    saveOrders: (next) => { orders = next; },
    listPayments: () => [
      { assetId: SOL.assetId, amount: '0.001', my: true, peer: 'firefox', note: 'for coffee', intentHash: 'h1', time: Date.now() - 3 * hour },
      { assetId: SOL.assetId, amount: '0.0025', my: false, peer: 'Dana Whitfield', intentHash: 'h2', time: Date.now() - 5 * hour },
    ],
    fetchDeposits: async (accountId, chain) => (chain === 'sol:mainnet' ? [{
      tx_hash: '5UhbfA3T', near_token_id: 'sol.omft.near', decimals: 9, amount: 10000000, status: 'COMPLETED',
      created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(), from: '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj',
    }] : []),
    fetchOrderStatus: async () => ({ status: 'PROCESSING' }),
    verifyClaim: async () => ({ state: 'settled' }),
  });

  // The account's saved wallet settings, in memory.
  const settings = { heldBefore: [], hideEmpty: false };
  multichain.configure({
    getAccount: () => ({ keys: { address: ACCOUNT, secret: DUMMY_SECRET } }),
    getSettings: () => settings,
    saveSettings: (next) => Object.assign(settings, next),
  });
  multichain.load();
  // No stage presses Send here; dev/chat-payment-ui.html drives that path.
  chatSend.configure({
    getAccount: () => ({ keys: { address: ACCOUNT, secret: DUMMY_SECRET } }),
    listContacts: () => [
      { address: PEER, name: 'firefox', username: 'firefox' },
      { address: '0x2222222222222222222222222222222222222222', name: 'Dana Whitfield', username: 'dana' },
      { address: '0x3333333333333333333333333333333333333333', name: 'omar', username: 'omar' },
    ],
    // A drawn initial stands in for the app's avatar renderer.
    renderAvatar: (address) => `<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#${address.slice(2, 8)}"/></svg>`,
  });
  chatSend.load();
  await stage[2]({
    multichain, intentsAssets, intentsDeposits, chatSend, intentsActivity, settings,
    services: { intentsWithdrawals, intentsSwaps },
  });
  document.body.dataset.ready = 'true';
}

const screen = new URLSearchParams(location.search).get('screen');
if (screen) {
  renderFrame(screen).catch((error) => {
    console.error(error);
    document.body.insertAdjacentHTML('beforeend',
      `<pre class="harness-error">${String(error?.stack || error).replace(/</g, '&lt;')}</pre>`);
  });
} else {
  renderGallery();
}
