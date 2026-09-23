/**
 * Renders the intents portfolio for any address, using the real
 * IntentsDiscoveryService -- the same object the wallet will hold.
 *
 * Read-only: one token-catalog fetch and one balance view call per refresh.
 */

import { IntentsDiscoveryService, intentsAccountIdForAddress } from '../intents-assets.js';

const $ = (id) => document.getElementById(id);

// The service reads an account the way app.js supplies one.
let address = '';
const service = new IntentsDiscoveryService({
  getAccount: () => (address ? { keys: { address } } : null),
});

const usd = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};

function setStatus(status) {
  const el = $('status');
  el.textContent = status;
  el.className = `status ${status === 'connected' ? 'ok' : status === 'unavailable' ? 'bad' : ''}`;
  el.dataset.status = status;
}

function render() {
  const network = service.getNetwork();
  const list = $('assets');
  list.innerHTML = '';

  for (const asset of network.assets) {
    const li = document.createElement('li');
    if (asset.rawAmount === '0') li.className = 'empty';
    li.innerHTML =
      `<div><div class="sym">${asset.tokenSymbol}</div>` +
      `<div class="chain">${asset.chainName}</div></div>` +
      '<div class="grow"></div>' +
      `<div><div class="amt">${asset.tokenAmount}</div>` +
      `<div class="usd">${asset.tokenValueUsd === null ? 'unpriced' : usd(asset.tokenValueUsd)}</div></div>`;
    list.appendChild(li);
  }

  $('total').textContent = usd(network.totalValueUsd);
  $('meta').textContent = [
    `account ${service.getAccountId() || '—'}`,
    `${network.assets.length} rows`,
    `${network.assets.filter((a) => a.rawAmount !== '0').length} held`,
    service.getUpdatedAt() ? `updated ${new Date(service.getUpdatedAt()).toLocaleTimeString()}` : 'never updated',
  ].join(' · ');
  setStatus(service.getStatus());
}

async function refresh() {
  const input = $('address').value.trim();
  $('refresh').disabled = true;
  setStatus('loading');
  const started = Date.now();

  if (intentsAccountIdForAddress(input)) {
    // The path the wallet takes: an account, normalized to its EVM address.
    address = input;
    await service.refresh({ force: true });
  } else {
    // Dev-only escape hatch so this page can inspect a NEAR account id such as
    // intents.near. Uses the service's own methods -- the wallet path above
    // stays strict about Liberdus addresses.
    address = '';
    service.activateAccount(input);
    await service.fetchPortfolio(input);
  }

  render();
  $('meta').textContent += ` · ${Date.now() - started}ms`;
  $('refresh').disabled = false;
}

$('refresh').addEventListener('click', refresh);
$('address').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') refresh();
});
refresh();
