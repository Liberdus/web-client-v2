import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const daoClass = source.slice(source.indexOf('class DaoModal {'), source.indexOf('const daoModal = new DaoModal();'));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const pending = [];
  const toasts = new Map();
  let nextId = 0;
  let allowOpen = true;
  const context = {
    DAO_PROPOSAL_PAGE_SIZE: 10, createEmptyDaoNotificationSummary: () => ({}),
    getCorrectedTimestamp: () => 1000, menuModal: null, footer: null,
    enterFullscreen() {}, console: { warn() {} },
    document: { querySelector: () => null },
    openModal(modal) { if (!allowOpen) return false; modal.classList.add('active'); return true; },
    showToast(message, duration, type, html, options) {
      const id = ++nextId;
      toasts.set(id, { message, duration, type, options });
      return id;
    },
    hideToast: (id) => toasts.delete(id),
    daoRepo: { refresh() { const request = deferred(); pending.push(request); return request.promise; } },
  };
  const DaoModal = vm.runInNewContext(daoClass + '\nDaoModal', context);
  const dao = new DaoModal();
  const classes = new Set();
  dao.modal = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) } };
  dao.render = () => {};
  dao.acknowledgeNotifications = () => {};
  dao.syncTrackedClaimWindows = async () => new Set();
  dao.loadSelectedFilter = async () => {};
  return { dao, pending, toasts, blockOpen: () => { allowOpen = false; } };
}

test('loading toast lasts through proposal details and clears on completion', async () => {
  const h = setup();
  const details = deferred();
  const started = deferred();
  h.dao.loadSelectedFilter = () => { started.resolve(); return details.promise; };
  const opening = h.dao._open('all');
  const toast = h.toasts.get(h.dao.loadingToastId);
  assert.equal(toast.type, 'loading');
  assert.equal(toast.duration, 0);
  assert.equal(toast.options.dedupe, false);
  h.pending[0].resolve();
  await started.promise;
  assert.equal(h.toasts.size, 1);
  details.resolve();
  await opening;
  assert.equal(h.toasts.size, 0);
});

test('failure clears loading feedback and retains the error toast', async () => {
  const h = setup();
  const opening = h.dao._open('all');
  h.pending[0].reject(new Error('offline'));
  await opening;
  assert.equal(h.dao.loadingToastId, null);
  assert.deepEqual([...h.toasts.values()].map((toast) => toast.type), ['error']);
});

for (const closeFirst of [true, false]) {
  test(`superseded opening cannot hide the current toast (close first: ${closeFirst})`, async () => {
    const h = setup();
    const first = h.dao._open('all');
    const oldId = h.dao.loadingToastId;
    if (closeFirst) {
      h.dao.close();
      assert.equal(h.toasts.size, 0);
    }
    const second = h.dao._open('completed');
    const currentId = h.dao.loadingToastId;
    assert.notEqual(currentId, oldId);
    assert.equal(h.toasts.size, 1);
    h.pending[0].resolve();
    await first;
    assert.equal(h.toasts.has(currentId), true);
    h.pending[1].resolve();
    await second;
    assert.equal(h.toasts.size, 0);
  });
}

test('rejected modal opening creates no toast or request', async () => {
  const h = setup();
  h.blockOpen();
  await h.dao._open('all');
  assert.equal(h.toasts.size, 0);
  assert.equal(h.pending.length, 0);
});
