/**
 * When the client says a group's upkeep is running low.
 *
 * The network pays a repair commit out of the group's maintenance balance so
 * the member who happens to perform it is not charged. When that balance runs
 * out the fee lands on that member instead, so the warning has to arrive before
 * the balance is gone, not after.
 *
 * Two things are easy to get wrong and are pinned here: the threshold is
 * measured against the fee RIGHT NOW rather than whatever it was when the
 * deposits were made, and a client that does not yet know the fee says nothing
 * instead of guessing.
 *
 *   node test/maintenance-health.mjs
 */
import { initGroupManager, maintenanceHealth } from '../groupManager.js';

let pass = 0,
  fail = 0;
const chk = (n, ok, d = '') => {
  if (ok) {
    console.log(`  \x1b[32m✓\x1b[0m ${n}`);
    pass++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${n}${d ? '\n      ' + d : ''}`);
    fail++;
  }
};

const FEE = 10n ** 16n;

/** Re-inits the module with a given fee, since the fee is read from deps. */
const withFee = (fee) =>
  initGroupManager({
    getTransactionFeeWei: () => fee,
    getMyData: () => ({ groups: {} }),
    getMyAccount: () => ({ keys: { address: '0'.repeat(64) } }),
  });

const view = (balance, memberCount) => ({
  maintenanceBalance: String(balance),
  members: Array.from({ length: memberCount }, (_, i) => `m${i}`),
});

console.log('\n\x1b[1mGroup upkeep health\x1b[0m\n');

withFee(FEE);

// --- the threshold is one fee per member ------------------------------------
let h = maintenanceHealth(view(FEE * 5n, 5));
chk('exactly one fee per member is not low', h.low === false, `balance=${h.balance} needed=${h.needed}`);

h = maintenanceHealth(view(FEE * 5n - 1n, 5));
chk('one wei under is low', h.low === true);

h = maintenanceHealth(view(FEE * 50n, 5));
chk('a comfortable balance is not low', h.low === false);

// --- empty is called out separately -----------------------------------------
h = maintenanceHealth(view(0n, 5));
chk('an empty balance is low', h.low === true);
chk('  and reported as empty', h.empty === true);

h = maintenanceHealth(view(FEE * 2n, 5));
chk('a partly funded balance is low but not empty', h.low === true && h.empty === false);

// --- the threshold tracks the CURRENT fee -----------------------------------
// The same balance that was ample at one fee is not at a higher one; a figure
// captured when the deposits were made would miss this entirely.
withFee(FEE);
const ample = view(FEE * 5n, 5);
chk('ample at the old fee', maintenanceHealth(ample).low === false);
withFee(FEE * 2n);
chk('the same balance is low once the fee doubles', maintenanceHealth(ample).low === true);

// --- an unknown fee says nothing --------------------------------------------
withFee(0n);
h = maintenanceHealth(view(0n, 5));
chk('no fee figure means no warning', h.low === false && h.empty === false);

initGroupManager({
  getTransactionFeeWei: () => {
    throw new Error('network parameters not loaded');
  },
  getMyData: () => ({ groups: {} }),
  getMyAccount: () => ({ keys: { address: '0'.repeat(64) } }),
});
h = maintenanceHealth(view(0n, 5));
chk('a throwing fee lookup does not crash the banner', h.low === false);

// --- shape tolerance --------------------------------------------------------
withFee(FEE);
chk('a view with no balance field reads as zero', maintenanceHealth({ members: ['a'] }).balance === 0n);
chk('a view with no members needs nothing', maintenanceHealth({ maintenanceBalance: '0' }).needed === 0n);
chk('an undefined view does not throw', maintenanceHealth(undefined).balance === 0n);
chk('a malformed balance reads as zero', maintenanceHealth({ maintenanceBalance: 'abc', members: ['a'] }).balance === 0n);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
