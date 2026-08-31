/**
 * When a change in the pending-join count is worth acting on.
 *
 * An admin watching Group info should see a request appear the moment it
 * arrives -- and vanish when the requester withdraws it -- but should not be
 * interrupted by news that is not new. The two consumers want different
 * answers, which is the whole reason this is a separate function.
 *
 *   node test/join-count-signal.mjs
 */
import { joinCountDelta } from '../groupManager.js';

let pass = 0, fail = 0;
const chk = (n, ok, d = '') => {
  if (ok) { console.log(`  \x1b[32m✓\x1b[0m ${n}`); pass++; }
  else { console.log(`  \x1b[31m✗\x1b[0m ${n}${d ? '\n      ' + d : ''}`); fail++; }
};

console.log('\n\x1b[1mPending join count signal\x1b[0m\n');

// --- a request arriving --------------------------------------------------
let d = joinCountDelta(0, 1);
chk('a new request changes', d.changed === true);
chk('  and counts as an increase', d.increased === true);

d = joinCountDelta(2, 5);
chk('several arriving at once still reads as one increase', d.changed && d.increased);

// --- a request leaving ---------------------------------------------------
d = joinCountDelta(1, 0);
chk('a withdrawn request changes', d.changed === true, 'the open page must drop the stale row');
chk('  but does not interrupt', d.increased === false, 'nothing new wants attention');

d = joinCountDelta(3, 1);
chk('two approved at once changes without interrupting', d.changed && !d.increased);

// --- nothing happening ---------------------------------------------------
d = joinCountDelta(2, 2);
chk('an unchanged count is silent', d.changed === false && d.increased === false);

d = joinCountDelta(0, 0);
chk('zero to zero is silent', d.changed === false);

// --- the first look ------------------------------------------------------
// On a fresh load every group reports its standing count at once. Treating
// that as news would announce requests that have been there for days.
d = joinCountDelta(undefined, 3);
chk('a first observation is not news', d.known === false && d.changed === false && d.increased === false);

d = joinCountDelta(undefined, 0);
chk('a first observation of nothing is not news either', d.changed === false);

// --- a server that says nothing ------------------------------------------
d = joinCountDelta(2, undefined);
chk('a missing count from the network is ignored', d.known === false && d.changed === false);

d = joinCountDelta(null, 2);
chk('a null previous is not treated as zero', d.changed === false, 'null would otherwise read as an increase');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
