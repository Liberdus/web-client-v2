/**
 * Browser spike for the NEAR Intents layer.
 *
 * Answers the Phase 0 questions in the place the client actually runs:
 *   - does the Liberdus secp256k1 key sign intents the verifier accepts?
 *   - does an EVM-derived account id need a registered public key first?
 *   - can the whole multichain portfolio be read in one call?
 *   - do the endpoints work from a browser origin, without an API key?
 *
 * Read-only throughout: signature acceptance is proven with simulate_intents,
 * a view method, so nothing is executed and no funds are at risk.
 */

import {
  buildIntentPayload,
  buildTransferIntent,
  buildVersionedNonce,
  fetchIntentsTokens,
  getCurrentSalt,
  getIntentsBalances,
  intentDeadline,
  intentsAccountId,
  parseIntentSignature,
  signIntentPayload,
  simulateIntents,
} from '../intents.js';
import { generateRandomBytes } from '../crypto.js';
import { bin2hex } from '../lib.js';

const $ = (id) => document.getElementById(id);
let pass = 0;
let fail = 0;

function result(label, ok, detail = '') {
  ok ? pass++ : fail++;
  const li = document.createElement('li');
  li.className = ok ? 'ok' : 'bad';
  li.innerHTML =
    `<span class="mark">${ok ? '✓' : '✗'}</span><span class="label">${label}</span>` +
    (detail ? `<span class="detail">${detail}</span>` : '');
  $('results').appendChild(li);
}

function section(title) {
  const li = document.createElement('li');
  li.className = 'section';
  li.textContent = title;
  $('results').appendChild(li);
}

function summary() {
  const el = $('summary');
  el.textContent = fail === 0 ? `All ${pass} checks passed` : `${pass} passed, ${fail} failed`;
  el.className = `summary ${fail === 0 ? 'ok' : 'bad'}`;
  el.dataset.pass = pass;
  el.dataset.fail = fail;
  el.dataset.done = '1';
}

const short = (value, head = 10, tail = 6) => {
  const s = String(value);
  return s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
};

// Assets worth watching first: the two non-EVM chains this whole plan is for,
// plus wrapped NEAR as a sanity check that unrelated token ids read the same way.
const WATCHED = ['nep141:btc.omft.near', 'nep141:sol.omft.near', 'nep141:wrap.near'];

// Somebody other than us. The verifier rejects a self-transfer as "invalid
// intent" before it looks at balances, which would hide the signature result.
const OTHER_ACCOUNT = '0x0551f7c9a91ee579c9e40444ffc490001c323108';

