import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveEvmAddress,
  getEvmIdentityFromAccount,
  normalizeEvmAddress,
} from '../../evm/identity.js';

test('derives the standard EVM address for private key 1', () => {
  const privateKey = `0x${'0'.repeat(63)}1`;
  assert.equal(
    deriveEvmAddress(privateKey),
    '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
  );
});

test('normalizes EVM addresses and rejects invalid values', () => {
  assert.equal(
    normalizeEvmAddress(' 0x7E5F4552091A69125D5DFCB7B8C2659029395BDF '),
    '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
  );
  assert.throws(() => normalizeEvmAddress('0x1234'), /20-byte/);
});

test('reads and verifies the EVM identity from a Liberdus account', () => {
  const secret = `${'0'.repeat(63)}1`;
  const identity = getEvmIdentityFromAccount({
    keys: {
      address: '7e5f4552091a69125d5dfcb7b8c2659029395bdf',
      secret,
      type: 'secp256k1',
    },
  }, { verifyPrivateKey: true });

  assert.deepEqual(identity, {
    address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
    keyType: 'secp256k1',
  });
});

test('rejects an account whose private key does not match its address', () => {
  assert.throws(() => getEvmIdentityFromAccount({
    keys: {
      address: '0000000000000000000000000000000000000000',
      secret: `${'0'.repeat(63)}1`,
    },
  }, { verifyPrivateKey: true }), /does not derive/);
});
