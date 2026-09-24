const MIME_ALIASES = Object.freeze({
  'audio/mp3': 'audio/mpeg',
  'audio/x-flac': 'audio/flac',
  'audio/x-wav': 'audio/wav',
  'image/jpg': 'image/jpeg',
  'video/x-m4v': 'video/mp4',
});

const SAFE_PREVIEW_MIME_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/mpeg',
  'video/ogg',
  'video/quicktime',
  'video/webm',
]);

function startsWithBytes(bytes, signature) {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function asciiAt(bytes, offset, value) {
  if (bytes.length < offset + value.length) return false;
  return Array.from(value).every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function hasIsoBaseMediaSignature(bytes) {
  return asciiAt(bytes, 4, 'ftyp');
}

function hasAvifBrand(bytes) {
  if (!hasIsoBaseMediaSignature(bytes)) return false;
  const brands = String.fromCharCode(...bytes.slice(8, 64));
  return brands.includes('avif') || brands.includes('avis');
}

/**
 * Returns a normalized MIME type without parameters.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAttachmentMimeType(value) {
  if (typeof value !== 'string' || value.length > 256) return '';
  const mimeType = value.split(';', 1)[0].trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mimeType)) return '';
  return MIME_ALIASES[mimeType] || mimeType;
}

/**
 * Returns the canonical preview MIME type only when both the declared type and
 * the decrypted file signature match an explicitly allowed passive media type.
 * Active documents, unknown formats, and MIME/content mismatches return empty.
 * @param {Uint8Array} bytes
 * @param {unknown} declaredMimeType
 * @returns {string}
 */
export function detectSafeAttachmentPreviewMime(bytes, declaredMimeType) {
  if (!(bytes instanceof Uint8Array)) return '';
  const mimeType = normalizeAttachmentMimeType(declaredMimeType);
  if (!SAFE_PREVIEW_MIME_TYPES.has(mimeType)) return '';

  let matchesSignature = false;
  switch (mimeType) {
    case 'image/jpeg':
      matchesSignature = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
      break;
    case 'image/png':
      matchesSignature = startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      break;
    case 'image/gif':
      matchesSignature = asciiAt(bytes, 0, 'GIF87a') || asciiAt(bytes, 0, 'GIF89a');
      break;
    case 'image/webp':
      matchesSignature = asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP');
      break;
    case 'image/bmp':
      matchesSignature = asciiAt(bytes, 0, 'BM');
      break;
    case 'image/avif':
      matchesSignature = hasAvifBrand(bytes);
      break;
    case 'audio/mpeg':
      matchesSignature = asciiAt(bytes, 0, 'ID3') || (
        bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
      );
      break;
    case 'audio/wav':
      matchesSignature = asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WAVE');
      break;
    case 'audio/flac':
      matchesSignature = asciiAt(bytes, 0, 'fLaC');
      break;
    case 'audio/aac':
      matchesSignature = bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
      break;
    case 'audio/ogg':
    case 'video/ogg':
      matchesSignature = asciiAt(bytes, 0, 'OggS');
      break;
    case 'audio/webm':
    case 'video/webm':
      matchesSignature = startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
      break;
    case 'audio/mp4':
    case 'video/mp4':
    case 'video/quicktime':
      matchesSignature = hasIsoBaseMediaSignature(bytes);
      break;
    case 'video/mpeg':
      matchesSignature = startsWithBytes(bytes, [0x00, 0x00, 0x01, 0xba])
        || startsWithBytes(bytes, [0x00, 0x00, 0x01, 0xb3]);
      break;
  }

  return matchesSignature ? mimeType : '';
}

/**
 * Reads only the header needed for preview classification.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export async function getSafeAttachmentPreviewMime(blob) {
  if (!blob || typeof blob.slice !== 'function') return '';
  try {
    const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
    return detectSafeAttachmentPreviewMime(header, blob.type);
  } catch {
    return '';
  }
}
