/**
 * Live deposit flow: pick an asset, get the address, see what must be said
 * alongside it, and watch for the deposit landing.
 *
 * Uses the real IntentsDepositService. The QR comes from the vendored qr.js,
 * loaded as a global by the page the same way index.html loads it.
 */

import { IntentsDepositService, bridgeChainDisplayName, depositUri } from '../intents-deposits.js';
import { intentsAccountIdForAddress } from '../intents-assets.js';

const $ = (id) => document.getElementById(id);
const service = new IntentsDepositService();

let current = null;

function setStatus(id, text, kind = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `status ${kind}`;
}

function showError(message) {
  const el = $('error');
  el.hidden = !message;
  el.textContent = message || '';
}

function renderQr(text) {
  const container = $('qr');
  container.innerHTML = '';
  try {
    const gifBytes = globalThis.qr.encodeQR(text, 'gif', { scale: 4 });
    const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(gifBytes)));
    const img = document.createElement('img');
    img.src = `data:image/gif;base64,${base64}`;
    img.width = 200;
    img.height = 200;
    img.alt = 'Deposit address QR code';
    container.appendChild(img);
  } catch (error) {
    console.error('Failed to render deposit QR:', error);
    container.textContent = 'QR unavailable';
  }
}

function renderTarget(target) {
  // A memo chain must encode address and memo together or the QR is a trap:
  // scanning it would send funds with no memo, which are not credited.
  const uri = target.memo ? null : depositUri(target.chain, target.address);
  renderQr(uri || target.address);
  $('addr').textContent = target.address;

  const rules = [];
  if (target.memo) {
    rules.push(`Include the memo <code>${target.memo}</code>. Without it the deposit is not credited.`);
  }
  rules.push(`Send at least <strong>${target.minDeposit} ${target.assetName}</strong>. Less than that is not credited.`);
  rules.push(`Send only on <strong>${target.chainName}</strong>. Another chain's funds are lost.`);
  if (target.siblings > 0) {
    rules.push(`This chain carries ${target.siblings + 1} ${target.assetName} token ids; which one a deposit credits is the bridge's choice, so confirm the balance after the first deposit.`);
  }
  $('rules').innerHTML = `<strong>Before sending</strong><ul>${rules.map((r) => `<li>${r}</li>`).join('')}</ul>`;

  const rows = [
    ['Asset', `${target.assetName}`],
    ['Chain', `${target.chain}`],
    ['Minimum deposit', `${target.minDeposit} ${target.assetName}`],
    ['Minimum withdrawal', `${target.minWithdrawal} ${target.assetName}`],
    ['Withdrawal fee', `${target.withdrawalFee} ${target.assetName}`],
    ['Payment URI', uri || 'none for this chain'],
  ];
  if (target.memo) rows.splice(2, 0, ['Memo', target.memo]);
  $('rows').innerHTML = rows
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join('');

  $('target').hidden = false;
}

async function loadAssets() {
  setStatus('status', 'loading tokens…');
  try {
    const tokens = await service.loadBridgeTokens();
    const select = $('asset');
    select.innerHTML = '';
    // One option per token id, labelled by asset and chain, sorted so the two
    // chains this route exists for are easy to find.
    const options = tokens
      .map((token) => ({
        value: token.intents_token_id,
        chain: token.defuse_asset_identifier.split(':').slice(0, 2).join(':'),
        name: token.asset_name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.chain.localeCompare(b.chain));
    for (const option of options) {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = `${option.name} · ${bridgeChainDisplayName(option.chain)}`;
      select.appendChild(el);
    }
    select.value = 'nep141:btc.omft.near';
    setStatus('status', `${tokens.length} tokens`, 'ok');
  } catch (error) {
    setStatus('status', 'unavailable', 'bad');
    showError(`Could not load the token list: ${error.message}`);
  }
}

async function showAddress() {
  showError('');
  const accountId = intentsAccountIdForAddress($('address').value.trim());
  if (!accountId) {
    showError('That is not a Liberdus account address.');
    return;
  }

  $('show').disabled = true;
  setStatus('status', 'requesting…');
  try {
    current = await service.requestDepositTarget(accountId, $('asset').value);
    renderTarget(current);
    setStatus('status', 'ready', 'ok');
    await pollDeposits();
  } catch (error) {
    $('target').hidden = true;
    setStatus('status', 'failed', 'bad');
    showError(error.message);
  } finally {
    $('show').disabled = false;
  }
}

async function pollDeposits() {
  if (!current) return;
  const accountId = intentsAccountIdForAddress($('address').value.trim());
  try {
    const deposits = await service.listRecentDeposits(accountId, current.chain);
    $('deposits').className = deposits.length ? '' : 'empty';
    $('deposits').textContent = deposits.length
      ? ''
      : `No deposits seen on ${current.chainName} for this account yet.`;
    if (deposits.length) {
      $('deposits').innerHTML = deposits
        .map((deposit) => `<div>${JSON.stringify(deposit)}</div>`)
        .join('');
    }
    setStatus('polled', `checked ${new Date().toLocaleTimeString()}`, 'ok');
  } catch (error) {
    setStatus('polled', 'check failed', 'bad');
    showError(`Could not read recent deposits: ${error.message}`);
  }
}

$('show').addEventListener('click', showAddress);
$('poll').addEventListener('click', pollDeposits);
loadAssets();
