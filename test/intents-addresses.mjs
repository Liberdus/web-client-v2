/**
 * Withdrawal addresses: what each chain accepts, and -- as much as anything --
 * what must never be refused.
 *
 * Base58Check vectors were built with Python's hashlib, not this module's
 * SHA-256, so the two are checked against each other. The rest are published
 * examples (BIP 173/86, EIP-55, the Bitcoin genesis address) or were answered
 * by 1Click's own validator on 2026-09-28.
 *
 *   node test/intents-addresses.mjs
 */
import { checkAddress, sha256, tagNeededBy } from '../intents-addresses.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);
const accepts = (chain, address) => ck(`${chain} accepts ${address}`, checkAddress(chain, address), null);
const refuses = (chain, address) => ck(`${chain} refuses ${address}`, typeof checkAddress(chain, address), 'string');
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

section('sha256');
ck('empty', hex(sha256(new Uint8Array())), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
ck('abc', hex(sha256(new TextEncoder().encode('abc'))),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
// Crosses a block boundary: 56 bytes forces the length into a second block.
ck('two blocks', hex(sha256(new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))),
  '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');

section('nothing typed is not a mistake');
ck('empty', checkAddress('sol', ''), '');
ck('spaces', checkAddress('sol', '   '), '');

section('EVM chains');
accepts('eth', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
accepts('bsc', '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
accepts('base', '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED');
// One letter's case flipped breaks the checksum: a typo, caught.
refuses('eth', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD');
refuses('arb', '0x5aaeb6053f3e94c9b9a09f33669435e7ef1bea');
refuses('eth', '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj');
ck('surrounding space is not the address', checkAddress('eth', '  0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed '), null);
ck('the message names the chain',
  checkAddress('bsc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'), 'That is not a BNB Chain address.');
ck('  with the right article', checkAddress('eth', 'nope'), 'That is not an Ethereum address.');

section('Solana');
accepts('sol', '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj');
accepts('sol', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
refuses('sol', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
refuses('sol', '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2');
refuses('sol', '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2u0');

section('Bitcoin');
accepts('btc', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
accepts('btc', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy');
accepts('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
accepts('btc', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4');
accepts('btc', 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0');
accepts('btc', '16L5yRNPTuciSgXGHqYwn9N6NeoKqopAu');
refuses('btc', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb');
refuses('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5');
refuses('btc', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8F3t4');
// Testnet, and a Dogecoin address: well-formed, wrong network.
refuses('btc', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx');
refuses('btc', 'D5ERdEN1gsouFSs7zsq7VYJxyWP6dP28H1');

section('other Base58Check chains');
accepts('tron', 'TA4Y62o6YC2Zsck9rZVGTvqW1AQ7X9zTnj');
refuses('tron', 'TA4Y62o6YC2Zsck9rZVGTvqW1AQ7X9zTnk');
accepts('doge', 'D5ERdEN1gsouFSs7zsq7VYJxyWP6dP28H1');
refuses('doge', '16L5yRNPTuciSgXGHqYwn9N6NeoKqopAu');
accepts('ltc', 'LKKHMBjCU89fyFNgSRprDoD8Jb25N8uWvd');
accepts('dash', 'XanAvE5GMB8CsPH78B9moJq9viEVKvCS4f');
accepts('zec', 't1Hxw6JqWMnhDK5jRCieg5bFHM2qt7UtQvu');
refuses('zec', 't1Hxw6JqWMnhDK5jRCieg5bFHM2qt7UtQvv');
// Shielded addresses have no rule here, so they are left to 1Click.
accepts('zec', 'zs1z7rejlpsa98s2rrrfkwmaxu53e4ue0ulcrw0h4x5g8jl04tak0d3mm47vdtahatqrlkngh9sly');

section('XRP');
accepts('xrp', 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
// 1Click itself says "recipient is not valid" for this one.
refuses('xrp', 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTX');
// Tagged: 1Click accepts the format, then fails every quote to it.
ck('a tag in the address is explained, not called invalid',
  checkAddress('xrp', 'XVGVKfaNy4NwBcCpMojk1twCAFwTcksPVxGMSPK7gzWkQtj'),
  'Addresses with a built-in destination tag cannot be used here. Use a plain r… address.');

section('Stellar');
accepts('stellar', 'GAOVYTDAO6DHE4ZL6CXMRAADTIDULAWD5ABCS4BPQYE5J2TKH5EKGMM3');
// 1Click prices this one: its last character is wrong.
refuses('stellar', 'GAOVYTDAO6DHE4ZL6CXMRAADTIDULAWD5ABCS4BPQYE5J2TKH5EKGMMA');
ck('muxed addresses are explained',
  checkAddress('stellar', 'MAOVYTDAO6DHE4ZL6CXMRAADTIDULAWD5ABCS4BPQYE5J2TKH5EKGAAAAAAAAAAE2JFBE'),
  'Addresses starting with M cannot be used here. Use a plain G… address.');

section('TON');
accepts('ton', 'EQAAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHx2j');
accepts('ton', '0:000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
refuses('ton', 'EQAAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHx2k');

section('NEAR');
accepts('near', 'alice.near');
accepts('near', 'relay.tg');
accepts('near', '98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de');
accepts('near', '0x8147165a17c70371a4d390c1799630c074ac6991');
refuses('near', 'Alice.near');
refuses('near', 'a');
refuses('near', 'alice..near');

section('Move chains');
accepts('sui', '0x' + 'ab'.repeat(32));
refuses('sui', '0x' + 'ab'.repeat(20));
accepts('aptos', '0x1');
refuses('aptos', '0x' + 'ab'.repeat(33));

section('chains with no rule pass through');
ck('cardano', checkAddress('cardano', 'addr1anything'), null);
ck('a chain nobody has heard of', checkAddress('newchain', '???'), null);

section('which chains need a tag for exchanges');
ck('xrp', tagNeededBy('xrp'), 'destination tag');
ck('stellar', tagNeededBy('stellar'), 'memo');
ck('ton', tagNeededBy('ton'), 'memo');
ck('sol', tagNeededBy('sol'), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
