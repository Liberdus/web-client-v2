import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { openSecureBridge, resolveSecureBridgeUrl } from '../bridge-security.js';

const APP_URL = 'https://app.example.test/client/';
const APP_ORIGIN = 'https://app.example.test';

test('resolves the same-origin bridge route over HTTPS', () => {
  assert.equal(
    resolveSecureBridgeUrl('./bridge', { baseUrl: APP_URL, allowedOrigins: [APP_ORIGIN] }),
    'https://app.example.test/client/bridge',
  );
});

test('rejects insecure, credentialed, malformed, and unapproved destinations', () => {
  assert.throws(
    () => resolveSecureBridgeUrl('http://app.example.test/bridge', { baseUrl: APP_URL, allowedOrigins: [APP_ORIGIN] }),
    /must use HTTPS/,
  );
  assert.throws(
    () => resolveSecureBridgeUrl('https://user:secret@app.example.test/bridge', { baseUrl: APP_URL, allowedOrigins: [APP_ORIGIN] }),
    /must not contain credentials/,
  );
  assert.throws(
    () => resolveSecureBridgeUrl('https://other.example.test/bridge', { baseUrl: APP_URL, allowedOrigins: [APP_ORIGIN] }),
    /not an approved origin/,
  );
  assert.throws(
    () => resolveSecureBridgeUrl('https://[invalid', { baseUrl: APP_URL, allowedOrigins: [APP_ORIGIN] }),
    /invalid/,
  );
});

test('opens a validated bridge without granting opener access', () => {
  const calls = [];
  const openedWindow = { opener: 'application-window' };
  const windowObject = {
    location: { href: APP_URL },
    open: (...args) => {
      calls.push(args);
      return openedWindow;
    },
  };

  openSecureBridge('./bridge', { windowObject, allowedOrigins: [APP_ORIGIN] });
  assert.deepEqual(calls, [[
    'https://app.example.test/client/bridge',
    '_blank',
    'noopener,noreferrer',
  ]]);
  assert.equal(openedWindow.opener, null);
});

test('the bundled bridge page contains no redirect or insecure URL', () => {
  const html = fs.readFileSync(new URL('../bridge/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /http-equiv=["']refresh/i);
  assert.doesNotMatch(html, /http:\/\//i);
  assert.match(html, /secure HTTPS service/i);
});
