const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the shipped modal and network boundary without booting the unrelated app screens.
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const modalSource = source.slice(source.indexOf('class CreateAccountModal {'), source.indexOf('// Initialize the create account modal'));
const querySource = source.slice(source.indexOf('async function queryNetwork('), source.indexOf('async function getChats('));

class RegistrationFixture {
  constructor(t, respond) {
    t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100000 });
    this.storage = new Map();
    this.toasts = new Map();
    this.requests = [];
    this.signedIn = [];
    const account = { username: 'original', netid: 'testnet', keys: { address: 'a'.repeat(40), secret: 'original-secret', pqSeed: 'original-pq-seed' } };
    const state = { account, wallet: { timestamp: 1 }, pending: [] };
    const ctx = {
      Date, setTimeout, clearTimeout, AbortController, console: { error() {}, warn() {} },
      assert, parse: JSON.parse, stringify: JSON.stringify,
      network: { netid: 'testnet', name: 'Testnet' }, isOnline: true,
      getGatewayForRequest: () => ({ web: 'https://test.invalid' }),
      localStorage: {
        getItem: (key) => this.storage.get(key) ?? null,
        setItem: (key, value) => this.storage.set(key, value),
        removeItem: (key) => this.storage.delete(key),
      },
      myAccount: account, myData: state,
      loadState: (key) => JSON.parse(this.storage.get(key) ?? 'null'),
      saveState: () => this.storage.set(`${ctx.myAccount.username}_${ctx.myAccount.netid}`, JSON.stringify(ctx.myData)),
      clearMyData: () => { ctx.myData = null; ctx.myAccount = null; },
      showToast: (message, duration, kind) => { this.toasts.set(message, kind); return message; },
      hideToast: (id) => this.toasts.delete(id),
      migrateAccountsModal: { isOpening: false, isMigrating: false },
      walletScreen: { updateWalletBalances: async () => {} },
      welcomeScreen: { close() {} },
      signInModal: { open: (username) => this.signedIn.push(username) },
      longAddress: (address) => address.padEnd(64, '0'),
      hashBytes: () => 'alias-hash', utf82bin: (value) => value,
      fetch: async (url, options) => {
        this.requests.push(url);
        const body = await respond(url, options.signal);
        return { text: async () => JSON.stringify(body) };
      },
    };
    this.ctx = vm.createContext(ctx);
    vm.runInContext(`${querySource}\n${modalSource}\nglobalThis.modal = new CreateAccountModal();`, this.ctx);
    this.modal = this.ctx.modal;
    for (const name of ['backButton', 'submitButton', 'usernameInput', 'migrateAccountsButton', 'privateKeyInput', 'privateAccountCheckbox']) {
      this.modal[name] = { disabled: false, hasAttribute: () => false };
    }
    this.modal.controls = [this.modal.backButton, this.modal.submitButton, this.modal.usernameInput, this.modal.privateKeyInput];
    this.modal.advancedSummary = { setAttribute() {} };
    this.modal.advancedSection = { classList: { toggle() {} } };
    this.modal.modal = { classList: { remove() {} } };
    this.modal.registrationStatus = { hidden: true, textContent: '' };
    this.modal.usernameAvailable = { style: {} };
    this.modal.isUsernameAvailable = true;
    this.modal.pendingRegistration = { username: account.username, address: account.keys.address, txid: 'original-tx' };
    this.storage.set('pendingRegistration_testnet', JSON.stringify(this.modal.pendingRegistration));
    ctx.saveState();
    this.originalState = this.storage.get('original_testnet');
  }

  async advance(t, milliseconds) {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 1000) {
      t.mock.timers.tick(1000);
      for (let i = 0; i < 15; i++) await Promise.resolve();
    }
  }

  assertRecoverable() {
    assert.equal(this.modal.isCreatingAccount, false);
    assert.equal(this.modal.submitButton.disabled, false);
    assert.equal(this.modal.submitButton.textContent, 'Check account status');
    assert.equal(this.modal.usernameInput.disabled, true);
    assert.equal(this.modal.backButton.disabled, false);
    assert.equal(this.modal.registrationStatus.hidden, false);
    assert.equal([...this.toasts.values()].includes('loading'), false);
    assert.equal(this.storage.get('original_testnet'), this.originalState);
    assert.equal(this.ctx.myAccount.keys.secret, 'original-secret');
    assert.ok(this.storage.has('pendingRegistration_testnet'));
    assert.equal(this.storage.has('accounts'), false);
    assert.deepEqual(this.signedIn, []);
  }
}

test('a normal successful receipt completes creation and releases recovery state', async (t) => {
  const fixture = new RegistrationFixture(t, async () => ({ transaction: { success: true } }));
  const waiting = fixture.modal.confirmRegistration(false);
  assert.equal(fixture.modal.submitButton.disabled, true);
  await fixture.advance(t, 5000);
  await waiting;
  assert.deepEqual(fixture.signedIn, ['original']);
  assert.equal(fixture.storage.has('pendingRegistration_testnet'), false);
  assert.equal(fixture.modal.pendingRegistration, null);
  assert.equal(fixture.toasts.size, 0);
  assert.equal(JSON.parse(fixture.storage.get('accounts')).netids.testnet.usernames.original.address, 'a'.repeat(40));
});

