import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const [productionHtml, productionJs, productionCss, mockHtml, catalogData, stateData, daoJs] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('./index.html', import.meta.url), 'utf8'),
  readFile(new URL('./modal-catalog-data.js', import.meta.url), 'utf8'),
  readFile(new URL('./proposal-states.js', import.meta.url), 'utf8'),
  readFile(new URL('../dao.js', import.meta.url), 'utf8'),
]);

const stateWindow = {};
new Function('window', stateData)(stateWindow);
const stateMarkup = stateWindow.PROPOSAL_STATE_MARKUP;
const stateExamples = stateWindow.PROPOSAL_STATE_GROUPS.flatMap(({ examples }) => examples);
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

assert.ok(productionFilterLabels.length > 0, 'Production DAO filters are unavailable');
assert.equal(
  mockFilterLabels.length,
  productionFilterLabels.length * 2,
  'Expected two complete DAO filter bars in the mock',
);
assert.deepEqual(mockFilterLabels.slice(0, productionFilterLabels.length), productionFilterLabels);
assert.deepEqual(mockFilterLabels.slice(productionFilterLabels.length), productionFilterLabels);

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
  'id="addProposalProjectEditor"',
  'id="addProposalProjectMilestones"',
  'id="addProposalProjectAddMilestone"',
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
  'window.PROPOSAL_STATE_MARKUP',
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
  34,
  'Every authored preview and the generated catalog template must expose a device-frame hook',
);

