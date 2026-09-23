/**
 * Live withdrawal harness.
 *
 * Preview is a dry quote and costs nothing. Prepare takes a live quote, which
 * allocates a deposit address with an expiry. Withdraw is the only step that
 * moves funds, and it is gated behind a confirmation.
 */

import { IntentsWithdrawService } from '../intents-withdraw.js';
import { normalizeIntentsToken } from '../intents-assets.js';
import { fetchIntentsTokens, getIntentsBalances, intentsAccountId } from '../intents.js';

const $ = (id) => document.getElementById(id);
const service = new IntentsWithdrawService();

let tokens = [];
let asset = null;
let prepared = null;
let signed = null;

function setStatus(text, kind = '') {
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
}

function resetDownstream() {
  prepared = null;
  signed = null;
  $('prepare').disabled = true;
  $('simulate').disabled = true;
  $('withdraw').disabled = true;
}

async function loadTokens() {
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
  select.value = 'nep141:sol.omft.near';
  setStatus(`${tokens.length} tokens`, 'ok');
}

/** The live balance, so the pre-flight check is against what is really held. */
async function loadAsset(accountId) {
  const token = tokens.find((entry) => entry.assetId === $('asset').value);
  if (!token) throw new Error('Pick an asset');
  const balances = await getIntentsBalances(accountId, [token.assetId]);
  asset = normalizeIntentsToken(token, balances[token.assetId]);
  $('account').textContent = `${accountId}\nholds ${asset.tokenAmount} ${asset.tokenSymbol}`;
  return asset;
}

async function preview() {
  resetDownstream();
  $('quote').textContent = '—';
  $('result').textContent = '—';
  setStatus('pricing…');
  try {
    const accountId = intentsAccountId($('secret').value.trim());
    await loadAsset(accountId);
    const quote = await service.preview({
      accountId,
      asset,
      destinationAddress: $('destination').value.trim(),
      amount: $('amount').value.trim(),
    });
    $('quote').textContent = JSON.stringify(quote, null, 2);
    $('prepare').disabled = false;
    setStatus('priced — nothing created', 'ok');
  } catch (error) {
    $('result').textContent = error.message || String(error);
    setStatus(error.code || 'failed', 'bad');
  }
}

async function prepare() {
  setStatus('taking a live quote…');
  try {
    const accountId = intentsAccountId($('secret').value.trim());
    prepared = await service.prepare({
      accountId,
      asset,
      destinationAddress: $('destination').value.trim(),
      amount: $('amount').value.trim(),
    });
    signed = null;
    $('quote').textContent = JSON.stringify({
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
      expires: prepared.depositDeadline,
      amountOut: prepared.amountOut,
      withdrawFee: prepared.withdrawFee,
      seconds: prepared.timeEstimateSeconds,
      fundingIntent: prepared.payload.intents[0],
    }, null, 2);
    $('simulate').disabled = false;
    $('withdraw').disabled = false;
    setStatus('quote held — not funded', 'ok');
  } catch (error) {
    $('result').textContent = error.message || String(error);
    setStatus(error.code || 'failed', 'bad');
  }
}

async function simulate() {
  if (!prepared) return;
  setStatus('simulating…');
  const { signIntentPayload } = await import('../intents.js');
  signed = await signIntentPayload(prepared.payload, $('secret').value.trim());
  const outcome = await service.simulate(signed);
  $('result').textContent = outcome.ok
    ? `The verifier would accept the funding transfer.\n\n${JSON.stringify(outcome.simulation, null, 2)}`
    : `The verifier would refuse it:\n\n${outcome.reason}`;
  setStatus(outcome.ok ? 'would succeed' : 'would fail', outcome.ok ? 'ok' : 'bad');
}

async function withdraw() {
  if (!prepared) return;
  const confirmed = window.confirm(
    `Withdraw ${prepared.amount} ${prepared.symbol} to ${prepared.destinationAddress}?\n\n`
    + `You should receive about ${prepared.amountOut} ${prepared.symbol}.\n\n`
    + 'This moves real funds onto the destination chain and cannot be undone.',
  );
  if (!confirmed) return;

  $('withdraw').disabled = true;
  setStatus('withdrawing…');
  try {
    const outcome = await service.execute(prepared, $('secret').value.trim(), {
      onStatus: (update) => {
        setStatus(update.status.toLowerCase());
        $('result').textContent = JSON.stringify(update.detail, null, 2);
      },
    });
    $('result').textContent = JSON.stringify(outcome, null, 2);
    setStatus(outcome.status === 'SUCCESS' ? 'sent' : outcome.status,
      outcome.status === 'SUCCESS' ? 'ok' : 'bad');
  } catch (error) {
    $('result').textContent = error.message || String(error);
    setStatus(error.code || 'failed', 'bad');
  }
}

$('preview').addEventListener('click', preview);
$('prepare').addEventListener('click', prepare);
$('simulate').addEventListener('click', simulate);
$('withdraw').addEventListener('click', withdraw);
$('asset').addEventListener('change', resetDownstream);
$('amount').addEventListener('input', resetDownstream);
$('destination').addEventListener('input', resetDownstream);
loadTokens().catch((error) => setStatus(error.message, 'bad'));