test('an explicit rejection releases controls and reports the rejection', async (t) => {
  const fixture = new RegistrationFixture(t, async () => ({ transaction: { success: false, reason: 'Username taken' } }));
  const waiting = fixture.modal.confirmRegistration(false);
  await fixture.advance(t, 5000);
  await waiting;
  assert.equal(fixture.modal.submitButton.disabled, false);
  assert.equal(fixture.modal.submitButton.textContent, 'Create Account');
  assert.equal(fixture.storage.has('pendingRegistration_testnet'), false);
  assert.equal(fixture.ctx.myAccount, null);
  assert.equal(fixture.toasts.get('Account creation failed: Username taken'), 'error');
});

for (const [label, response] of [
  ['null receipt', { transaction: null }],
  ['empty receipt', { transaction: {} }],
  ['null response', null],
  ['missing receipt', {}],
  ['malformed receipt', { transaction: { success: 'true' } }],
]) {
  test(`${label} leaves a bounded, recoverable state with the original identity`, async (t) => {
    const fixture = new RegistrationFixture(t, async () => response);
    const waiting = fixture.modal.confirmRegistration(false);
    await fixture.advance(t, 35000);
    await waiting;
    fixture.assertRecoverable();
    assert.ok(fixture.requests.some((url) => url.includes('/transaction/original-tx')));
    assert.ok(fixture.requests.some((url) => url.includes('/collector/api/transaction?appReceiptId=original-tx')));
    const count = fixture.requests.length;
    await fixture.advance(t, 30000);
    assert.equal(fixture.requests.length, count, 'no orphaned background polling');
  });
}

test('failed receipt requests cannot orphan the registration wait', async (t) => {
  const fixture = new RegistrationFixture(t, async () => { throw new TypeError('Failed to fetch'); });
  const waiting = fixture.modal.confirmRegistration(false);
  await fixture.advance(t, 35000);
  await waiting;
  fixture.assertRecoverable();
});

test('stalled requests are aborted and cannot hold creation or recovery indefinitely', async (t) => {
  const signals = [];
  const fixture = new RegistrationFixture(t, async (url, signal) => {
    signals.push(signal);
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    }));
  });
  const waiting = fixture.modal.confirmRegistration(false);
  await fixture.advance(t, 35000);
  await waiting;
  fixture.assertRecoverable();
  const recovery = fixture.modal.handleSubmit({ preventDefault() {} });
  await fixture.advance(t, 20000);
  await recovery;
  fixture.assertRecoverable();
  assert.ok(signals.every((signal) => signal.aborted));
});

test('reload and late receipt success recover the same account without another injection', async (t) => {
  let confirmed = false;
  const fixture = new RegistrationFixture(t, async (url) => {
    assert.ok(!url.endsWith('/inject'));
    return { transaction: confirmed ? { success: true } : null };
  });
  const waiting = fixture.modal.confirmRegistration(false);
  await fixture.advance(t, 35000);
  await waiting;
  fixture.assertRecoverable();
  fixture.ctx.myData = null;
  fixture.ctx.myAccount = null;
  fixture.modal.pendingRegistration = null;
  assert.equal(fixture.modal.restoreRegistration(), true);
  assert.equal(fixture.ctx.myAccount.keys.secret, 'original-secret');
  confirmed = true;
  await fixture.modal.handleSubmit({ preventDefault() {} });
  assert.deepEqual(fixture.signedIn, ['original']);
  assert.equal(fixture.ctx.myAccount.keys.pqSeed, 'original-pq-seed');
  assert.equal(fixture.storage.has('pendingRegistration_testnet'), false);
});

test('matching username address recovers an account whose receipt remains unavailable', async (t) => {
  const fixture = new RegistrationFixture(t, async (url) => url.includes('/address/')
    ? { address: 'a'.repeat(40).padEnd(64, '0') }
    : { transaction: null });
  await fixture.modal.handleSubmit({ preventDefault() {} });
  assert.deepEqual(fixture.signedIn, ['original']);
  assert.equal(fixture.ctx.myAccount.keys.secret, 'original-secret');
});

test('missing or conflicting username lookup cannot confirm or resubmit registration', async (t) => {
  let conflicting = false;
  const fixture = new RegistrationFixture(t, async (url) => url.includes('/address/')
    ? (conflicting ? { address: 'b'.repeat(64) } : { error: 'No account' })
    : { transaction: null });
  await fixture.modal.handleSubmit({ preventDefault() {} });
  fixture.assertRecoverable();
  conflicting = true;
  await fixture.modal.handleSubmit({ preventDefault() {} });
  fixture.assertRecoverable();
  assert.equal(fixture.requests.length, 4);
});


