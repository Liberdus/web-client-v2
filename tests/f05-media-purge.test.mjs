import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canPersistDecryptedMedia,
  closeMediaCache,
  purgeDecryptedMediaCaches,
} from '../media-cache-security.js';

test('persistent decrypted media is disabled when an account lock exists', () => {
  assert.equal(canPersistDecryptedMedia({ getItem: () => null }), true);
  assert.equal(canPersistDecryptedMedia({ getItem: () => 'lock-verifier' }), false);
});

test('purge closes live databases, revokes blob URLs, and deletes every media database', async () => {
  const deleted = [];
  const revoked = [];
  let closed = 0;
  const cache = {
    db: { close: () => { closed += 1; } },
    openPromise: Promise.resolve(),
    blobUrlCache: new Map([['avatar', 'blob:avatar']]),
  };
  const indexedDb = {
    deleteDatabase(name) {
      deleted.push(name);
      const request = {};
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };

  await purgeDecryptedMediaCaches({
    indexedDb,
    caches: [cache],
    databaseNames: ['avatars', 'attachments'],
    urlApi: { revokeObjectURL: (url) => revoked.push(url) },
  });

  assert.deepEqual(deleted.sort(), ['attachments', 'avatars']);
  assert.deepEqual(revoked, ['blob:avatar']);
  assert.equal(closed, 1);
  assert.equal(cache.db, null);
  assert.equal(cache.openPromise, null);
  assert.equal(cache.blobUrlCache.size, 0);
});

test('purge rejects a blocked deletion so callers cannot report false success', async () => {
  const indexedDb = {
    deleteDatabase() {
      const request = {};
      queueMicrotask(() => request.onblocked());
      return request;
    },
  };

  await assert.rejects(
    purgeDecryptedMediaCaches({ indexedDb, databaseNames: ['attachments'] }),
    /blocked by another tab/,
  );
});

test('closeMediaCache still resets state when closing throws', () => {
  const cache = {
    db: { close: () => { throw new Error('close failed'); } },
    openPromise: Promise.resolve(),
  };

  assert.throws(() => closeMediaCache(cache), /close failed/);
  assert.equal(cache.db, null);
  assert.equal(cache.openPromise, null);
});
