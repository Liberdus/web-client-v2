import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [productionHtml, productionJs, mockHtml] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('./index.html', import.meta.url), 'utf8'),
]);

const productionFilterLabels = [...productionHtml.matchAll(
  /<span class="dao-filter-chip-label">([^<]+)<\/span>/g,
)].map((match) => match[1].trim());
const mockFilterLabels = [...mockHtml.matchAll(
  /<span class="dao-filter-chip-label">([^<]+)<\/span>/g,
)].map((match) => match[1].trim());

assert.equal(productionFilterLabels.length, 8, 'Production DAO filter count changed');
assert.equal(mockFilterLabels.length, 16, 'Expected two complete DAO filter bars in the mock');
assert.deepEqual(mockFilterLabels.slice(0, 8), productionFilterLabels);
assert.deepEqual(mockFilterLabels.slice(8), productionFilterLabels);

const productionActions = [
  'Review Draft',
  'Sign Proposal',
  'Submit review',
  'Finalize review result',
  'Submit vote',
  'Finalize vote result',
  'Claim reward',
  'Apply parameters',
];

for (const action of productionActions) {
  assert.ok(
    productionHtml.includes(action) || productionJs.includes(action),
    `Production action is unavailable: ${action}`,
  );
  assert.ok(mockHtml.includes(action), `Mock action is unavailable: ${action}`);
}

for (const staleCopy of [
  'Mock data',
  'backed by in-memory DAO mock data',
  'Active 22',
  'Archived 14',
  'Filter overlay',
  'Potential Role-Specific DAO Screens',
]) {
  assert.ok(!mockHtml.includes(staleCopy), `Stale mock copy remains: ${staleCopy}`);
}

for (const interactionHook of [
  'data-pan-viewport',
  'data-pan-canvas',
  'data-zoom-in',
  'data-zoom-out',
  'data-zoom-reset',
  'data-flow-source',
  'data-flow-target',
]) {
  assert.ok(mockHtml.includes(interactionHook), `Missing interaction hook: ${interactionHook}`);
}

const connectors = [...mockHtml.matchAll(
  /\{ from: "([^"]+)", to: "([^"]+)", label: "([^"]+)" \}/g,
)].map((match) => ({ from: match[1], to: match[2], label: match[3] }));
assert.equal(connectors.length, 9, 'Expected every current modal transition to have a connector');

for (const connector of connectors) {
  assert.ok(
    mockHtml.includes(`data-flow-source="${connector.from}"`),
    `Missing connector source: ${connector.from}`,
  );
  assert.ok(
    mockHtml.includes(`data-flow-target="${connector.to}"`),
    `Missing connector target: ${connector.to}`,
  );
}

const scriptStart = mockHtml.indexOf('<script>');
const scriptEnd = mockHtml.indexOf('</script>', scriptStart);
assert.notEqual(scriptStart, -1, 'Mock inline script is missing');
assert.notEqual(scriptEnd, -1, 'Mock inline script is not closed');
new Function(mockHtml.slice(scriptStart + '<script>'.length, scriptEnd));

console.log('DAO current modal flow mock validation passed');
