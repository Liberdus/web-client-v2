const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/**
 * Encodes an untrusted value for an HTML text context.
 * Quotes are encoded as well so callers cannot accidentally reuse a text-only
 * encoding helper in an attribute context.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, character => HTML_ESCAPE_MAP[character]);
}

/**
 * Encodes an untrusted value for a quoted HTML attribute.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

/**
 * Returns a canonical HTTPS URL, optionally restricted to an origin allowlist.
 * Credentials and overlong values are rejected.
 * @param {unknown} value
 * @param {string[]|null} allowedOrigins
 * @returns {string}
 */
export function normalizeHttpsUrl(value, allowedOrigins = null) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (!candidate || candidate.length > 2048) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (Array.isArray(allowedOrigins) && !allowedOrigins.includes(url.origin)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Normalizes an attachment/media resource URL. External resources must use
 * HTTPS; HTTP is permitted only for a same-origin local development page.
 * @param {unknown} value
 * @param {string} baseUrl
 * @returns {string}
 */
export function normalizeResourceUrl(value, baseUrl) {
  if (value === '#') return '#';
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (!candidate || candidate.length > 4096) return '';

  try {
    const base = new URL(baseUrl);
    const url = new URL(candidate, base);
    const sameOriginHttp = url.protocol === 'http:' && url.origin === base.origin;
    if ((url.protocol !== 'https:' && !sameOriginHttp) || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Accepts a simple MIME type without parameters or control characters.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMimeType(value) {
  if (typeof value !== 'string') return 'application/octet-stream';
  const mimeType = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mimeType)
    ? mimeType
    : 'application/octet-stream';
}

/**
 * Accepts a 32-byte hexadecimal transaction identifier.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeTransactionId(value) {
  if (typeof value !== 'string') return '';
  const txid = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(txid) ? txid : '';
}
