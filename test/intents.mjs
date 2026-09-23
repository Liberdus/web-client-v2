/**
 * The intents wire format, against vectors taken from the verifier contract.
 *
 * NEAR Intents has no testnet, so a wrong byte here is only discoverable on
 * mainnet with real funds. Every assertion below is therefore pinned to a value
 * published by the contract itself (https://github.com/near/intents) rather
 * than to something this client computed:
 *
 *   base58 ............ crates/crypto/src/fmt.rs doctest
 *   ERC-191 prehash ... crates/signatures/erc191 + crates/crypto secp256k1 tests
 *   signature layout .. crates/crypto/src/secp256k1.rs test vectors
 *   versioned nonce ... contracts/defuse/README.md worked example
 *
 *   node test/intents.mjs
 */
import { bin2base58, base582bin, bin2hex, hex2bin, base642bin } from '../lib.js';
import { ethHashMessage, generateAddress, getPublicKey } from '../crypto.js';
import {
  buildIntentPayload,
  buildTransferIntent,
  buildVersionedNonce,
  intentsAccountId,
  parseIntentSignature,
  signIntentPayload,
} from '../intents.js';
import { Signature, verify } from '../external/noble-secp256k1.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);

// Contract test vectors.
const VEC_PUBKEY = '85a66984273f338ce4ef7b85e5430b008307e8591bb7c1b980852cf6423770b801f41e9438155eb53a5e20f748640093bb42ae3aeca035f7b7fd7a1a21f22f68';
const VEC_MESSAGE = 'Hello world!';
const VEC_PREHASH = 'aa05af77f274774b8bdc7b61d98bc40da523dc2821fdea555f4d6aa413199bcc';
const VEC_SIGNATURE = '7800a70d05cde2c49ed546a6ce887ce6027c2c268c0285f6efef0cdfc4366b23643790f67a86468ee8301ed12cfffcb07c6530f90a9327ec057800fabd332e4701';

section('base58 (crates/crypto/src/fmt.rs)');
ck('decodes the doctest vector', bin2hex(base582bin('he11owor1d')), '04305e2b2473f058');
ck('round-trips it', bin2base58(hex2bin('04305e2b2473f058')), 'he11owor1d');
ck('leading zero bytes become leading ones', bin2base58(hex2bin('000000ff')), '1115Q');
ck('and survive the trip back', bin2hex(base582bin('1115Q')), '000000ff');
ck('empty stays empty', bin2base58(new Uint8Array()), '');
ck('rejects an out-of-alphabet character', (() => {
  try { base582bin('he11owor1dO'); return 'accepted'; } catch { return 'rejected'; }
})(), 'rejected');
{
  // A 65-byte signature is the size that actually matters here.
  const bytes = hex2bin(VEC_SIGNATURE + '01');
  ck('65-byte round trip', bin2hex(base582bin(bin2base58(bytes))), VEC_SIGNATURE + '01');
}

section('ERC-191 prehash (crates/signatures/erc191)');
// The contract's erc191 test recovers VEC_PUBKEY from VEC_MESSAGE + VEC_SIGNATURE;
// its secp256k1 test verifies the same signature and key over VEC_PREHASH. So
// the ERC-191 prehash of "Hello world!" is VEC_PREHASH.
ck('matches the contract prehash', ethHashMessage(VEC_MESSAGE), VEC_PREHASH);

section('signature layout (crates/crypto/src/secp256k1.rs)');
ck('the vector verifies over the prehash', verify(
  hex2bin(VEC_SIGNATURE.slice(0, 128)),
  hex2bin(VEC_PREHASH),
  hex2bin(`04${VEC_PUBKEY}`),
), true);
{
  // Last byte of the 65-byte form is the recovery id, 0/1 -- not 27/28.
  const recovery = Number.parseInt(VEC_SIGNATURE.slice(128, 130), 16);
  ck('recovery id is a raw 0/1 bit', recovery, 1);
  const sig = new Signature(
    BigInt(`0x${VEC_SIGNATURE.slice(0, 64)}`),
    BigInt(`0x${VEC_SIGNATURE.slice(64, 128)}`),
    recovery,
  );
  const recovered = sig.recoverPublicKey(hex2bin(VEC_PREHASH)).toRawBytes(false);
  ck('recovers the contract public key', bin2hex(recovered).slice(2), VEC_PUBKEY);
  // contracts/defuse/core/src/public_key.rs: 0x || keccak256(pk)[12..32]
  ck('derives the account id for that key', `0x${bin2hex(generateAddress(recovered))}`,
    '0x0551f7c9a91ee579c9e40444ffc490001c323108');
}

