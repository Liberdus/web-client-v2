import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const securitySource = await readFile(new URL('../lock-security.js', import.meta.url), 'utf8');
const {
  MIN_LOCK_PASSWORD_LENGTH,
  createLockRecord,
  parseLockRecord,
  unlockLockRecord,
} = await import(`data:text/javascript;base64,${Buffer.from(securitySource).toString('base64')}`);

const password = 'correct horse battery staple';
const testIterations = 100_000;

test('equal passwords produce independent salted lock records and encryption keys', async () => {
  const first = await createLockRecord(password, { iterations: testIterations });
  const second = await createLockRecord(password, { iterations: testIterations });

  assert.notEqual(first.record, second.record);
  assert.notEqual(parseLockRecord(first.record).salt, parseLockRecord(second.record).salt);
  assert.notEqual(first.encryptionKey, second.encryptionKey);
});

test('correct passwords unlock and incorrect passwords fail', async () => {
  const created = await createLockRecord(password, { iterations: testIterations });
  const unlocked = await unlockLockRecord(created.record, password);

  assert.equal(unlocked.encryptionKey, created.encryptionKey);
  assert.equal(await unlockLockRecord(created.record, 'incorrect password'), null);
});

test('record metadata is versioned and strictly validated', async () => {
  const created = await createLockRecord(password, {
    iterations: testIterations,
    salt: Uint8Array.from({ length: 16 }, (_, index) => index),
  });
  const parsed = parseLockRecord(created.record);

  assert.deepEqual(
    { version: parsed.version, kdf: parsed.kdf, iterations: parsed.iterations },
    { version: 2, kdf: 'PBKDF2-SHA-256', iterations: testIterations }
  );
  assert.equal(parseLockRecord('{"version":2,"kdf":"PBKDF2-SHA-256","iterations":1}'), null);
  assert.equal(parseLockRecord('legacy-verifier'), null);
});

test('new locks enforce the stronger minimum password length', async () => {
  assert.equal(MIN_LOCK_PASSWORD_LENGTH, 12);
  await assert.rejects(
    createLockRecord('short', { iterations: testIterations }),
    /at least 12 characters/
  );
});

test('application keeps legacy unlock support and commits the new record after account rewriting', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const encryptCallIndex = app.indexOf('await encryptAllAccounts(oldCredentials?.encryptionKey || null, nextLock.encryptionKey)');
  const lockCommitIndex = app.indexOf("localStorage.setItem('lock', nextLock.record)");

  assert.match(app, /if \(!\/\^\[0-9a-f\]\{64\}\$\/i\.test\(storedLock \|\| ''\)\) return null/);
  assert.match(app, /const backupCredentials = await unlockStoredAccountLock\(backupData\.lock, password\)/);
  assert.ok(encryptCallIndex >= 0 && lockCommitIndex > encryptCallIndex);
  assert.match(html, /id="newPassword"[^>]+minlength="12"/);
  assert.match(html, /id="confirmNewPassword"[^>]+minlength="12"/);
});
