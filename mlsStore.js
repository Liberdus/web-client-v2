/**
 * Persistent storage for MLS group state.
 *
 * WHY NOT localStorage: saveState() serializes the entire account blob on every
 * chat update. MLS state is ~6 KB per group with the X-Wing ciphersuite and
 * grows with membership, so keeping it in that blob would rewrite every group's
 * ratchet on every keystroke-adjacent save, against a ~5 MB quota.
 *
 * Two invariants this module exists to enforce:
 *
 *  1. ATOMICITY. The serialized MLS state and the cursors recording how much of
 *     the on-chain transcript has been applied must move together. If they can
 *     diverge, a crash between "applied commit" and "saved cursor" makes the
 *     client replay a commit it already merged — MLS rejects that, and the group
 *     is permanently stuck. One IndexedDB transaction per applied item.
 *
 *  2. SINGLE WRITER. Two tabs signed into the same account would each advance
 *     the same group state and fork it. Forked state produces commits at the
 *     same epoch and surfaces as random-looking decryption failures. Web Locks
 *     serialize all mutation per group, across tabs.
 */

const DB_NAME = 'liberdus-mls';
const DB_VERSION = 2;
const STORE = 'groups';
/**
 * Private halves of published KeyPackages.
 *
 * A Welcome is encrypted to the specific KeyPackage that was consumed to add
 * us, so joining requires the matching private keys. Publishing a KeyPackage
 * and then forgetting its private half makes the resulting Welcome
 * undecryptable ("No matching secret found").
 */
const KP_STORE = 'keyPackages';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(KP_STORE)) {
        db.createObjectStore(KP_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn, storeName = STORE) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        let out;
        try {
          out = fn(store);
        } catch (e) {
          t.abort();
          return reject(e);
        }
        t.oncomplete = () => resolve(out && out.__req ? out.__req.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
      }),
  );
}

const wrap = (req) => ({ __req: req });

/**
 * Records are keyed by `${address}:${groupId}` so several accounts can use the
 * same browser profile without colliding.
 */
export const recordKey = (address, groupId) => `${String(address).toLowerCase()}:${String(groupId).toLowerCase()}`;

/**
 * @typedef {Object} GroupRecord
 * @property {string} key
 * @property {string} address           owner account
 * @property {string} groupId
 * @property {Uint8Array} state         encodeGroupState(clientState)
 * @property {number} epoch
 * @property {Uint8Array} psk           current post-quantum PSK
 * @property {Uint8Array} pskId
 * @property {Uint8Array} pskNonce
 * @property {number} lastMessageTimestamp   cursor into group.messages
 * @property {number} lastHandshakeEpoch     cursor into group.handshakes
 * @property {number} memberSinceEpoch       for the "joined later" boundary
 * @property {number} updatedAt
 */

export const mlsStore = {
  get(address, groupId) {
    return tx('readonly', (s) => wrap(s.get(recordKey(address, groupId))));
  },

  /** All groups belonging to one account. */
  async listForAccount(address) {
    const all = await tx('readonly', (s) => wrap(s.getAll()));
    const owner = String(address).toLowerCase();
    return (all || []).filter((r) => r.address === owner);
  },

  /** Write state and cursors as ONE atomic unit. Never split these. */
  put(record) {
    return tx('readwrite', (s) => {
      s.put({
        ...record,
        key: recordKey(record.address, record.groupId),
        updatedAt: Date.now(),
      });
    });
  },

  delete(address, groupId) {
    return tx('readwrite', (s) => {
      s.delete(recordKey(address, groupId));
    });
  },

  /** Removes every group for one account — used when an account is removed. */
  async clearAccount(address) {
    const records = await this.listForAccount(address);
    return tx('readwrite', (s) => {
      for (const r of records) s.delete(r.key);
    });
  },

  async clearAll() {
    await tx('readwrite', (s) => {
      s.clear();
    });
    await tx(
      'readwrite',
      (s) => {
        s.clear();
      },
      KP_STORE,
    );
  },
};

/**
 * Published KeyPackages awaiting use.
 *
 * Kept until a Welcome consumes one — the private keys are the only way to
 * decrypt that Welcome, so they must outlive the publish transaction.
 */
export const keyPackageStore = {
  put(record) {
    return tx(
      'readwrite',
      (s) => {
        s.put({ ...record, storedAt: Date.now() });
      },
      KP_STORE,
    );
  },

  async listForAccount(address) {
    const all = await tx('readonly', (s) => wrap(s.getAll()), KP_STORE);
    const owner = String(address).toLowerCase();
    return (all || []).filter((r) => r.address === owner);
  },

  delete(id) {
    return tx(
      'readwrite',
      (s) => {
        s.delete(id);
      },
      KP_STORE,
    );
  },

  async clearAccount(address) {
    const records = await this.listForAccount(address);
    return tx(
      'readwrite',
      (s) => {
        for (const r of records) s.delete(r.id);
      },
      KP_STORE,
    );
  },
};

export const locksSupported = typeof navigator !== 'undefined' && !!navigator.locks;

const localChains = new Map();

/**
 * Run `fn` holding an exclusive cross-tab lock for one group.
 *
 * Falls back to an in-page promise chain where Web Locks is unavailable. That
 * still serializes within the tab but CANNOT protect against a second tab, so
 * `locksSupported` is exported for callers that want to warn.
 */
export function withGroupLock(address, groupId, fn) {
  const name = `mls-${recordKey(address, groupId)}`;
  if (locksSupported) {
    return navigator.locks.request(name, fn);
  }
  const prev = localChains.get(name) || Promise.resolve();
  const next = prev.then(fn, fn);
  localChains.set(
    name,
    next.catch(() => {}),
  );
  return next;
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('liberdus-mls') : null;

/** Tell other tabs a group advanced so they can re-read from IndexedDB. */
export function announceGroupChanged(groupId, epoch) {
  if (channel) channel.postMessage({ type: 'group-changed', groupId, epoch });
}

export function onGroupChanged(handler) {
  if (!channel) return () => {};
  const listener = (e) => {
    if (e.data && e.data.type === 'group-changed') handler(e.data);
  };
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
