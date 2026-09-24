export const DECRYPTED_MEDIA_DATABASES = Object.freeze([
  'liberdus_contact_avatars',
  'liberdus_thumbnails',
]);

export function canPersistDecryptedMedia(storage = globalThis.localStorage) {
  return storage?.getItem('lock') === null;
}

export function closeMediaCache(cache, urlApi = globalThis.URL) {
  if (!cache) return;

  if (cache.blobUrlCache instanceof Map) {
    for (const blobUrl of cache.blobUrlCache.values()) {
      try {
        urlApi?.revokeObjectURL(blobUrl);
      } catch (_) {
        // Continue closing the cache even if a stale URL cannot be revoked.
      }
    }
    cache.blobUrlCache.clear();
  }

  try {
    cache.db?.close();
  } finally {
    cache.db = null;
    if ('openPromise' in cache) cache.openPromise = null;
  }
}

function deleteDatabase(indexedDb, databaseName) {
  return new Promise((resolve, reject) => {
    const request = indexedDb.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`Failed to delete ${databaseName}`));
    request.onblocked = () => reject(new Error(`Deletion of ${databaseName} was blocked by another tab`));
  });
}

export async function purgeDecryptedMediaCaches({
  indexedDb = globalThis.indexedDB,
  caches = [],
  databaseNames = DECRYPTED_MEDIA_DATABASES,
  urlApi = globalThis.URL,
} = {}) {
  if (!indexedDb?.deleteDatabase) {
    throw new Error('IndexedDB is unavailable');
  }

  for (const cache of caches) closeMediaCache(cache, urlApi);
  await Promise.all(databaseNames.map((name) => deleteDatabase(indexedDb, name)));
}
