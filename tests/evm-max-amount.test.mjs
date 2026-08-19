import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateEvmMaxAmountRaw } from '../evm-assets.js';

test('native Max reserves the maximum network fee', () => {
  assert.equal(calculateEvmMaxAmountRaw(1_000_000n, 21_000n, false), 979_000n);
});

test('token Max uses the complete token balance', () => {
  assert.equal(calculateEvmMaxAmountRaw(1_000_000n, 21_000n, true), 1_000_000n);
});

test('native Max never returns a negative amount', () => {
  assert.equal(calculateEvmMaxAmountRaw(20_000n, 21_000n, false), 0n);
  assert.equal(calculateEvmMaxAmountRaw(21_000n, 21_000n, false), 0n);
});

test('Max preserves raw integer precision', () => {
  const preciseBalance = 12_345_678_901_234_567_890n;
  const preciseFee = 123_456_789_012_345n;
  assert.equal(
    calculateEvmMaxAmountRaw(preciseBalance, preciseFee, false),
    12_345_555_444_445_555_545n,
  );
});
