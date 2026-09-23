/**
 * The intents portfolio: normalization, totals, and what the wallet shows.
 *
 * Pure logic only -- no network. The live half is dev/intents-portfolio.html,
 * which runs the same module against mainnet.
 *
 *   node test/intents-assets.mjs
 */
import {
  IntentsDiscoveryService,
  INTENTS_NETWORK_ID,
  buildIntentsNetwork,
  chainDisplayName,
  intentsAccountIdForAddress,
  normalizeIntentsToken,
} from '../intents-assets.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);

const BTC = { assetId: 'nep141:btc.omft.near', decimals: 8, blockchain: 'btc', symbol: 'BTC', price: 86693 };
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 119.1 };
const USDC = { assetId: 'nep141:usdc.omft.near', decimals: 6, blockchain: 'base', symbol: 'USDC', price: 1 };
const ODD = { assetId: 'nep141:odd.omft.near', decimals: 6, blockchain: 'aleo', symbol: 'ODD', price: null };

section('account id from a Liberdus address');
ck('takes a 20-byte address', intentsAccountIdForAddress('0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'),
  '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1');
ck('accepts it unprefixed', intentsAccountIdForAddress('90f8bf6a479f320ead074411a4b0e7944ea8c9c1'),
  '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1');
// Liberdus also stores addresses as 64 hex padded with 24 zeros.
ck('unpads the 64-character form', intentsAccountIdForAddress(`90f8bf6a479f320ead074411a4b0e7944ea8c9c1${'0'.repeat(24)}`),
  '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1');
ck('a 64-char address not padded with zeros is not unpadded', intentsAccountIdForAddress('a'.repeat(64)), null);
ck('rejects nonsense', intentsAccountIdForAddress('not-an-address'), null);
ck('rejects nothing at all', intentsAccountIdForAddress(null), null);

section('amount formatting');
ck('8-decimal BTC', normalizeIntentsToken(BTC, '150000000').tokenAmount, '1.5');
ck('one satoshi', normalizeIntentsToken(BTC, '1').tokenAmount, '0.00000001');
ck('zero', normalizeIntentsToken(BTC, '0').tokenAmount, '0');
ck('missing balance reads as zero', normalizeIntentsToken(BTC, undefined).tokenAmount, '0');
ck('a negative balance is clamped', normalizeIntentsToken(BTC, '-5').tokenAmount, '0');
ck('garbage is clamped', normalizeIntentsToken(BTC, 'abc').tokenAmount, '0');
ck('9-decimal SOL', normalizeIntentsToken(SOL, '1500000000').tokenAmount, '1.5');
ck('trailing zeros are trimmed', normalizeIntentsToken(USDC, '2500000').tokenAmount, '2.5');

section('asset shape');
{
  const asset = normalizeIntentsToken(BTC, '150000000');
  ck('key is namespaced by the asset id', asset.key, 'intents:nep141:btc.omft.near');
  ck('network id', asset.networkId, INTENTS_NETWORK_ID);
  ck('source marks it as intents', asset.source, 'intents');
  ck('raw amount is kept as a string', asset.rawAmount, '150000000');
  ck('usd value', asset.tokenValueUsd, String(1.5 * 86693));
  ck('price', asset.tokenPriceUsd, '86693');
  ck('name says which chain it came from', asset.tokenName, 'BTC on Bitcoin');
  ck('the asset is frozen', Object.isFrozen(asset), true);
}
ck('an unpriced asset has no usd value', normalizeIntentsToken(ODD, '1000000').tokenValueUsd, null);
ck('  but still has an amount', normalizeIntentsToken(ODD, '1000000').tokenAmount, '1');
ck('an unknown chain still gets a label', chainDisplayName('weirdchain'), 'WEIRDCHAIN');
ck('a missing chain does not crash', chainDisplayName(undefined), 'Unknown');

section('what the network shows');
{
  const tokens = [BTC, SOL, USDC, ODD];
  const empty = buildIntentsNetwork(tokens, {});
  ck('with nothing held, BTC and SOL are still listed',
    empty.assets.map((a) => a.tokenSymbol), ['BTC', 'SOL']);
  ck('  and it does not claim to be connected', empty.connected, false);
  ck('  total is zero', empty.totalValueUsd, '0');
  ck('  custody is labelled', empty.custody, 'verifier');

  const held = buildIntentsNetwork(tokens, {
    'nep141:usdc.omft.near': '2500000',
    'nep141:odd.omft.near': '1000000',
  });
  ck('a held asset appears even when it is not always-shown',
    held.assets.some((a) => a.tokenSymbol === 'USDC'), true);
  ck('  held assets sort above empty ones',
    held.assets[0].tokenSymbol, 'USDC');
  ck('  an unpriced holding still appears',
    held.assets.some((a) => a.tokenSymbol === 'ODD'), true);
  ck('  it is connected now', held.connected, true);
  ck('  total counts only what has a price', held.totalValueUsd, '2.5');

  const ranked = buildIntentsNetwork(tokens, {
    'nep141:btc.omft.near': '100000',      // 0.001 BTC = ~$86.69
    'nep141:usdc.omft.near': '2500000',    // $2.50
  });
  ck('bigger holdings sort first', ranked.assets.map((a) => a.tokenSymbol), ['BTC', 'USDC', 'SOL']);
  ck('  the network is frozen', Object.isFrozen(ranked), true);
  ck('  and so is its asset list', Object.isFrozen(ranked.assets), true);
}

section('service lifecycle');
{
  let account = null;
  const service = new IntentsDiscoveryService({ getAccount: () => account });

  ck('starts idle', service.getStatus(), 'idle');
  ck('  with an empty-but-valid network', service.getNetwork().id, INTENTS_NETWORK_ID);
  ck('  and no account', service.getAccountId(), null);

  // No account: refresh is a no-op rather than an error.
  const before = service.getStatus();
  await service.refresh();
  ck('refresh without an account changes nothing', service.getStatus(), before);

  // Pretend a fetch happened.
  account = { keys: { address: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1' } };
  service.activateAccount(intentsAccountIdForAddress(account.keys.address));
  service.tokens = [BTC, SOL];
  service.balances = { 'nep141:btc.omft.near': '150000000' };
  service.rebuildNetwork();
  ck('rebuild reflects the balances', service.getTotalUsd(), 1.5 * 86693);
  ck('  and finds an asset by key', service.getAsset('intents:nep141:btc.omft.near')?.tokenAmount, '1.5');
  ck('  an unknown key is null, not a throw', service.getAsset('intents:nope'), null);

  // Switching accounts must not show the previous account's money.
  service.activateAccount('0x0551f7c9a91ee579c9e40444ffc490001c323108');
  ck('switching accounts drops the old balances', service.getTotalUsd(), 0);
  ck('  and goes back to idle', service.getStatus(), 'idle');

  service.reset();
  ck('reset clears the account', service.getAccountId(), null);
}

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
