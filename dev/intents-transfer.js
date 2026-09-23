/**
 * Live transfer harness.
 *
 * Prepare and sign are local. Simulate is a view call. Publish is the only
 * action with consequences, so it is gated behind an explicit confirmation and
 * kept visually separate from the rest.
 */

import { IntentsTransferService } from '../intents-transfer.js';
import { normalizeIntentsToken } from '../intents-assets.js';
import { fetchIntentsTokens, getIntentsBalances, intentsAccountId } from '../intents.js';

const $ = (id) => document.getElementById(id);

let tokens = [];
let prepared = null;
let signed = null;

const service = new IntentsTransferService({
  getAccount: () => {
    try {
      return { keys: { address: intentsAccountId($('secret').value.trim()) } };
    } catch {
      return null;
    }
  },
});

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
}

function selectedToken() {
  return tokens.find((token) => token.assetId === $('asset').value) || null;
}

async function loadTokens() {
  setStatus('loading tokens…');
  const body = await fetchIntentsTokens();
  tokens = (Array.isArray(body) ? body : body?.tokens || [])
    .filter((token) => token?.assetId)
    .sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));

  const select = $('asset');
  select.innerHTML = '';
  for (const token of tokens) {
    const option = document.createElement('option');
    option.value = token.assetId;
    option.textContent = `${token.symbol} · ${token.blockchain}`;
    select.appendChild(option);
  }
  select.value = 'nep141:btc.omft.near';
  setStatus(`${tokens.length} tokens`, 'ok');
}

async function prepareAndSign() {
  prepared = null;
  signed = null;
  $('simulate').disabled = true;
  $('publish').disabled = true;
  $('result').textContent = '—';

  try {
    const secret = $('secret').value.trim();
    const accountId = intentsAccountId(secret);
    $('sender').textContent = accountId;

    const token = selectedToken();
    if (!token) throw new Error('Pick an asset');

    // Read the real balance so the pre-flight check means something.
    const balances = await getIntentsBalances(accountId, [token.assetId]);
    const asset = normalizeIntentsToken(token, balances[token.assetId]);
    $('sender').textContent = `${accountId}\nholds ${asset.tokenAmount} ${asset.tokenSymbol}`;

    prepared = await service.prepare({
      asset,
      recipientAddress: $('recipient').value.trim(),
      amount: $('amount').value.trim(),
      memo: $('memo').value.trim() || null,
    });
    signed = await service.sign(prepared, secret);

    $('signed').textContent = JSON.stringify(signed, null, 2);
    $('simulate').disabled = false;
    $('publish').disabled = false;
    setStatus('signed — nothing sent', 'ok');
  } catch (error) {
    $('signed').textContent = '—';
    setStatus(error.code || 'failed', 'bad');
    $('result').textContent = error.message || String(error);
  }
}

async function simulate() {
  if (!signed) return;
  setStatus('simulating…');
  const outcome = await service.simulate(signed);
  $('result').textContent = outcome.ok
    ? `The verifier would accept this transfer.\n\n${JSON.stringify(outcome.simulation, null, 2)}`
    : `The verifier would refuse it:\n\n${outcome.reason}`;
  setStatus(outcome.ok ? 'would succeed' : 'would fail', outcome.ok ? 'ok' : 'bad');
}

async function publish() {
  if (!prepared || !signed) return;
  const confirmed = window.confirm(
    `Send ${prepared.amount} ${prepared.symbol} to ${prepared.recipientId}?\n\n`
    + 'This executes immediately and moves real funds. It cannot be undone.',
  );
  if (!confirmed) return;

  $('publish').disabled = true;
  setStatus('publishing…');
  try {
    const outcome = await service.send(prepared, $('secret').value.trim());
    $('result').textContent = JSON.stringify(outcome, null, 2);
    setStatus(outcome.settled ? 'settled' : outcome.status, outcome.settled ? 'ok' : 'bad');
  } catch (error) {
    $('result').textContent = error.message || String(error);
    setStatus(error.code || 'failed', 'bad');
  }
}

$('prepare').addEventListener('click', prepareAndSign);
$('simulate').addEventListener('click', simulate);
$('publish').addEventListener('click', publish);
loadTokens().catch((error) => setStatus(error.message, 'bad'));
