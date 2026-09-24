// Lifts the multichain screens out of index.html when the page loads.
//
// A harness that carries its own copy of the markup agrees with whatever
// mistake was copied into it -- that is how a broken panel once shipped past
// one. Fetching the file the app itself serves means there is no copy to drift.

import { installModalTransitionListeners } from '../lib.js';

export const MULTICHAIN_SCREEN_IDS = Object.freeze([
  'multichainModal',
  'multichainAssetModal',
  'multichainReceiveModal',
  'multichainWithdrawModal',
  'multichainSwapModal',
  'chatSendContactModal',
  'chatSendModal',
  'multichainTokenPickerModal',
  'multichainConfirmModal',
]);

/**
 * Mounts every multichain modal inside a `.container`, as the app does.
 *
 * The container matters: its `text-align: center` cascades into every screen,
 * and a harness that mounts without it cannot show that trap (DESIGN.md §6).
 */
export async function mountMultichainScreens(host = document.body) {
  const html = await (await fetch('../index.html', { cache: 'no-store' })).text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  const container = document.createElement('div');
  container.className = 'container';
  const missing = [];
  for (const id of MULTICHAIN_SCREEN_IDS) {
    const node = parsed.getElementById(id);
    if (node) container.appendChild(document.importNode(node, true));
    else missing.push(id);
  }

  // load() wires the wallet screen's two entry points, which a harness has no
  // wallet screen to hold.
  for (const id of ['openMultichain', 'multichainSummary']) {
    if (document.getElementById(id)) continue;
    const stub = document.createElement('button');
    stub.id = id;
    stub.hidden = true;
    container.appendChild(stub);
  }

  host.prepend(container);
  // What app.js does at startup. Without it openModal never hears a
  // slide-in end and holds its lock for the full 1s fallback on every open,
  // which hides timing bugs behind a delay the app does not have.
  installModalTransitionListeners();
  if (missing.length) throw new Error(`index.html has no #${missing.join(', #')}`);
  return container;
}