section('versioned nonce (contracts/defuse/README.md)');
{
  // Worked example: deadline 2280047743s, salt 252812b3, 15 random bytes given.
  const deadline = new Date(2280047743 * 1000).toISOString();
  const nonce = buildVersionedNonce('252812b3', deadline, hex2bin('027015ec13dc11864973138fe6812f'));
  ck('matches the documented encoding', nonce, 'Vij2xgAlKBKzADZykFdbpB8CcBXsE9wRhklzE4/mgS8=');
  ck('  magic prefix and version', bin2hex(base642bin(nonce).subarray(0, 5)), '5628f6c600');
  ck('  is 32 bytes', base642bin(nonce).length, 32);
  ck('rejects a salt that is not 4 bytes', (() => {
    try { buildVersionedNonce('2528', deadline); return 'accepted'; } catch { return 'rejected'; }
  })(), 'rejected');
  ck('rejects a deadline that is not a timestamp', (() => {
    try { buildVersionedNonce('252812b3', 'soon'); return 'accepted'; } catch { return 'rejected'; }
  })(), 'rejected');
}

section('account id derivation');
{
  // The derivation is Ethereum's, so any published keypair pins it. This is
  // account #0 of ganache's deterministic mnemonic.
  const secret = '4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  ck('matches the Ethereum address for the key', intentsAccountId(secret),
    '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1');
  ck('accepts a 0x-prefixed secret', intentsAccountId(`0x${secret}`),
    '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1');
  ck('rejects a short secret', (() => {
    try { intentsAccountId('abcd'); return 'accepted'; } catch { return 'rejected'; }
  })(), 'rejected');
}

// Node 18+ (webcrypto for the async signer).
async function main() {
section('signing a transfer intent end to end');
{
  const secret = '4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
  const signerId = intentsAccountId(secret);
  const deadline = new Date(1893456000000).toISOString();
  const payload = buildIntentPayload({
    signerId,
    deadline,
    nonce: buildVersionedNonce('252812b3', deadline, hex2bin('027015ec13dc11864973138fe6812f')),
    intents: [buildTransferIntent({
      receiverId: '0xa0ee7a142d267c1f36714e4a8f75612f20a79721',
      tokens: { 'nep141:btc.omft.near': '1000' },
      memo: 'liberdus chat payment',
    })],
  });

  ck('envelope names the verifier', payload.verifying_contract, 'intents.near');
  ck('transfer intent shape', payload.intents[0], {
    intent: 'transfer',
    receiver_id: '0xa0ee7a142d267c1f36714e4a8f75612f20a79721',
    tokens: { 'nep141:btc.omft.near': '1000' },
    memo: 'liberdus chat payment',
  });

  const signed = await signIntentPayload(payload, secret);
  ck('standard tag is erc191', signed.standard, 'erc191');
  ck('payload travels as the exact string that was hashed', signed.payload, JSON.stringify(payload));
  ck('signature is curve-tagged base58', /^secp256k1:[1-9A-HJ-NP-Za-km-z]+$/.test(signed.signature), true);

  const bytes = parseIntentSignature(signed.signature);
  ck('signature is 65 bytes', bytes.length, 65);
  ck('recovery id is 0 or 1', bytes[64] <= 1, true);

  const sig = new Signature(
    BigInt(`0x${bin2hex(bytes.subarray(0, 32))}`),
    BigInt(`0x${bin2hex(bytes.subarray(32, 64))}`),
    bytes[64],
  );
  ck('low-S, as the verifier demands', sig.hasHighS(), false);

  // This is exactly what the contract does: prehash the payload string, recover
  // the key, derive the account id, and check it against signer_id.
  const prehash = hex2bin(ethHashMessage(signed.payload));
  const recovered = sig.recoverPublicKey(prehash).toRawBytes(false);
  ck('recovers the signing key', bin2hex(recovered), bin2hex(getPublicKey(hex2bin(secret))));
  ck('recovered key resolves to signer_id', `0x${bin2hex(generateAddress(recovered))}`, signerId);

  ck('tampering with the payload breaks recovery', (() => {
    const tampered = signed.payload.replace('1000', '9000');
    const other = sig.recoverPublicKey(hex2bin(ethHashMessage(tampered))).toRawBytes(false);
    return `0x${bin2hex(generateAddress(other))}` === signerId ? 'still valid' : 'rejected';
  })(), 'rejected');
}

}

main().then(() => {
  console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, (error) => {
  console.error('\nFAIL  the suite threw:', error);
  process.exit(1);
});
