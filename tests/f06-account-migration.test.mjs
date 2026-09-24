import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNT_MIGRATION_JOURNAL_KEY,
  commitAccountMigration,
  recoverAccountMigration,
} from '../account-migration.js';

const ACCOUNT_A = `alice_${'a'.repeat(64)}`;
const ACCOUNT_B = `bob_${'b'.repeat(64)}`;

class TestStorage {
  constructor(entries) {
    this.data = new Map(entries);
    this.setCount = 0;
    this.failAt = null;
    this.keepFailing = false;
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.setCount += 1;
    if (this.failAt !== null && (this.setCount === this.failAt || (this.keepFailing && this.setCount >= this.failAt))) {
      throw new Error('injected storage failure');
    }
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.data.delete(key);
  }
}

function createStorage() {
  return new TestStorage([
    [ACCOUNT_A, 'old-a'],
    [ACCOUNT_B, 'old-b'],
    ['lock', 'old-lock'],
  ]);
}

const changes = [
  { key: ACCOUNT_A, value: 'new-a' },
  { key: ACCOUNT_B, value: 'new-b' },
];

test('commits all account values before switching the lock verifier', () => {
  const storage = createStorage();
  commitAccountMigration({ storage, changes, nextLock: 'new-lock' });

  assert.equal(storage.getItem(ACCOUNT_A), 'new-a');
  assert.equal(storage.getItem(ACCOUNT_B), 'new-b');
  assert.equal(storage.getItem('lock'), 'new-lock');
  assert.equal(storage.getItem(ACCOUNT_MIGRATION_JOURNAL_KEY), null);
});

test('rolls every record back when a migration write fails', () => {
  for (const failAt of [1, 2, 3, 4]) {
    const storage = createStorage();
    storage.failAt = failAt;

    assert.throws(
      () => commitAccountMigration({ storage, changes, nextLock: 'new-lock' }),
      /injected storage failure/,
    );
    assert.equal(storage.getItem(ACCOUNT_A), 'old-a');
    assert.equal(storage.getItem(ACCOUNT_B), 'old-b');
    assert.equal(storage.getItem('lock'), 'old-lock');
    assert.equal(storage.getItem(ACCOUNT_MIGRATION_JOURNAL_KEY), null);
  }
});

test('startup recovery restores the old password generation after interruption', () => {
  const storage = createStorage();
  storage.failAt = 3;
  storage.keepFailing = true;

  assert.throws(
    () => commitAccountMigration({ storage, changes, nextLock: 'new-lock' }),
    /injected storage failure/,
  );
  assert.notEqual(storage.getItem(ACCOUNT_MIGRATION_JOURNAL_KEY), null);

  storage.failAt = null;
  storage.keepFailing = false;
  assert.equal(recoverAccountMigration(storage), true);
  assert.equal(storage.getItem(ACCOUNT_A), 'old-a');
  assert.equal(storage.getItem(ACCOUNT_B), 'old-b');
  assert.equal(storage.getItem('lock'), 'old-lock');
  assert.equal(storage.getItem(ACCOUNT_MIGRATION_JOURNAL_KEY), null);
});

test('rejects a malformed journal instead of writing attacker-selected keys', () => {
  const storage = createStorage();
  storage.data.set(ACCOUNT_MIGRATION_JOURNAL_KEY, JSON.stringify({
    version: 1,
    previousRecords: [{ key: 'unrelated-setting', value: 'changed' }],
    previousLock: { value: 'old-lock' },
  }));

  assert.throws(() => recoverAccountMigration(storage), /invalid record/);
  assert.equal(storage.getItem('unrelated-setting'), null);
});
