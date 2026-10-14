# Group chat — threat model

What group chat protects, from whom, and where each protection lives. It
covers both halves: this client (`groupManager.js`, `mlsEngine.js`,
`mlsStore.js`, `groupUI.js`, `chatRender.js`) and the group transactions in
`liberdus-server` (`src/transactions/group_*.ts`, `src/api/group/group.ts`).

Status words used below:

- **Holds** — checked by a test or by reading code that leaves no gap.
- **Broken** — shown by a failing test.
- **Likely broken** — code reading finds no protection; not yet shown by a test.
- **Unreviewed** — not examined yet.

## 1. What we protect

| # | Asset | The promise |
|---|---|---|
| S1 | Message content | Only current members can read a group's messages. |
| S2 | Membership | The roster the app shows is exactly the set of people who can read. |
| S3 | Admin authority | Only admins add or remove members. |
| S4 | Sender authenticity | A message shown as from X was written by X. |
| S5 | Funds | Join escrow, vested join fees, the maintenance balance and repair deposits go only where the rules say. |
| S6 | Availability | A group keeps working; one member cannot stop everyone else using it. |
| S7 | Account resources | Being in, or near, a group cannot drain an account's balance or key packages without consent. |
| S8 | Local secrets | MLS state on a device is as protected as the rest of the account. |

Not promised: hiding **who is in which group**. Rosters, admins, join requests
(including their message text), message timing and sizes are public on chain by
design. Section 5 lists that leakage so it stays a decision, not an accident.

## 2. How the system works, briefly

- **Identity.** An account's MLS signature key derives from its `pqSeed`; the
  credential identity is the account address. Key packages are published on
  chain (`group_keypackage_publish`) and consumed one per add.
- **Handshakes.** Commits are MLS **PublicMessages** posted with
  `group_commit`: the proposals are readable, the UpdatePath stays encrypted.
  The server enforces an epoch fence (`tx.epoch === group.epoch`), checks the
  real adds and removes against the declared ones, admin rights, consent rules
  and the key-package pool (`src/utils/mlsCommit.ts`), then replays the commit
  to verify its signature and compute the ratchet tree it stores
  (`src/utils/mlsTree.ts`, on the `GroupTreeAccount`). It parks Welcomes for
  added members and keeps each commit's GroupInfo as the recovery checkpoint.
- **Post-quantum layer.** The suite is X-Wing (hybrid). On top, each commit that
  adds members carries an external PSK from a deterministic ratchet
  (`psk[n] = KDF(psk[n-1])`), sealed to each new member's ML-KEM key.
- **Messages.** `group_message` appends ciphertext to the `GroupAccount`
  transcript. Only roster members may post; one message per member per second;
  at most 4 kB each (the client caps text at 1,000 bytes, ~2 kB encrypted);
  7-day / 500-message retention.
- **Reading.** Every endpoint under `/group/:id` is a public GET. Anyone can
  fetch the ciphertext; reading it needs the group keys.
- **Money.** `group_join_request` escrows the join fee; approval vests it to the
  approving admin (`group_fee_claim`); `group_join_reclaim` returns it.
  `group_maintenance_fund` tops up a balance that only pays for tree-repair
  commits. Adding a member charges the admin a repair deposit.

Trust boundaries: the device (client code and local storage), the network
(validators reach consensus; a single gateway answers each query), and the
other members of each group.

## 3. Adversaries

| # | Who | Can | Cannot |
|---|---|---|---|
| A1 | Outsider | Read everything public; submit signed transactions from their own account; publish key packages | Sign as another account |
| A2 | Malicious member | Everything A1 can, plus build any valid MLS message from their leaf, and post commits and messages | Sign as another member |
| A3 | Malicious admin | Everything A2 can, plus declared adds and removes | — |
| A4 | Former member | Keep whatever state they held when they left or were removed | — |
| A5 | Dishonest gateway | Withhold, delay, replay or alter **query responses** to one client | Forge signed transactions; break consensus (assumed honest majority) |
| A6 | Device attacker | Read browser storage on an unlocked or stolen device | — |
| A7 | Funded spammer | Pay fees at scale | — |

## 4. Threats