test('private-account status is preserved when recovery is restored', (t) => {
  const fixture = new RegistrationFixture(t, async () => ({ transaction: null }));
  fixture.ctx.myAccount.private = true;
  fixture.ctx.saveState();
  fixture.ctx.myData = null;
  fixture.ctx.myAccount = null;
  fixture.modal.restoreRegistration();
  assert.equal(fixture.ctx.myAccount.private, true);
  assert.equal(fixture.modal.privateAccountCheckbox.checked, true);
});

test('intentionally removing a pending account does not leave account creation blocked', (t) => {
  const fixture = new RegistrationFixture(t, async () => ({ transaction: null }));
  fixture.storage.delete('original_testnet');
  assert.equal(fixture.modal.restoreRegistration(), false);
  assert.equal(fixture.storage.has('pendingRegistration_testnet'), false);
  assert.equal(fixture.modal.pendingRegistration, null);
  assert.equal(fixture.modal.submitButton.textContent, 'Create Account');
  fixture.modal.pendingRegistration = { username: 'stale', txid: 'stale-tx' };
  assert.equal(fixture.modal.restoreRegistration(), false);
  assert.equal(fixture.modal.pendingRegistration, null);
});

test('pending-only identities on every network follow password set, change, and removal', async (t) => {
  const fixture = new RegistrationFixture(t, async () => ({ transaction: null }));
  const storage = Object.fromEntries(fixture.storage);
  storage.pendingRegistration_othernet = JSON.stringify({ username: 'other', txid: 'other-tx' });
  storage.other_othernet = JSON.stringify({ account: { keys: { secret: 'other-secret' } } });
  Object.defineProperties(storage, {
    getItem: { value: (key) => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = value; } },
    removeItem: { value: (key) => { delete storage[key]; } },
  });
  fixture.ctx.localStorage = storage;
  fixture.ctx.lockModal = { encKey: null };
  fixture.ctx.passwordToKey = async (password) => `key:${password}`;
  // Test record traversal and restoration, leaving cryptography to the existing encryption implementation.
  fixture.ctx.encryptData = (data, key) => JSON.stringify({ encryptedWith: key, data });
  fixture.ctx.decryptData = (ciphertext, key) => {
    const encrypted = JSON.parse(ciphertext);
    assert.equal(encrypted.encryptedWith, key);
    return encrypted.data;
  };
  const storageSource = source.slice(source.indexOf('async function encryptAllAccounts('), source.indexOf('function checkFirstTimeTip('));
  vm.runInContext(storageSource, fixture.ctx);
  for (const [oldPassword, newPassword] of [['', 'first'], ['first', 'second'], ['second', '']]) {
    await fixture.ctx.encryptAllAccounts(oldPassword, newPassword);
    if (newPassword) {
      storage.lock = 'locked';
      fixture.ctx.lockModal.encKey = await fixture.ctx.passwordToKey(`${newPassword}liberdusData`);
      assert.equal(JSON.parse(storage.original_testnet).encryptedWith, fixture.ctx.lockModal.encKey);
      assert.equal(JSON.parse(storage.other_othernet).encryptedWith, fixture.ctx.lockModal.encKey);
    } else {
      delete storage.lock;
      fixture.ctx.lockModal.encKey = null;
    }
    fixture.ctx.myData = null;
    fixture.ctx.myAccount = null;
    assert.equal(fixture.modal.restoreRegistration(), true);
    assert.equal(fixture.ctx.myAccount.keys.secret, 'original-secret');
    assert.equal(fixture.ctx.loadState('other_othernet').account.keys.secret, 'other-secret');
    assert.equal(storage.accounts, undefined, 'unknown registration must not become sign-in eligible');
  }
});


test('wallet refresh failure after confirmation cannot discard the registered identity', async (t) => {
  const fixture = new RegistrationFixture(t, async () => ({ transaction: { success: true } }));
  fixture.ctx.walletScreen.updateWalletBalances = async () => { throw new Error('Wallet request failed'); };
  await fixture.modal.confirmRegistration(true);
  assert.deepEqual(fixture.signedIn, ['original']);
  assert.equal(fixture.ctx.myAccount.keys.secret, 'original-secret');
  assert.equal(fixture.storage.has('pendingRegistration_testnet'), false);
  assert.equal(fixture.toasts.size, 0);
});


test('a replaced saved identity cannot be confirmed using the original transaction', (t) => {
  const fixture = new RegistrationFixture(t, async () => ({ transaction: { success: true } }));
  fixture.ctx.myAccount.keys.address = 'b'.repeat(40);
  fixture.ctx.saveState();
  assert.throws(() => fixture.modal.restoreRegistration(), /Pending registration identity is missing/);
  assert.equal(fixture.storage.has('accounts'), false);
  assert.ok(fixture.storage.has('pendingRegistration_testnet'));
});
