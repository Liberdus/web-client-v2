import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createFullImageCacheKey,
  createFullImageCacheScope,
  getOrCacheFullImage,
} from '../full-image-cache.js';

class MemoryCache {
  constructor() {
    this.records = new Map();
  }

  async get(scope, attachmentUrl) {
    return this.records.get(createFullImageCacheKey(scope, attachmentUrl))?.blob || null;
  }

  async put(scope, attachment, blob) {
    this.records.set(createFullImageCacheKey(scope, attachment.url), { attachment, blob });
  }
}

async function blobText(blob) {
  return new TextDecoder().decode(await blob.arrayBuffer());
}

test('partitions attachment URLs by network and account', () => {
  const firstScope = createFullImageCacheScope('net-a', 'account-a');
  const secondScope = createFullImageCacheScope('net-a', 'account-b');

  assert.notEqual(
    createFullImageCacheKey(firstScope, 'https://files.example/image'),
    createFullImageCacheKey(secondScope, 'https://files.example/image'),
  );
});

test('downloads once and reuses the full image on later saves', async () => {
  const cache = new MemoryCache();
  const scope = createFullImageCacheScope('net-a', 'account-a');
  const attachment = {
    url: 'https://files.example/image-a',
    name: 'photo.png',
    type: 'image/png',
  };
  let decryptions = 0;

  const resolveImage = () => getOrCacheFullImage({
    cache,
    scope,
    attachment,
    downloadAndDecrypt: async () => {
      decryptions += 1;
      return new Blob(['full-image-bytes'], { type: attachment.type });
    },
  });

  const firstBlob = await resolveImage();
  const secondBlob = await resolveImage();

  assert.equal(decryptions, 1);
  assert.equal(await blobText(firstBlob), 'full-image-bytes');
  assert.equal(await blobText(secondBlob), 'full-image-bytes');
});

test('uses URLs as identity when different images have the same filename', async () => {
  const cache = new MemoryCache();
  const scope = createFullImageCacheScope('net-a', 'account-a');
  const first = { url: 'https://files.example/a', name: 'photo.png', type: 'image/png' };
  const second = { url: 'https://files.example/b', name: 'photo.png', type: 'image/png' };

  const firstBlob = await getOrCacheFullImage({
    cache,
    scope,
    attachment: first,
    downloadAndDecrypt: async () => new Blob(['first'], { type: first.type }),
  });
  const secondBlob = await getOrCacheFullImage({
    cache,
    scope,
    attachment: second,
    downloadAndDecrypt: async () => new Blob(['second'], { type: second.type }),
  });

  assert.equal(cache.records.size, 2);
  assert.equal(await blobText(firstBlob), 'first');
  assert.equal(await blobText(secondBlob), 'second');
});

test('reuses bytes by URL without reusing a stale export filename', async () => {
  const cache = new MemoryCache();
  const scope = createFullImageCacheScope('net-a', 'account-a');
  const exportedFiles = [];
  let decryptions = 0;

  async function save(filename) {
    const attachment = {
      url: 'https://files.example/shared',
      name: filename,
      type: 'image/png',
    };
    const blob = await getOrCacheFullImage({
      cache,
      scope,
      attachment,
      downloadAndDecrypt: async () => {
        decryptions += 1;
        return new Blob(['shared-bytes'], { type: attachment.type });
      },
    });
    exportedFiles.push({ filename, bytes: await blobText(blob) });
  }

  await save('first-name.png');
  await save('current-name.png');

  assert.equal(decryptions, 1);
  assert.deepEqual(exportedFiles, [
    { filename: 'first-name.png', bytes: 'shared-bytes' },
    { filename: 'current-name.png', bytes: 'shared-bytes' },
  ]);
});

test('cache failures do not prevent a freshly decrypted image from being saved', async () => {
  const downloadedBlob = new Blob(['fresh-bytes'], { type: 'image/png' });
  const cache = {
    get: async () => null,
    put: async () => { throw new Error('QuotaExceededError'); },
  };

  const blob = await getOrCacheFullImage({
    cache,
    scope: createFullImageCacheScope('net-a', 'account-a'),
    attachment: { url: 'https://files.example/image', name: 'image.png', type: 'image/png' },
    downloadAndDecrypt: async () => downloadedBlob,
  });

  assert.equal(blob, downloadedBlob);
});

test('the application routes only image saves through the full-image cache', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(appSource, /const blob = isImage\s*\? await this\.getFullImageBlob\(item, linkEl\)\s*:\s*await this\.decryptAttachmentToBlob\(item, linkEl\)/);
  assert.match(appSource, /if \(isViewable && !isImage\) \{\s*window\.open\(blobUrl, '_blank'\)/);
  assert.match(appSource, /type: "DOWNLOAD_ATTACHMENT",\s*filename: filename,\s*mime: blob\.type,\s*dataUrl: reader\.result/);
});