| ID | Adversary | Threat | Protection today | Status |
|---|---|---|---|---|
| **T1** | A2 | A non-admin secretly **adds** an outsider or **removes** a member by committing proposals that do not match the declared lists. | **Prototype:** commits are PublicMessages; `group_commit` validate reads them (`src/utils/mlsCommit.ts`) and refuses any whose real adds/removes differ from the declaration, whose sender leaf is not `tx.from`, or whose real change needs an admin. Clients also check every commit against the network's record before applying it (`groupCommitCheck.js`, called by `mlsEngine.applyCommit`). | **Fixed in prototype, not deployed.** Server: `test/groupCommitInspection.test.ts`. Client: `test/commit-authority.mjs`, now part of `npm run test:mls`. |
| **T2** | A2 | Post a commit no client can apply (malformed, or valid MLS that fails for others). Every member stops at that epoch (`applyFailedAtEpoch`), and the only way back is a reset plus a fresh Welcome from an admin. | **Prototype:** non-MLS bytes, private-message commits, wrong group or epoch, foreign sender leaf, references and disallowed proposal types are refused (`inspectCommit`). The network also tracks each epoch's GroupContext from the public commits (`GroupTreeAccount.transcript`) and verifies every commit's signature against it and the sender's leaf, as members do (`replayCommit`). It also refuses a commit whose declared pskId differs from its PSK proposal. What it still cannot check is the encrypted path secrets and the PSK value, which need the group's secrets: a member can sign a well-formed commit nobody else can apply. **Recovery:** a stuck member rejoins at the latest epoch by external commit from the checkpoint (RFC 9420 s12.4.3.2; `mlsEngine.resync`, behind the existing **Fix this** button), stepping their PSK by the network's count of PSK commits. No other member is needed. | **Fixed in prototype, not deployed.** `test/groupTreeReplay.test.ts` (signature, rejoin); `test/resync.mjs` (a member's unappliable commit, both honest members rejoin, the admin removes the attacker); end to end with the real client in the browser. |
| **T3** | A4 | A member who **leaves** keeps reading. `group_leave` updates the roster but is not cryptographically effective, and nothing committed the MLS Remove; the network only let admins remove, and only members still on the roster. | **Prototype:** any member may commit the Remove of a departed leaf (an address with a leaf but off the roster), and the group's upkeep balance pays for it; removing a roster member is still an admin's call, and a leaver's vesting join fee is not refunded by the removal. Clients detect departed leaves after each sync, and the member with the lowest leaf on the roster removes them; anyone may after a two-minute grace period (`groupDeparture.js`). | **Fixed in prototype, not deployed.** `test/leave-effective.mjs` (the gap shown, then closed), server tests for the non-admin removal and the fee, end to end in the browser. The leaver can read until the Remove lands: seconds when the designated member is online, the grace period otherwise. |
| T4 | A4 | A member who is **removed** keeps reading. | A Remove commit rotates the epoch secrets. | **Holds** — `test/removal-effective.mjs`. Note: the PQ PSK ratchet is deterministic, so a removed member can compute later PSKs. After removal, PQ protection rests on X-Wing alone. |
| T5 | A2, A5 | Present a message as from someone else. | `tx.from` is signed by the account; `decryptMessage` requires `payload.from === record.from`. The MLS sender leaf's credential is **not** compared with `record.from`. | Holds for A2. The leaf check needs a one-line bundle patch: ts-mls does not return the sender of an application message. |
| T6 | A3 | Pull an account into a group it never asked for, spending its key packages. | Join requests act as consent; `addPolicy` defaults to `contacts`; blocked accounts are refused. | Holds for **declared** adds. A hidden add (T1) reaches no Welcome on chain, so it cannot actually join the victim. |
| T7 | A2, A3, A7 | Bloat a group's accounts until they cannot move between nodes. Every `group_message` and `group_commit` carries the `GroupAccount`, and `group_commit` the `GroupTreeAccount` too; Liberdus caps one internal message at 10 MB (`payloadSizeLimitInBytes`; lib-net drops anything larger), and a joining node syncs accounts 50 to a page, by count, not size. An account past the limit can never be transferred again, so it can never be pruned or used: the group is dead, and the nodes that sync its address range are blocked. At 64 kB per message, a one-member group got its `GroupAccount` there with ~155 messages: **$1.55** in fees, three minutes at 1 message/s. The group's address is a hash of its creator and a chosen nonce, so several large accounts can also be placed in one sync page. | **Prototype:** (1) group messages are capped at 4 kB (`groupAppMessageSizeLimit`), twice the largest the client sends; commits, key packages and `meta` keep 64 kB. A full `GroupAccount` is now 2.25 MB (was ~33 MB). The client caps a draft at 1,000 bytes as 1:1 does, measured as JSON-encoded so that no characters encrypt past 4 kB (worst case 2.2 kB), with 1:1's counter. (2) Free padding of the tree account is closed: a commit's `meta`, `pskId`, `pskNonce` and each welcome's `pskId`, `pskNonce` and `sealedPsk.ct` now count toward its 64 kB; `proposals` must be empty and a welcome's `ratchetTree` empty (neither was read; both were stored); a pending welcome stores named fields only (a spread kept any extra keys); a commit may not carry MLS `authenticated_data`, nor a `pskNonce` without a `pskId`. (3) Tree nodes are capped at 3 kB encoded (`MAX_TREE_NODE_BYTES` in `mlsTree.ts`, checked on the computed tree, so it covers leaves from key packages and UpdatePaths and parent nodes), about twice the honest leaf (~1,470 B) and parent (~1,290 B plus 4 B per unmerged leaf); key packages are refused at publish past 6 kB of base64 (honest: 3,612). (4) The handshakes and the welcome snapshots, each with its welcomes, share a 3 MB budget (`groupTreeHistoryBudgetBytes`); past it the oldest goes first, by the commit that wrote it, never the commit just recorded or the snapshot it just took. A member who needed a dropped commit rejoins from the checkpoint ("Fix this"); an invitee whose snapshot went must be added again, as after 50 epochs before. An ordinary group stays far under it. Worst case now: GroupTreeAccount ~3.5 MB (budget, a live tree of at most ~400 kB, checkpoint, join requests) plus GroupAccount 2.25 MB, so a `group_commit` carries about 6 MB with its user accounts, inside the 10 MB limit. | **Fixed in prototype, not deployed.** Server: `test/groupAccountSize.test.ts` (fills a group through the real apply and measures the serialized account; each padding route), two cases in `test/groupCommitInspection.test.ts`; all fail on the old code. Tree account: `test/groupTreeReplay.test.ts` (a padded leaf by add and by path update is refused; on the old code the network's own replay accepted both), the budget cases in `test/groupAccountSize.test.ts` (30 uncollected invitations against a 300 kB tree: 9.3 MB before, under the budget now). Client: `test/group-message-size.mjs`. Measured with a real 50-member group: the tree is 105 kB; before the budget, up to 50 snapshots of it were kept for uncollected welcomes (~5 MB) beside 50 handshakes of up to 64 kB. **Found in passing, not T7:** commits near 50 members can exceed the 64 kB commit limit honestly (a path update over a tree of unmerged leaves measured 90.7 kB; the client copies one 18.5 kB Welcome into each of 10 envelopes, so a 10-member add is ~220 kB). **Out of scope:** 1:1 `ChatAccount`s hold 500 × 100 kB with no send interval, the same attack on `main`; and sync paging by count is a shardus-core problem that caps alone cannot close. |
| T8 | A7 | Fill the 100 pending join-request slots so real requests are refused. Requests never expired (`groupJoinRequestTimeoutMs` was unused), an admin could neither decline nor block, and while the join fee is 0 one fee held a slot for good. | **Prototype:** requests expire after `groupJoinRequestTimeoutMs` (7 days): an expired one stops counting toward the cap, cannot be approved (its escrow is refunded instead of vested), and without escrow is pruned whenever the tree is written; asking again replaces your own expired request. Admins decline up to ten requests per `group_join_decline`, refunding their escrow, from a Decline button beside Approve. Requesters are told when they were declined or their request expired. | **Fixed in prototype, not deployed.** `liberdus-server test/groupJoinRequestLimits.test.ts`; UI checked in `dev/group-ui-harness.html`. Holding a slot now costs a fee a week, and an admin clears a flood for one fee per ten. Not done: blocking (`group.blocked` is enforced but nothing writes it); against throwaway accounts it adds little. |
| T9 | A3, A7 | Take or trap funds: escrow vs approval vs reclaim races, vesting when an admin is removed or leaves, repair-deposit accounting, maintenance balance spending. | Reviewed every path (join request, reclaim, approval, vesting, removal refund, fee claim, repair deposit, upkeep top-up and spending). Races between reclaim and approval are ordered by the shared tree account; a fee is paid out at most once (refund before vesting, claim after); escrow and fees are bigint-safe. **Fixed:** (1) leave, be let back in, be removed before the first fee vests, and the forfeited first fee was refunded too -- refunds now cover only fees granted during the membership that is ending (`grantedAt`); (2) a refund with no account to pay dropped the vesting entry, destroying the money -- it now stays and vests to the admin; (3) a requester with nothing but their escrow could not reclaim it -- the escrow now pays its own fee. | **Fixed in prototype, not deployed.** `liberdus-server test/groupJoinFeeMoney.test.ts` runs each flow through the real apply() and checks only transaction fees leave; the three fix tests fail on the old code. **Decided (2026-10-13):** the maintenance balance has no way out -- it can only burn fees on repairs, so nothing can redirect or drain it, at the cost of stranding it if the group dies. **Decided (2026-10-13), deferred until paid groups ship:** a group has exactly one admin (there is no promotion; the admin can only leave, and the longest-standing member succeeds them), so an admin cannot be removed and the only open case is an admin leaving while fees they approved are still vesting. Those fees will go back to the members who paid them: on leave, each is re-pointed from the admin to its member and made claimable at once through `group_fee_claim`. With one admin nobody else can trigger this, so it has no third-party abuse, and it closes "approve, leave, collect". Cost: `group_leave` must then name the tree account in keys(). Known limit either way: a single admin can approve, wait out the 7-day vest and then remove the member, keeping the fee; nothing but the vesting length and the members' trust in that admin protects against that. |
| T10 | A5 | One gateway lies about a group: a fake roster or admin list, withheld commits or messages, a replayed old state. | Clients mostly trust query responses. Commits and messages cannot be forged without member keys. | **Unreviewed.** Withholding is availability only; a fake roster misleads the UI (and matters more once T1's fix compares against it). |
| T11 | A6 | Read MLS epoch secrets from IndexedDB (`liberdus-mls`) even when the app is locked. | None; `mlsStore` writes plaintext. | **Likely broken** if app lock is meant to cover groups. |
| T12 | A2 | Two tabs fork the same group state. | Web Locks serialise mutation per group; one IndexedDB transaction per applied item. | Holds by design; not separately tested. |
| T13 | A2 | Inject markup through names, messages or attributes. | All values escaped; group attributes fixed during the rebase onto main. | Holds after `Escape group message and member attributes like 1:1 rendering`. |
| T14 | A2 | Reuse of the last-resort key package weakens post-compromise security. | RFC 9420 caveat, documented in `group_keypackage_publish`. | Accepted risk; revisit if pools run dry often. |
| T15 | A2 | Poison the stored ratchet tree. The server built it from client-supplied `treeDelta` without checking it against the commit, so a member could write leaves that do not match the real tree. New members then fail to join (ts-mls checks the tree hash), and the T1 check, which reads leaf identities from this tree, could be misled. | **Prototype:** `group_commit` apply replays each commit on the stored tree with ts-mls's own steps (`src/utils/mlsTree.ts`), stores the computed tree, and refuses the commit if the client's baseline or delta describes a different one. The founding tree takes only the founder's own leaf on trust. | **Fixed in prototype, not deployed.** `test/groupTreeReplay.test.ts`: the network's tree equals what members hold after the same commit; a poisoned delta and a forged founding leaf are refused. |
| T17 | A2 | Take over another member's address. The new leaf in a commit's UpdatePath is self-signed, and ts-mls's default authentication service accepts any credential, so a member can re-key their leaf under another member's address and clients accept it. | **Prototype:** the server refuses a commit whose UpdatePath leaf does not carry `tx.from`, in validate (`inspectCommit`) and again in the replay; clients refuse it in `groupCommitCheck.js`. | **Fixed in prototype, not deployed.** `test/groupTreeReplay.test.ts`, `test/commit-authority.mjs`. |
| T19 | A1, A3 | Join under someone else's name. `group_keypackage_publish` does not parse key packages, so an account can publish one naming another address; an admin who adds that account puts a leaf in the tree that every member's roster shows as the other person. | **Prototype:** the server refuses an add whose key package names anyone but the account being added (`inspectCommit`); clients match adds by the name inside the key package, so they refuse it too. | **Fixed in prototype, not deployed.** `test/groupCommitInspection.test.ts`, `test/commit-authority.mjs`. Publishing could also refuse such packages up front. |
| T20 | A6, — | A device's stored PSK is wrong (corrupted storage, a bug, tampering). Rejoining repairs MLS state but steps the stored PSK forward from its wrong value, so the device sticks again at the next commit that carries a PSK. | The banner escalates to **Reset and rejoin** when a rejoin fails, so the person is not left stuck. | **Open, low.** Not repairable on the device by design: the PSK is never sent in the clear, so only a fresh Welcome (being added back) restores it. |
| T18 | A2 | Recovering a member who fell behind. Clients sent `groupInfo: ''` on every commit, so the checkpoint for external rejoin was always empty. | **Prototype:** every commit publishes a GroupInfo with external_pub, and the network refuses one that does not describe the epoch it computed (context, confirmation tag, signer, signature). `GET /group/:id/checkpoint` returns it with the tree and the PSK count. Only the external_pub key is unverifiable; a bad one breaks the next rejoin for others, whose own rejoin then publishes a good one. | **Fixed in prototype, not deployed.** Rejoin is only accepted from accounts on the roster, swaps only the sender's own leaf, and is never paid for by the group's upkeep balance. |
| T16 | A2 | Send a proposal as an ordinary group message. The receiving client kept it in its MLS state, so its next commit bundled it by reference: an admin could be made to perform a member's hidden Remove. | **Prototype:** `decryptMessage` refuses non-application content without keeping the state; the server refuses commits carrying references. | **Fixed in prototype, not deployed.** Server case in `groupCommitInspection.test.ts`. |

## 5. Public by design (metadata)

On chain and readable by anyone: who is in each group and who administers it,
when each member joined, join requests **with their message text**, every
message's sender, timestamp, epoch and size, and each group's join fee and
balances. Group names are encrypted (`meta`, keyed from the epoch exporter).
Worth a deliberate decision: the join request message is plaintext and the
requester may not expect that.

## 6. Fixing T1 and T2

Both come from one gap: the network cannot see what a commit does.

**Option A — commits as MLS PublicMessage, checked by the server.** Proposals
become readable; the commit still carries an encrypted UpdatePath. The server
compares the real adds and removes with the declared lists and admin rights,
and checks the sender's signature against that sender's leaf in the stored tree.
That rejects T1 and the malformed half of T2 before anything lands. Membership
is already public on chain, so little new is revealed. Open questions: whether
ts-mls 1.6.2 can produce commits as PublicMessage with our PSK flow, and the
cost of parsing MLS on validators.

**Option B — clients refuse commits that do not match.** Replace `acceptAll`
with a check against the declared lists and the network admins. That stops
honest clients being fooled, but the bad commit is already on chain and MLS
cannot skip one, so every honest member is stuck behind it (T2 in another
form). It needs a recovery story — an admin re-adds everyone from a new epoch —
before it is acceptable on its own.

Recommendation: A, with B kept as a client-side assertion so a server bug
cannot silently reopen T1.

**Prototype status (A).** ts-mls 1.6.2 builds commits as PublicMessage with
`wireAsPublicMessage`, PSK proposals included; members apply them unchanged and
they are about the same size (6,510 B vs 6,486 B for a path update).
`liberdus-server` vendors the client's `external/ts-mls.js` byte for byte and
checks every commit in `group_commit` validate. The client sends public commits
(`COMMIT_WIRE` in `mlsEngine.js`). The network now also computes the tree
from each commit (T15), verifies every commit's signature, and clients check
each commit against the network's record (B). Not yet done: the
rollout -- groups whose
clients still send private commits stop being able to commit once the server
check is live, so client and server must ship together.

## 7. Order of work

1. T1/T2/T15/T17/T18/T19: public commits, the commit inspection, the tree
   replay, signature verification, the client's own check, checkpoints and
   rejoin are prototyped (section 6). Before release: decide the rollout, since
   none of this works with clients that send private commits.
2. T3 is prototyped: the Remove after a leave is committed automatically.
3. T9 is reviewed; three money bugs fixed (see its row).
4. T8 is prototyped (expiry and decline). T7 is prototyped: message and node
   size caps, commit padding closed, a byte budget on the tree account's
   history.
5. T10, T11, T5: gateway trust, local encryption, the leaf-identity check.

Tests to add as each lands: a leave-is-effective test for T3, a
malformed-commit test for T2, and server tests for the money rules in T9.
