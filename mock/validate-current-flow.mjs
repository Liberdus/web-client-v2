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

assert.ok(
  mockHtml.includes('const productionStylesUrl = new URL("../styles.css", window.location.href).href'),
  'Device frames must resolve the production stylesheet',
);
assert.ok(
  mockHtml.includes('<link rel="stylesheet" href="${productionStylesUrl}" />'),
  'Device documents must load the production stylesheet',
);

for (const productionAddProposalHook of [
  'id="addProposalModal"',
  'id="addProposalForm" class="form--narrow dao-proposal-form"',
  'id="addProposalOptionsList"',
  'class="form-group dao-form-section"',
  'class="dao-form-grid dao-form-grid--timing"',
]) {
  assert.ok(
    productionHtml.includes(productionAddProposalHook),
    `Production Add Proposal hook is unavailable: ${productionAddProposalHook}`,
  );
  assert.ok(
    mockHtml.includes(productionAddProposalHook),
    `Mock must reuse the production Add Proposal hook: ${productionAddProposalHook}`,
  );
}

for (const deviceBehavior of [
  '--device-viewport-height: 874px',
  '--device-viewport-width: 402px',
  'className = "device-frame"',
  'mountDeviceFrames()',
  'getScrollSurface(frameDocument)',
  'scrollSurface.scrollTop += event.deltaY',
  'renderProposalDetails(screen.dataset.proposalState || "review")',
  'proposal-more-content',
  'const frameMounts = mountDeviceFrames()',
  'data-flow-screen',
]) {
  assert.ok(mockHtml.includes(deviceBehavior), `Missing device behavior: ${deviceBehavior}`);
}

assert.equal(
  [...mockHtml.matchAll(/data-app-modal="[^"]+"/g)].length,
  10,
  'Every mock screen must mount one isolated app modal',
);
const flowScreens = [...mockHtml.matchAll(/<article class="screen"[^>]*data-flow-screen="([^"]+)"/g)]
  .map((match) => match[1]);
assert.equal(flowScreens.length, 10, 'Every mock screen must expose a connector fallback anchor');
assert.equal(new Set(flowScreens).size, flowScreens.length, 'Connector fallback anchors must be unique');
assert.equal(
  [...mockHtml.matchAll(/data-proposal-state="[^"]+"/g)].length,
  [...mockHtml.matchAll(/<details class="proposal-more">/g)].length,
  'Every proposal-state screen must expose expandable proposal details',
);

assert.ok(!mockHtml.includes('compact-content'), 'Mock must render production UI without scale-to-fit classes');

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
  /\{ from: "([^"]+)", screen: "([^"]+)", to: "([^"]+)", label: "([^"]+)" \}/g,
)].map((match) => ({ from: match[1], screen: match[2], to: match[3], label: match[4] }));
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
  assert.ok(
    mockHtml.includes(`data-flow-screen="${connector.screen}"`),
    `Missing connector fallback screen: ${connector.screen}`,
  );
}

const scriptStart = mockHtml.indexOf('<script>');
const scriptEnd = mockHtml.indexOf('</script>', scriptStart);
const bodyEnd = mockHtml.indexOf('</body>');
assert.notEqual(scriptStart, -1, 'Mock inline script is missing');
assert.notEqual(scriptEnd, -1, 'Mock inline script is not closed');
assert.ok(bodyEnd > scriptEnd, 'Live Server must not inject reload code inside the mock script');
new Function(mockHtml.slice(scriptStart + '<script>'.length, scriptEnd));

console.log('DAO current modal flow mock validation passed');