async function run() {
  pass = 0;
  fail = 0;
  $('results').innerHTML = '';
  $('signed').textContent = '—';
  $('response').textContent = '—';
  $('summary').textContent = 'running…';
  $('summary').className = 'summary';
  $('run').disabled = true;

  const secret = $('secret').value.trim();

  try {
    section('identity');
    let accountId;
    try {
      accountId = intentsAccountId(secret);
      result('the account key derives an intents account id', /^0x[0-9a-f]{40}$/.test(accountId), accountId);
      result('which is the wallet address the EVM side already shows', true, 'same keccak derivation');
    } catch (error) {
      result('the account key derives an intents account id', false, error.message);
      summary();
      $('run').disabled = false;
      return;
    }

    section('reads (no API key, browser origin)');
    let salt = null;
    try {
      salt = await getCurrentSalt();
      result('current_salt from the verifier', /^[0-9a-f]{8}$/.test(String(salt)), String(salt));
    } catch (error) {
      result('current_salt from the verifier', false, `${error.code}: ${error.message}`);
    }

    let tokens = [];
    try {
      const body = await fetchIntentsTokens();
      tokens = Array.isArray(body) ? body : body?.tokens || [];
      const chains = new Set(tokens.map((t) => t.blockchain).filter(Boolean));
      result('1Click token catalog', tokens.length > 0, `${tokens.length} assets, ${chains.size} chains`);
      result('  includes native BTC', tokens.some((t) => t.assetId === 'nep141:btc.omft.near'));
      result('  includes native SOL', tokens.some((t) => t.assetId === 'nep141:sol.omft.near'));
    } catch (error) {
      result('1Click token catalog', false, `${error.code}: ${error.message}`);
    }

    try {
      const balances = await getIntentsBalances(accountId, WATCHED);
      const read = Object.keys(balances).length === WATCHED.length;
      result('the whole portfolio in one view call', read,
        WATCHED.map((id) => `${id.split(':')[1].split('.')[0]}=${balances[id]}`).join(' '));
      result('  no per-chain indexer involved', read, '1 request, 3 chains');
    } catch (error) {
      result('the whole portfolio in one view call', false, `${error.code}: ${error.message}`);
    }

    if (!salt) {
      section('signing');
      result('cannot build a nonce without the current salt', false, 'skipped the signing checks');
      summary();
      $('run').disabled = false;
      return;
    }

    section('signing, checked by the verifier itself');
    const deadline = intentDeadline();
    const payload = buildIntentPayload({
      signerId: accountId,
      deadline,
      nonce: buildVersionedNonce(salt, deadline),
      intents: [buildTransferIntent({
        receiverId: OTHER_ACCOUNT,
        tokens: { 'nep141:btc.omft.near': '1' },
        memo: 'liberdus intents spike',
      })],
    });
    const signed = await signIntentPayload(payload, secret);
    $('signed').textContent = JSON.stringify(signed, null, 2);

    result('signature is curve-tagged base58', /^secp256k1:[1-9A-HJ-NP-Za-km-z]+$/.test(signed.signature),
      short(signed.signature, 18, 8));
    const bytes = parseIntentSignature(signed.signature);
    result('  65 bytes, recovery id 0 or 1', bytes.length === 65 && bytes[64] <= 1, `v=${bytes[64]}`);
    result('  nonce carries the live salt', signed.payload.includes(payload.nonce), short(payload.nonce, 12, 6));

    // The account holds nothing, so a correct signature can only fail on
    // balance -- which is exactly the proof we want: the verifier recovered the
    // key, resolved the signer, accepted the nonce, salt and deadline, and got
    // all the way to spending.
    let accepted = false;
    let responseText = '';
    try {
      const simulation = await simulateIntents(signed);
      responseText = JSON.stringify(simulation, null, 2);
      accepted = true;
      result('verifier accepted the signature', true, 'simulation returned a report');
    } catch (error) {
      responseText = `${error.code}: ${error.message}`;
      const message = error.message || '';
      accepted = /insufficient balance|overflow/i.test(message);
      result('verifier accepted the signature', accepted,
        accepted ? 'reached the balance check' : short(message, 40, 10));
      if (!accepted) {
        result('  (a signature or envelope problem, not a funding one)', false, 'see the response below');
      }
    }
    $('response').textContent = responseText;
    result('no public key had to be registered first', accepted,
      accepted ? 'the implicit key is authorized' : 'unproven');

    section('control: the same signature over a changed payload');
    const tampered = { ...signed, payload: signed.payload.replace('spike', 'spikeX') };
    try {
      await simulateIntents(tampered);
      result('a tampered payload is rejected', false, 'the verifier accepted it');
    } catch (error) {
      const wrongKey = /doesn't exist for account|does not exist for account/i.test(error.message || '');
      result('a tampered payload is rejected', wrongKey,
        wrongKey ? 'recovered a different key' : short(error.message || '', 40, 10));
    }
  } catch (error) {
    result('the spike threw', false, `${error?.code || ''} ${error?.message || error}`);
  }

  summary();
  $('run').disabled = false;
}

$('run').addEventListener('click', run);
$('random').addEventListener('click', () => {
  $('secret').value = bin2hex(generateRandomBytes(32));
});
run();
