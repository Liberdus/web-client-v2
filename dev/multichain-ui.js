/**
 * Harness for the Multichain wallet screen.
 *
 * The app cannot be signed into in every environment, but this screen is worth
 * seeing rendered, so the harness lifts the actual nodes out of index.html and
 * runs the real controller against them. Nothing here reimplements the markup:
 * if index.html changes, this follows.
 *
 * The only fiction is the signed-in account.
 */

import { multichain } from '../intents-ui.js';
import { intentsAssets, intentsAccountIdForAddress } from '../intents-assets.js';

const NODE_IDS = ['openMultichain', 'multichainSummary', 'multichainModal', 'multichainAssetModal'];

let address = document.getElementById('harnessAddress').value.trim();

async function mount() {
  const html = await (await fetch('../index.html')).text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const frame = document.getElementById('harnessFrame');

  for (const id of NODE_IDS) {
    const node = parsed.getElementById(id);
    if (!node) {
      frame.insertAdjacentHTML('beforeend', `<p style="color:#c00">index.html has no #${id}</p>`);
      continue;
    }
    frame.appendChild(document.importNode(node, true));
  }

  // The menu item is an <li>; give it somewhere sane to sit.
  const menuItem = document.getElementById('openMultichain');
  if (menuItem) {
    const list = document.createElement('ul');
    list.className = 'menu-list';
    list.style.margin = '12px 0';
    menuItem.replaceWith(list);
    list.appendChild(menuItem);
  }

  // Same call app.js makes, so this harness exercises the real wiring.
  multichain.configure({ getAccount: () => (address ? { keys: { address } } : null) });
  multichain.load();
  await multichain.updateSummary({ refresh: true });
}

document.getElementById('harnessApply').addEventListener('click', async () => {
  address = document.getElementById('harnessAddress').value.trim();
  intentsAssets.reset();
  if (intentsAccountIdForAddress(address)) {
    await multichain.updateSummary({ refresh: true });
  } else {
    // Dev-only: lets the harness point at a funded NEAR account id so the
    // populated list can be seen. The app itself only ever has an address.
    intentsAssets.activateAccount(address);
    await intentsAssets.fetchPortfolio(address);
    await multichain.updateSummary();
  }
});

document.getElementById('harnessOpen').addEventListener('click', () => {
  multichain.assetsModal.open();
});

mount();
