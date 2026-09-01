export const FULL_IMAGE_CACHE_DB_NAME = 'liberdus_full_images';
export const FULL_IMAGE_CACHE_MAX_SIZE = 250 * 1024 * 1024;

const FULL_IMAGE_CACHE_DB_VERSION = 1;
const FULL_IMAGE_CACHE_STORE_NAME = 'images';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export class FullImageCache {
  constructor({
    dbName = FULL_IMAGE_CACHE_DB_NAME,
    maxCacheSize = FULL_IMAGE_CACHE_MAX_SIZE,
  } = {}) {
    this.dbName = dbName;
    this.maxCacheSize = maxCacheSize;
    this.db = null;
    this.openPromise = null;
  }

  async load() {
    try {
      await this.init();
    } catch (error) {
      console.warn('Failed to load full-image cache:', error);
    }
  }

  async init() {
    if (this.db) return this.db;
    if (this.openPromise) return this.openPromise;
    if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable');

    this.openPromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(this.dbName, FULL_IMAGE_CACHE_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(FULL_IMAGE_CACHE_STORE_NAME)) return;

        const store = db.createObjectStore(FULL_IMAGE_CACHE_STORE_NAME, { keyPath: 'url' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
          this.openPromise = null;
        };
        resolve(this.db);
      };

      request.onerror = () => {
        this.openPromise = null;
        reject(request.error);
      };
    });

    return this.openPromise;
  }

  close() {
    this.db?.close();
    this.db = null;
    this.openPromise = null;
  }

  async get(attachmentUrl) {
    const record = await this.getRecord(attachmentUrl);
    return record?.blob || null;
  }

  async getRecord(attachmentUrl) {
    const db = await this.init();
    const transaction = db.transaction(FULL_IMAGE_CACHE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(FULL_IMAGE_CACHE_STORE_NAME);
    return requestResult(store.get(attachmentUrl));
  }

  async getCacheSize() {
    const db = await this.init();
    const transaction = db.transaction(FULL_IMAGE_CACHE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(FULL_IMAGE_CACHE_STORE_NAME);
    const records = await requestResult(store.getAll());
    return records.reduce((total, record) => total + Number(record.size || 0), 0);
  }

  async put(attachment, blob) {
    const attachmentUrl = attachment?.url;
    const mimeType = attachment?.type || blob?.type || '';
    if (!attachmentUrl) throw new Error('Cannot cache an image without an attachment URL');
    if (!mimeType.startsWith('image/')) throw new Error('Full-image cache accepts only image attachments');
    if (!(blob instanceof Blob)) throw new Error('Full-image cache requires a Blob');
    if (blob.size > this.maxCacheSize) return false;

    const existingRecord = await this.getRecord(attachmentUrl);
    const currentSize = await this.getCacheSize();
    const projectedSize = currentSize - Number(existingRecord?.size || 0) + blob.size;
    if (projectedSize > this.maxCacheSize) return false;

    const db = await this.init();
    const transaction = db.transaction(FULL_IMAGE_CACHE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(FULL_IMAGE_CACHE_STORE_NAME);
    store.put({
      url: attachmentUrl,
      mimeType,
      size: blob.size,
      blob,
      cachedAt: Date.now(),
    });
    await transactionComplete(transaction);
    return true;
  }

  async delete(attachmentUrl) {
    const db = await this.init();
    const transaction = db.transaction(FULL_IMAGE_CACHE_STORE_NAME, 'readwrite');
    transaction.objectStore(FULL_IMAGE_CACHE_STORE_NAME).delete(attachmentUrl);
    await transactionComplete(transaction);
  }
}

export async function getOrCacheFullImage({
  cache,
  attachment,
  downloadAndDecrypt,
}) {
  try {
    const cachedBlob = await cache.get(attachment.url);
    if (cachedBlob) return cachedBlob;
  } catch (error) {
    console.warn('Failed to read full image from cache:', error);
  }

  const blob = await downloadAndDecrypt();

  try {
    await cache.put(attachment, blob);
  } catch (error) {
    console.warn('Failed to cache full image:', error);
  }

  return blob;
}
