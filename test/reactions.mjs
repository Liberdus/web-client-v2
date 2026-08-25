/**
 * The reaction state machine, against both containers that use it.
 *
 * These functions were lifted out of app.js so group chat could share them.
 * The extraction was byte-identical, so this is not testing new logic -- it is
 * pinning the behaviour 1:1 already depends on, so a later change for groups
 * cannot quietly alter it.
 *
 * The group cases matter as much as the 1:1 ones: a group view is just another
 * container with .messages and .reactions, and that equivalence is the whole
 * reason the code could move.
 *
 *   node test/reactions.mjs
 */
import * as R from '../reactions.js';
let pass=0, fail=0;
const ck=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?pass++:fail++;
  console.log((ok?'ok  ':'FAIL')+'  '+n+(ok?'':`  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`))};

const A='0x'+'a'.repeat(40), B='0x'+'b'.repeat(40);
const mk=()=>({ messages:[{txid:'m1',my:false},{txid:'m2',my:true}], reactions:[] });

// --- set ---
let c=mk();
ck('set applies', R.applyIncomingReaction(c,{sender:A,reactId:'m1',action:'set',emoji:'👍',timestamp:100,reactionTxId:'r1'}), true);
ck('  one chip stored', c.reactions.length, 1);
ck('  same reactionTxId is idempotent', R.applyIncomingReaction(c,{sender:A,reactId:'m1',action:'set',emoji:'👍',timestamp:100,reactionTxId:'r1'}), false);
ck('  still one chip', c.reactions.length, 1);

// --- change replaces, does not stack ---
ck('changing emoji applies', R.applyIncomingReaction(c,{sender:A,reactId:'m1',action:'set',emoji:'❤️',timestamp:200,reactionTxId:'r2'}), true);
ck('  still one chip for that sender', c.reactions.filter(r=>r.emoji).length, 1);
ck('  and it is the new emoji', c.reactions.find(r=>r.emoji)?.emoji, '❤️');

// --- two senders coexist ---
R.applyIncomingReaction(c,{sender:B,reactId:'m1',action:'set',emoji:'😂',timestamp:300,reactionTxId:'r3'});
ck('two senders on one target', R.getContactReactionsForTarget(c,'m1').length, 2);

// --- remove ---
ck('remove applies', R.applyIncomingReaction(c,{sender:A,reactId:'m1',action:'remove',timestamp:400,targetReactionTxId:'r2',reactionTxId:'r4'}), true);
ck('  removing again is a no-op', R.applyIncomingReaction(c,{sender:A,reactId:'m1',action:'remove',timestamp:500,targetReactionTxId:'r2',reactionTxId:'r5'}), false);
ck('  the other sender survives', R.getContactReactionsForTarget(c,'m1').length, 1);

// --- out-of-order arrival ---
let c2=mk();
R.applyIncomingReaction(c2,{sender:A,reactId:'m1',action:'set',emoji:'❤️',timestamp:900,reactionTxId:'x2'});
ck('an older set does not override a newer', R.applyIncomingReaction(c2,{sender:A,reactId:'m1',action:'set',emoji:'👍',timestamp:100,reactionTxId:'x1'}), false);
ck('  newest wins', R.getEffectiveReactionForSenderTarget(c2,'m1',A)?.emoji, '❤️');

// --- soft delete is 1:1-only, and injected ---
let c3=mk();
ck('group container: no isDeleted, target counts as live',
   R.applyIncomingReaction(c3,{sender:A,reactId:'m1',action:'set',emoji:'👍',timestamp:100,reactionTxId:'d1'}), true);
let c4=mk();
ck('1:1 container: a deleted target is refused',
   R.applyIncomingReaction(c4,{sender:A,reactId:'m1',action:'set',emoji:'👍',timestamp:100,reactionTxId:'d2'},
     {isDeleted:()=>true}), false);

// --- unknown target ---
ck('a reaction to an unheld message is refused',
   R.applyIncomingReaction(mk(),{sender:A,reactId:'nope',action:'set',emoji:'👍',timestamp:1,reactionTxId:'z'}), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
