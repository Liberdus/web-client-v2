import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const [productionHtml, productionJs, productionCss, mockHtml, catalogData] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('./index.html', import.meta.url), 'utf8'),
  readFile(new URL('./modal-catalog-data.js', import.meta.url), 'utf8'),
]);

const catalogWindow = {};
new Function('window', catalogData)(catalogWindow);
const catalog = catalogWindow.MODAL_CATALOG;
assert.ok(Array.isArray(catalog), 'Generated modal catalog must define an array');
assert.equal(
  catalogWindow.MODAL_CATALOG_SOURCE,
  createHash('sha256').update(productionHtml).digest('hex'),
  'Generated modal catalog is stale; run node mock/generate-modal-catalog.mjs',
);

const productionModalIds = [...productionHtml.matchAll(/<div\b[^>]*>/g)]
  .map(([tag]) => ({
    className: tag.match(/\bclass="([^"]*)"/)?.[1] || '',
    id: tag.match(/\bid="([^"]+)"/)?.[1] || '',
  }))
  .filter(({ className }) => className.split(/\s+/).includes('modal'))
  .map(({ id }) => id)
  .sort();
const catalogModalIds = catalog.map(({ id }) => id).sort();
assert.deepEqual(catalogModalIds, productionModalIds, 'Generated catalog must include every production modal exactly once');
for (const entry of catalog) {
  assert.ok(entry.markup.includes(`id="${entry.id}"`), `Catalog markup is unavailable: ${entry.id}`);
}

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

assert.ok(
  mockHtml.includes('class="floating-button visible" id="daoAddProposalButton"'),
  'The mock proposal list must expose the production add-proposal action',
);

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
  'data-device-root',
  'data-showcase-tab',
  'canvas.querySelectorAll(".screen[data-app-modal]")',
  '#chatModal .messages-container',
  'activateShowcasePanel',
  'new URLSearchParams(window.location.search).get("tab")',
  'renderChatOverlay',
  'renderModalCatalog()',
  'screen.dataset.catalogModal',
  '<body><div class="container">${rootMarkup}</div>',
  'deviceRoot.matches("[data-device-root]")',
]) {
  assert.ok(mockHtml.includes(deviceBehavior), `Missing device behavior: ${deviceBehavior}`);
}
assert.ok(!mockHtml.includes('<main class="container">'), 'Device previews must use the production container element');
assert.ok(!mockHtml.includes('[data-device-root] { display: contents; }'), 'Device previews must not retain the mock mounting wrapper');

assert.equal(
  [...mockHtml.matchAll(/data-app-modal="[^"]+"/g)].length,
  28,
  'Every authored preview and the generated catalog template must expose a device-frame hook',
);

const showcaseTabs = [...mockHtml.matchAll(/data-showcase-tab="([^"]+)"/g)].map((match) => match[1]);
const showcasePanels = [...mockHtml.matchAll(/data-showcase-panel="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(showcaseTabs, ['dao', 'screens', 'chat', 'my-info', 'contact-info', 'all-modals']);
assert.deepEqual(showcasePanels, showcaseTabs, 'Every showcase tab must own exactly one panel');
assert.ok(mockHtml.includes('<script src="./modal-catalog-data.js"></script>'), 'Mock must load generated modal data');

for (const primaryScreen of ['chatsScreen', 'contactsScreen', 'walletScreen']) {
  assert.ok(productionHtml.includes(`id="${primaryScreen}"`), `Production screen is unavailable: ${primaryScreen}`);
  assert.ok(mockHtml.includes(`data-app-modal="${primaryScreen}"`), `Mock screen is unavailable: ${primaryScreen}`);
}

for (const profileModal of ['myInfoModal', 'contactInfoModal']) {
  assert.ok(productionHtml.includes(`id="${profileModal}"`), `Production profile modal is unavailable: ${profileModal}`);
  assert.ok(mockHtml.includes(`data-app-modal="${profileModal}"`), `Mock profile modal is unavailable: ${profileModal}`);
}

const chatMessageHooks = [
  'update-toll-required-divider',
  'message-content',
  'reply-quote',
  'attachment-row',
  'payment-info',
  'call-message',
  'call-message-schedule',
  'voice-message',
  'location-message',
  'message-edited-label',
  'deleted-message',
  'message-reactions',
];
for (const messageHook of chatMessageHooks) {
  assert.ok(
    productionHtml.includes(messageHook)
      || productionJs.includes(messageHook)
      || productionCss.includes(messageHook),
    `Production chat message hook is unavailable: ${messageHook}`,
  );
  assert.ok(mockHtml.includes(messageHook), `Mock chat message hook is unavailable: ${messageHook}`);
}
assert.ok(productionCss.includes(".message.sent[data-status='failed']"), 'Production failed-message style is unavailable');
assert.ok(mockHtml.includes('data-status="failed"'), 'Mock failed-message example is unavailable');

const chatOverlayIds = [
  'voiceRecordingModal',
  'callScheduleChoiceModal',
  'dateTimePickerModal',
  'durationPickerModal',
  'chatHeaderContextMenu',
  'messageContextMenu',
  'imageAttachmentContextMenu',
  'attachmentOptionsContextMenu',
  'locationSharePanel',
  'chatReactionSheetOverlay',
  'cameraCaptureOverlay',
];
assert.equal(
  [...mockHtml.matchAll(/data-chat-overlay="[^"]+"/g)].length,
  chatOverlayIds.length,
  'Expected every requested chat overlay to have a device preview',
);
for (const overlayId of chatOverlayIds) {
  assert.ok(productionHtml.includes(`id="${overlayId}"`), `Production chat overlay is unavailable: ${overlayId}`);
  assert.ok(mockHtml.includes(`id="${overlayId}"`), `Mock chat overlay is unavailable: ${overlayId}`);
}
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

for (const connectorGeometryHook of [
  'markerUnits="userSpaceOnUse"',
  'const connectorGeometry =',
  'const connectorLabel =',
  'labelTangent',
  'labelNormal',
  'dominant-baseline',
  'rotate(${labelAngle.toFixed(1)}) scale(${labelScale.toFixed(2)})',
]) {
  assert.ok(
    mockHtml.includes(connectorGeometryHook),
    `Missing adaptive connector geometry: ${connectorGeometryHook}`,
  );
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

console.log('Liberdus UI showcase validation passed');
