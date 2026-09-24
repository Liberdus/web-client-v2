import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const securitySource = await readFile(new URL('../attachment-security.js', import.meta.url), 'utf8');
const {
  detectSafeAttachmentPreviewMime,
  getSafeAttachmentPreviewMime,
  normalizeAttachmentMimeType,
} = await import(`data:text/javascript;base64,${Buffer.from(securitySource).toString('base64')}`);

const ascii = value => new TextEncoder().encode(value);

test('normalizes MIME parameters and common passive-media aliases', () => {
  assert.equal(normalizeAttachmentMimeType(' Image/JPG ; charset=binary '), 'image/jpeg');
  assert.equal(normalizeAttachmentMimeType('audio/x-wav'), 'audio/wav');
  assert.equal(normalizeAttachmentMimeType('text/html'), 'text/html');
  assert.equal(normalizeAttachmentMimeType('image/png\ntext/html'), '');
});

test('rejects active document formats from inline preview', () => {
  const activeFormats = [
    ['text/html', '<!doctype html><script>parent.pwned=true</script>'],
    ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>parent.pwned=true</script></svg>'],
    ['application/xml', '<?xml version="1.0"?><root/>'],
    ['text/xml', '<?xml version="1.0"?><root/>'],
    ['application/json', '{"active":true}'],
    ['application/pdf', '%PDF-1.7'],
  ];

  for (const [mimeType, content] of activeFormats) {
    assert.equal(detectSafeAttachmentPreviewMime(ascii(content), mimeType), '', mimeType);
  }
});

test('rejects active content mislabeled as passive media', () => {
  const html = ascii('<!doctype html><script>globalThis.pwned=true</script>');
  for (const mimeType of ['image/png', 'image/jpeg', 'audio/mpeg', 'video/mp4', 'video/webm']) {
    assert.equal(detectSafeAttachmentPreviewMime(html, mimeType), '', mimeType);
  }
});

test('allows approved raster images only when their signatures match', () => {
  assert.equal(
    detectSafeAttachmentPreviewMime(
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png'
    ),
    'image/png'
  );
  assert.equal(detectSafeAttachmentPreviewMime(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg'), 'image/jpeg');
  assert.equal(detectSafeAttachmentPreviewMime(ascii('GIF89a'), 'image/gif'), 'image/gif');
  assert.equal(detectSafeAttachmentPreviewMime(ascii('RIFF0000WEBP'), 'image/webp'), 'image/webp');
  assert.equal(detectSafeAttachmentPreviewMime(ascii('BM'), 'image/bmp'), 'image/bmp');
});

test('allows approved audio and video containers only when signatures match', () => {
  assert.equal(detectSafeAttachmentPreviewMime(ascii('ID3'), 'audio/mpeg'), 'audio/mpeg');
  assert.equal(detectSafeAttachmentPreviewMime(ascii('RIFF0000WAVE'), 'audio/wav'), 'audio/wav');
  assert.equal(detectSafeAttachmentPreviewMime(ascii('OggS'), 'audio/ogg'), 'audio/ogg');
  assert.equal(
    detectSafeAttachmentPreviewMime(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), 'video/webm'),
    'video/webm'
  );
  assert.equal(detectSafeAttachmentPreviewMime(ascii('0000ftypisom'), 'video/mp4'), 'video/mp4');
});

test('classifies Blob headers without reading sender-controlled markup as a document', async () => {
  const activeBlob = new Blob(['<!doctype html><script>globalThis.pwned=true</script>'], { type: 'image/png' });
  const pngBlob = new Blob(
    [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    { type: 'image/png' }
  );

  assert.equal(await getSafeAttachmentPreviewMime(activeBlob), '');
  assert.equal(await getSafeAttachmentPreviewMime(pngBlob), 'image/png');
});

test('download handler gates window.open on verified content and pins its MIME type', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(app, /normalizedMime\.startsWith\(|'text\/'\s*,|'image\/'\s*,/);
  assert.match(app, /const safePreviewMime = await getSafeAttachmentPreviewMime\(blob\)/);
  assert.match(app, /new Blob\(\[blob\], \{ type: safePreviewMime \}\)/);
  assert.match(app, /if \(previewUrl\) \{\s*window\.open\(previewUrl, '_blank', 'noopener,noreferrer'\)/);
  assert.match(app, /this\.triggerFileDownload\(downloadUrl, filename\)/);
  assert.match(app, /if \(!safePreviewMime\.startsWith\('image\/'\)\) \{\s*throw new Error/);
});
