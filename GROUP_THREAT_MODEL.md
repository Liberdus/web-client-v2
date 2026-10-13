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
- **Handshakes.** Commits are MLS **private** messages posted with
  `group_commit`. The server cannot read them. It enforces an epoch fence
  (`tx.epoch === group.epoch`) and checks the sender's **declared**
  `addedMembers` / `removedMembers` against admin rights, consent rules and the
  key-package pool. It stores the ratchet tree as opaque nodes
  (`GroupTreeAccount`) and parks Welcomes for added members.
- **Post-quantum layer.** The suite is X-Wing (hybrid). On top, each commit that
  adds members carries an external PSK from a deterministic ratchet
  (`psk[n] = KDF(psk[n-1])`), sealed to each new member's ML-KEM key.
- **Messages.** `group_message` appends ciphertext to the `GroupAccount`
  transcript. Only roster members may post; one message per member per second;
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
| T7 | A2, A7 | Bloat the `GroupAccount`: 500 messages × 64 kB is up to ~32 MB, plus 50 handshakes and a ~112 kB tree, on one sharded account. | Size, count and retention caps; 1 s per-member interval; network fee. | **Unreviewed.** Needs the Shardus account-size limits and the cost to fill. |
| T8 | A7 | Fill the 100 pending join-request slots so real requests are refused. | Network fee; escrow equals the join fee, which is 0 today. | **Likely broken** while the join fee is 0. |
| T9 | A3, A7 | Take or trap funds: escrow vs approval vs reclaim races, vesting when an admin is removed or leaves, repair-deposit accounting, maintenance balance spending. | Rules in `group_join_request`, `group_commit` apply, `group_fee_claim`, `group_join_reclaim`, `group_maintenance_fund`. | **Unreviewed.** Highest priority for the review: money. |
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
3. T9: review the money paths.
4. T8, T7: price the spam and bloat attacks; adjust caps or fees.
5. T10, T11, T5: gateway trust, local encryption, the leaf-identity check.

Tests to add as each lands: a leave-is-effective test for T3, a
malformed-commit test for T2, and server tests for the money rules in T9.
