import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const securitySource = await readFile(new URL('../security-utils.js', import.meta.url), 'utf8');
const security = await import(`data:text/javascript;base64,${Buffer.from(securitySource).toString('base64')}`);

const {
  escapeHtml,
  escapeHtmlAttribute,
  normalizeHttpsUrl,
  normalizeMimeType,
  normalizeResourceUrl,
  normalizeTransactionId,
} = security;

test('encodes HTML text and quoted attribute delimiters', () => {
  const payload = `<img src=x onerror="globalThis.executed=true">'`;
  const escaped = escapeHtml(payload);

  assert.equal(
    escaped,
    '&lt;img src=x onerror=&quot;globalThis.executed=true&quot;&gt;&#39;'
  );
  assert.equal(escapeHtmlAttribute(payload), escaped);
  assert.doesNotMatch(escaped, /<img/i);
});

test('normalizes attachment and voice resource URLs without attribute breakout', () => {
  const payload = `"><img src=x onerror="globalThis.executed=true">`;
  const normalized = normalizeResourceUrl(payload, 'https://app.liberdus.test/chat');
  const attribute = escapeHtmlAttribute(normalized);

  assert.match(normalized, /^https:\/\/app\.liberdus\.test\//);
  assert.doesNotMatch(attribute, /"[^>]*onerror=/i);
  assert.equal(normalizeResourceUrl('javascript:alert(1)', 'https://app.liberdus.test/'), '');
  assert.equal(normalizeResourceUrl('data:text/html,<script>alert(1)</script>', 'https://app.liberdus.test/'), '');
});

test('rejects injected MIME types and reply transaction identifiers', () => {
  assert.equal(normalizeMimeType('text/plain" onmouseover="alert(1)'), 'application/octet-stream');
  assert.equal(normalizeMimeType('image/png'), 'image/png');
  assert.equal(normalizeTransactionId('" onmouseover="alert(1)'), '');
  assert.equal(normalizeTransactionId('ab'.repeat(32)), 'ab'.repeat(32));
});

test('allows only the configured HTTPS call origin', () => {
  const origins = ['https://meet.liberdus.com'];

  assert.equal(
    normalizeHttpsUrl('https://meet.liberdus.com/room', origins),
    'https://meet.liberdus.com/room'
  );
  assert.equal(normalizeHttpsUrl('javascript:alert(1)', origins), '');
  assert.equal(normalizeHttpsUrl('https://meeting.invalid/room', origins), '');
  assert.equal(normalizeHttpsUrl('https://user:pass@meet.liberdus.com/room', origins), '');
});

test('canonicalizes and encodes EVM logo URLs', () => {
  const payload = `https://logo.invalid/missing" onerror="globalThis.executed=true`;
  const normalized = normalizeHttpsUrl(payload);
  const attribute = escapeHtmlAttribute(normalized);

  assert.match(normalized, /^https:\/\/logo\.invalid\//);
  assert.doesNotMatch(attribute, /"[^>]*onerror=/i);
  assert.equal(normalizeHttpsUrl('data:image/svg+xml,<svg onload=alert(1)>'), '');
});

test('all seven F-01 renderer fields use the shared protections', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const evm = await readFile(new URL('../evm-assets.js', import.meta.url), 'utf8');

  assert.match(app, /data-reply-txid="\$\{escapeHtmlAttribute\(replyId\)\}"/);
  assert.match(app, /data-url="\$\{escapeHtmlAttribute\(fileUrl\)\}"/);
  assert.match(app, /data-type="\$\{escapeHtmlAttribute\(mimeType\)\}"/);
  assert.match(app, /\$\{escapeHtml\(fileName\)\}/);
  assert.match(app, /href="\$\{escapeHtmlAttribute\(callJoinUrl\)\}"/);
  assert.match(app, /data-url="\$\{escapeHtmlAttribute\(voiceUrl\)\}"/);
  assert.match(evm, /src="\$\{escapeHtmlAttribute\(logoUrl\)\}"/);

  assert.doesNotMatch(app, /data-reply-txid="\$\{escapeHtml\(item\.replyId\)\}"/);
  assert.doesNotMatch(app, /href='\$\{item\.message\}/);
  assert.doesNotMatch(evm, /src="\$\{escapeHtml\(logoUrl\)\}"/);
});
