// All five multichain screens with realistic data, so the layout can be judged
// as a set. Markup comes from index.html at build time.
import { buildIntentsNetwork, normalizeIntentsToken } from '../intents-assets.js';
import { assetIconMarkup } from '../asset-icons.js';

const T = (id, dec, chain, sym, price) => ({ assetId: id, decimals: dec, blockchain: chain, symbol: sym, price });
const SOL = T('nep141:sol.omft.near', 9, 'sol', 'SOL', 118.2);
const BTC = T('nep141:btc.omft.near', 8, 'btc', 'BTC', 86693);
const USDC = { ...T('nep141:usdc.omft.near', 6, 'base', 'USDC', 1),
  contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' };
const ETH = T('nep141:eth.omft.near', 18, 'base', 'ETH', 2773);

const balances = {
  'nep141:sol.omft.near': '5000000',
  'nep141:usdc.omft.near': '12400000',
  'nep141:eth.omft.near': '900000000000000',
};
const network = buildIntentsNetwork([SOL, BTC, USDC, ETH], balances);
const sol = normalizeIntentsToken(SOL, balances['nep141:sol.omft.near']);
const usd = (v) => `$${Number(v).toFixed(2)}`;

const markup = document.getElementById('markup').innerHTML;
const mount = (stageId, pick) => {
  const host = document.getElementById(stageId);
  host.innerHTML = markup;
  host.querySelectorAll('.modal').forEach((m) => { m.style.display = m.id === pick ? 'flex' : 'none'; });
  return host;
};
const icon = (sym, chain, size = 40, contractAddress = null) =>
  assetIconMarkup({ symbol: sym, blockchain: chain, contractAddress }, { size });

// --- list
{
  const host = mount('stage-list', 'multichainModal');
  const held = network.assets.filter((a) => a.rawAmount !== '0');
  host.querySelector('#multichainTotalBalance').textContent = usd(network.totalValueUsd);
  host.querySelector('#multichainHeroCaption').textContent =
    `Across ${new Set(held.map((a) => a.chainName)).size} networks`;
  host.querySelector('#multichainStatus').textContent =
    'Held for you, not on each asset’s own chain. Withdraw any time.';
  host.querySelector('#multichainAssetsList').innerHTML = network.assets.map((a) => `
    <button type="button" class="multichain-row${a.rawAmount === '0' ? ' is-empty' : ''}">
      ${icon(a.tokenSymbol, a.blockchain, 40, a.contractAddress)}
      <span class="multichain-row-main">
        <span class="multichain-row-name">${a.tokenSymbol}</span>
        <span class="multichain-row-chain">${a.chainName}</span>
      </span>
      <span class="multichain-row-values">
        <span class="multichain-row-amount">${a.tokenAmount.length > 12 ? a.tokenAmount.slice(0, 9) : a.tokenAmount}</span>
        <span class="multichain-row-usd">${a.tokenValueUsd === null ? 'Unpriced' : usd(a.tokenValueUsd)}</span>
      </span>
    </button>`).join('');
}

// --- asset
{
  const host = mount('stage-asset', 'multichainAssetModal');
  host.querySelector('#multichainAssetTitle').textContent = 'SOL (Solana)';
  host.querySelector('#multichainAssetIcon').innerHTML = icon('SOL', 'sol', 64);
  host.querySelector('#multichainAssetAmount').textContent = '0.005 SOL';
  host.querySelector('#multichainAssetValue').textContent = usd(sol.tokenValueUsd);
}

// --- receive
{
  const host = mount('stage-receive', 'multichainReceiveModal');
  host.querySelector('#multichainReceiveTitle').textContent = 'Receive SOL (Solana)';
  const gif = globalThis.qr.encodeQR('12gRNH1VMbWKFQo4nMcUq83N3sWqxouU1FqFBeembtFb', 'gif', { scale: 4 });
  const b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gif)));
  host.querySelector('#multichainReceiveBody').innerHTML = `
    <div class="multichain-qr"><img src="data:image/gif;base64,${b64}" alt=""></div>
    <button type="button" class="multichain-address">
      <span class="multichain-address-value">12gRNH1VMbWKFQo4nMcUq83N3sWqxouU1FqFBeembtFb</span>
      <span class="multichain-address-copy">Copy</span>
    </button>
    <ul class="multichain-rules">
      <li>Send at least <strong>0.00125 SOL</strong>.</li>
      <li>Send only on <strong>Solana</strong>. Another chain's funds are lost.</li>
    </ul>`;
}

// --- withdraw
{
  const host = mount('stage-withdraw', 'multichainWithdrawModal');
  host.querySelector('#multichainWithdrawTitle').textContent = 'Withdraw to Solana';
  host.querySelector('#multichainWithdrawTo').value = '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj';
  host.querySelector('#multichainWithdrawAmount').value = '0.005';
  host.querySelector('#multichainWithdrawAvailable').textContent = 'Available 0.005 SOL';

}

// --- swap
{
  const host = mount('stage-swap', 'multichainSwapModal');
  host.querySelector('#multichainSwapTitle').textContent = 'Swap SOL';
  host.querySelector('#multichainSwapNetwork').innerHTML =
    '<option value="" disabled selected>Choose a network</option><option>Base</option>';
  host.querySelector('#multichainSwapTo').innerHTML =
    '<option value="" disabled selected>Choose a network first</option>';
  host.querySelector('#multichainSwapAmount').value = '0.005';
  host.querySelector('#multichainSwapAvailable').textContent = 'Available 0.005 SOL';

}


// --- confirm, using the long ETH balance that exposed the precision problems
{
  const host = mount('stage-confirm', 'multichainConfirmModal');
  host.querySelector('#multichainConfirmTitle').textContent = 'Confirm withdrawal';
  host.querySelector('#multichainConfirmHero').innerHTML = `
    ${icon('ETH', 'base', 56)}
    <div class="multichain-confirm-amount">0.0000845 ETH</div>
    <div class="multichain-confirm-sub">estimated, arriving on Base</div>`;
  host.querySelector('#multichainConfirmRows').innerHTML = `
    <dt>You send</dt><dd>0.0000851 ETH</dd>
    <dt>Network fee</dt><dd>0.00000056 ETH</dd>
    <dt>You receive</dt><dd>0.0000845 ETH</dd>
    <dt>To</dt><dd>0xC5CD2Abfe…2Cf5d2</dd>
    <dt>Arrives in about</dt><dd>12s</dd>`;
  host.querySelector('#multichainConfirmAction').textContent = 'Withdraw ETH';
  host.querySelector('#multichainConfirmNote').textContent = 'This cannot be undone.';
}