const showcaseTabs = [...mockHtml.matchAll(/data-showcase-tab="([^"]+)"/g)].map((match) => match[1]);
const showcasePanels = [...mockHtml.matchAll(/data-showcase-panel="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(showcaseTabs, ['dao', 'projects', 'screens', 'account', 'chat', 'my-info', 'contact-info', 'all-modals']);
assert.deepEqual(showcasePanels, showcaseTabs, 'Every showcase tab must own exactly one panel');
assert.ok(mockHtml.includes('<script src="./modal-catalog-data.js"></script>'), 'Mock must load generated modal data');

for (const primaryScreen of ['chatsScreen', 'contactsScreen', 'walletScreen']) {
  assert.ok(productionHtml.includes(`id="${primaryScreen}"`), `Production screen is unavailable: ${primaryScreen}`);
  assert.ok(mockHtml.includes(`data-app-modal="${primaryScreen}"`), `Mock screen is unavailable: ${primaryScreen}`);
}

const screensPanelStart = mockHtml.indexOf('id="showcase-panel-screens"');
const screensPanelEnd = mockHtml.indexOf('id="showcase-panel-account"');
assert.ok(screensPanelStart >= 0 && screensPanelEnd > screensPanelStart, 'Primary screens panel is unavailable');
const primaryScreensMarkup = mockHtml.slice(screensPanelStart, screensPanelEnd);
for (const screenHook of [
  'logo-link',
  'app-name-avatar',
  'contact-section-header',
  'chat-failed-indicator',
  'walletTotalBalance',
  'refreshBalance',
  'wallet-action-button',
]) {
  assert.ok(
    productionHtml.includes(screenHook) || productionJs.includes(screenHook) || productionCss.includes(screenHook),
    `Production primary-screen hook is unavailable: ${screenHook}`,
  );
  assert.ok(primaryScreensMarkup.includes(screenHook), `Mock primary-screen hook is unavailable: ${screenHook}`);
}
assert.equal(
  [...primaryScreensMarkup.matchAll(/class="app-name">alex<\/div>/g)].length,
  3,
  'Every primary screen must show the signed-in runtime header',
);
assert.equal(
  [...primaryScreensMarkup.matchAll(/<div class="contact-section-header">/g)].length,
  3,
  'Contact groups must use the runtime-rendered section element',
);
assert.equal(
  [...primaryScreensMarkup.matchAll(/<div class="asset-item">/g)].length,
  1,
  'The default runtime wallet must show its single LIB asset',
);
assert.ok(
  primaryScreensMarkup.includes('id="walletTotalBalance">248.42</span>'),
  'Wallet total must omit a literal currency prefix supplied by production CSS',
);
assert.ok(primaryScreensMarkup.includes('$248.420000</span>'), 'Asset net worth must use runtime precision');
assert.ok(!primaryScreensMarkup.includes('<div class="asset-name">Ethereum</div>'), 'Mock must not invent a non-default wallet asset');

const projectsPanelStart = mockHtml.indexOf('id="showcase-panel-projects"');
const projectsPanelEnd = mockHtml.indexOf('id="showcase-panel-screens"');
assert.ok(projectsPanelStart >= 0 && projectsPanelEnd > projectsPanelStart, 'Projects panel is unavailable');
const projectsMarkup = mockHtml.slice(projectsPanelStart, projectsPanelEnd) + stateMarkup;
for (const projectHook of [
  'dao-project-editor',
  'dao-project-milestone',
  'dao-project-review-milestone-list',
  'dao-project-info-milestone',
]) {
  assert.ok(
    productionHtml.includes(projectHook) || productionJs.includes(projectHook) || productionCss.includes(projectHook),
    `Production project hook is unavailable: ${projectHook}`,
  );
  assert.ok(projectsMarkup.includes(projectHook), `Mock project hook is unavailable: ${projectHook}`);
}
for (const projectState of ['executing', 'terminated', 'completed']) {
  assert.ok(productionHtml.includes(`data-filter-key="${projectState}"`), `Production project filter is unavailable: ${projectState}`);
  assert.ok(projectsMarkup.includes(`data-proposal-state="${projectState}"`), `Mock project state is unavailable: ${projectState}`);
}
// Compare the gallery against the branch's persisted states so new states cannot
// silently disappear from this reference.
const proposalStates = ['DAO_STATES', 'DAO_PROJECT_FILTERS'].flatMap((name) => {
  const declaration = daoJs.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(declaration, `Missing production state list: ${name}`);
  const states = [...declaration[1].matchAll(/key: '([^']+)'/g)].map((match) => match[1]);
  assert.ok(states.length > 0, `Production state list must not be empty: ${name}`);
  return states;
});
for (const state of [...proposalStates, 'canceled']) {
  assert.ok(stateMarkup.includes(`data-proposal-state="${state}"`), `Missing proposal state: ${state}`);
}
const milestoneLabels = daoJs.match(/const DAO_PROJECT_MILESTONE_STATUS_LABELS = Object.freeze\(\{([\s\S]*?)\}\)/)[1];
for (const [, state] of milestoneLabels.matchAll(/(\w+):/g)) {
  assert.ok(stateMarkup.includes(`data-milestone-state="${state}"`), `Missing milestone state: ${state}`);
}
assert.equal(new Set(stateExamples.map(({ id }) => id)).size, stateExamples.length, 'State example IDs must be unique');
assert.equal([...stateMarkup.matchAll(/data-app-modal="proposalInfoModal"/g)].length, stateExamples.length);
assert.equal([...stateMarkup.matchAll(/<details class="proposal-more">/g)].length, stateExamples.length);
for (const label of ['Propose start now', 'Endorse proposed start', 'Propose completion now', 'Endorse proposed completion', 'Submit termination vote', 'Claim milestone payment', 'Start project', 'End project', 'Propose contractor address', 'Endorse proposed address', 'Reclaim remaining balance']) {
  const productionLabel = label.replace(/start|completion/, '${verb}');
  assert.ok(productionJs.includes(label) || productionJs.includes(productionLabel), `Unavailable production project action: ${label}`);
  assert.ok(stateMarkup.includes(label), `Missing project action example: ${label}`);
}
for (const id of ['claim-paid', 'claim-insufficient', 'observer', 'grace-period', 'reclaimed']) {
  const example = stateExamples.find((example) => example.id === id);
  assert.ok(example, `Missing unavailable-action example: ${id}`);
  assert.ok(!example.actions && !example.milestoneActions, `${id} must not offer an unavailable action`);
}
const alreadyEndorsed = stateExamples.find(({ id }) => id === 'start-endorsed');
assert.ok(!alreadyEndorsed.milestoneActions, 'Already-endorsed milestone must not offer duplicate milestone actions');
assert.ok(alreadyEndorsed.actions.includes('Propose contractor address'), 'Committee member must retain contractor-change access');
for (const [prefix, countKey, button] of [
  ['start', 'endorsements', 'Endorse proposed start'],
  ['completion', 'endorsements', 'Endorse proposed completion'],
  ['contractor', 'contractorEndorsements', 'Endorse proposed address'],
]) {
  for (const count of [1, 2]) {
    assert.ok(stateExamples.some((example) => example.id.startsWith(`${prefix}-`)
      && example[countKey] === count && `${example.actions || ''}${example.milestoneActions || ''}`.includes(button)),
    `Missing ${prefix} action with ${count} recorded endorsement(s)`);
  }
  const endorsed = stateExamples.find(({ id }) => id === `${prefix}-endorsed`);
  assert.ok(endorsed?.[countKey] > 0, `Already-endorsed ${prefix} must retain its recorded count`);
  assert.ok(!`${endorsed.actions || ''}${endorsed.milestoneActions || ''}`.includes(button),
    `Already-endorsed ${prefix} must hide its endorsement button`);
}
for (const hook of ['dao-project-info-recipient-change', 'proposal-lifecycle-action-group', 'proposal-vote-current-section', 'proposal-result-meter-track', 'proposal-result-overview', 'proposal-committee-vote-list', 'dao-project-ballot', 'proposal-info-row--accept', 'proposal-info-row--rejected', 'proposal-vote-weight-percent', 'proposal-vote-requirement-value']) {
  assert.ok(productionJs.includes(hook) || productionCss.includes(hook), `Production rendering hook missing: ${hook}`);
  assert.ok(stateMarkup.includes(hook), `State gallery rendering hook missing: ${hook}`);
}
assert.ok(projectsMarkup.includes('Review Project Proposal'), 'Confirmation must use the runtime project title');
assert.ok(projectsMarkup.includes('Signing submits this project proposal for review.'), 'Confirmation must explain project signing');

assert.ok(!projectsMarkup.includes('Project submission unavailable'), 'Project signing must reflect the closeout-actions branch');
assert.ok(mockHtml.includes('data-showcase-tab="projects">Proposals</button>'));
assert.ok(mockHtml.includes('<script src="./proposal-states.js"></script>'));

const accountPanelStart = mockHtml.indexOf('id="showcase-panel-account"');
const accountPanelEnd = mockHtml.indexOf('id="showcase-panel-chat"');
assert.ok(accountPanelStart >= 0 && accountPanelEnd > accountPanelStart, 'Account panel is unavailable');
const accountMarkup = mockHtml.slice(accountPanelStart, accountPanelEnd);
for (const accountHook of [
  'welcome-version',
  'sign-in-account-avatar',
  'sign-in-account-section',
  'create-account-advanced',
  'create-account-option',
]) {
  assert.ok(
    productionHtml.includes(accountHook) || productionJs.includes(accountHook) || productionCss.includes(accountHook),
    `Production account hook is unavailable: ${accountHook}`,
  );
  assert.ok(accountMarkup.includes(accountHook), `Mock account hook is unavailable: ${accountHook}`);
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
assert.ok(productionJs.includes("const directionText = item.my ? '-' : '+';"), 'Production payment direction logic is unavailable');
assert.ok(
  mockHtml.includes('<div class="message received payment-info"><div class="payment-header"><span class="payment-direction">+</span><span class="payment-amount">18.400000 LIB</span>'),
  'Mock received payment must retain the production payment bubble structure',
);
assert.ok(mockHtml.includes('class="attachment-thumbnail"'), 'Mock loaded image thumbnail is unavailable');
assert.ok(mockHtml.includes('Preview has not downloaded yet.'), 'Mock image placeholder state is unavailable');
for (const imageViewerHook of [
  'id="fullImageModal"',
  'class="full-image-viewer-image"',
  'class="full-image-zoom-controls"',
]) {
  assert.ok(productionHtml.includes(imageViewerHook), `Production full-image hook is unavailable: ${imageViewerHook}`);
  assert.ok(mockHtml.includes(imageViewerHook), `Mock full-image hook is unavailable: ${imageViewerHook}`);
}

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
