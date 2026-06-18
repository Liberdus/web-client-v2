# DAO Mock Screen Flow And Needed Screens

This document maps the DAO UI that exists in the web client today, marks what is mock-only, and sketches screens that may need to be added for the full DAO policy flow.

## Legend

```text
[CURRENT MOCK]  Exists in the app today, backed by in-memory mock data.
[PARTIAL]       Exists, but only covers a small part of the policy requirement.
[NEEDED]        Not implemented as a screen yet.
[BACKEND]       Needs live network or indexer integration.
```

## Current Mock Entry Flow

```text
+-------------------------+
| Main App                |
| Chats / Contacts / ...  |
+-----------+-------------+
            |
            | Menu -> DAO
            | Note: DAO menu item is shown only on Devnet today.
            v
+-------------------------+
| [CURRENT MOCK] DAO List |
| Title: DAO - group/state|
|                         |
| [Active N] [Archived N] |
| Filter: status menu     |
|                         |
| #N Proposal title       |
| summary + state time    |
|                         |
|                    (+)  |
+------+-------------+----+
       |             |
       | tap row     | tap +
       v             v
+-------------------+     +-----------------------------+
| [CURRENT MOCK]    |     | [CURRENT MOCK] Add Proposal |
| Proposal Detail   |     |                             |
|                   |     | Title                       |
| #N / title / type |     | Type select                 |
| state / createdBy |     | Type-specific mock fields   |
| summary           |     | Summary                     |
| fields            |     |                             |
|                   |     | Submit -> creates           |
| If state=voting:  |     | state=discussion in memory  |
| [Yes] [No]        |     +-----------------------------+
| Yes: N / No: N    |
+-------------------+
```

## Current Mock Screens

### 1. DAO List

```text
+------------------------------------------------+
| <  DAO - Active - Voting                 [F]   |
+------------------------------------------------+
| [ Active 22 ] [ Archived 14 ]                  |
|                                                |
| #3 Adjust minimum transaction fee       9:10 AM|
| Change the minimum transaction fee...          |
|                                                |
| Empty state when no proposal matches filter:   |
| No proposals found                             |
| Use + to create a proposal                     |
|                                           (+)  |
+------------------------------------------------+
```

Status: `[CURRENT MOCK]`

What it does today:

- Opens from the main menu when `network.name === 'Devnet'`.
- Loads proposals through `daoRepo.refresh()`.
- Defaults to `Active` group and `Voting` status.
- Supports `Active` and `Archived` groups.
- Supports status filtering with counts.
- Sorts by newest `state_changed` timestamp.
- Uses mock data from `dao.mock-data.js`.

Mock-only notes:

- No backend endpoint is called.
- Data is held in module memory.
- Reloading the page resets the mock store.
- Archived is derived locally by age and status, not loaded from chain.

### 2. Status Filter Menu

```text
+------------------+
| Discussion 2     |
| Withheld 7       |
| Voting 1         |
| Rejected 1       |
| Accepted 2       |
| Applied 3        |
| Executing 1      |
| Terminated 0     |
| Completed 5      |
+------------------+
```

Status: `[CURRENT MOCK]`

What it does today:

- Filters the selected group by proposal state.
- Displays counts for the selected group.

Mock-only notes:

- Counts come from the in-memory mock store.
- There is no server-side pagination, search, or chain-backed count source.

### 3. Add Proposal

```text
+------------------------------------------------+
| <  Add Proposal                                |
+------------------------------------------------+
| Title                                          |
| [__________________________________________]   |
|                                                |
| Type                                           |
| [Project v]                                    |
|                                                |
| Type-specific mock fields                      |
| [Address]                                      |
| [Amount]                                       |
|                                                |
| Summary                                        |
| [__________________________________________]   |
| [__________________________________________]   |
|                                                |
| [Submit]                                      |
| [Cancel]                                      |
+------------------------------------------------+
```

Status: `[CURRENT MOCK]` / `[PARTIAL]`

What it does today:

- Creates an in-memory proposal.
- New proposals always start in `discussion`.
- Captures only a minimal type-specific field set.

Mock-only notes:

- No proposal fee.
- No transaction signing.
- No discussion-period enforcement.
- No committee review submission.
- No options editor; voting is implicitly Yes/No in the detail screen.
- No emergency proposal path.

### 4. Proposal Detail

```text
+------------------------------------------------+
| <  Proposal                                    |
+------------------------------------------------+
| Proposal #3                                    |
| Adjust minimum transaction fee                 |
| Type: Economic                                 |
| Voting - 6/15/2026, 9:10 AM - by carol        |
|                                                |
| Change the minimum transaction fee...          |
|                                                |
| minTxFee: 0.001                                |
| nodeRewards: unchanged                         |
|                                                |
| Vote                                           |
| [Yes] [No]                                     |
| Yes: 12 - No: 4                                |
+------------------------------------------------+
```

Status: `[CURRENT MOCK]` / `[PARTIAL]`

What it does today:

- Shows proposal number, title, type, state timestamp, creator, summary, and fields.
- Shows Yes/No voting controls only for `voting` proposals.
- Stores one current mock vote per local voter id.
- Clicking the selected vote again removes the mock vote.

Mock-only notes:

- Real DAO policy allows weighted ballots, additive votes, spend amount, time decay, and multiple options.
- Current mock voting is simple Yes/No integer counts.
- No vote eligibility check.
- No transaction confirmation.
- No audit trail.
- No reward claim information.
- No committee vote details.
- No grace period or apply action.

## Current Mock Data Shape

```text
daoRepo
  |
  +-- mode: mock
  +-- refresh()
  +-- getProposalsForUi(group)
  +-- createProposal()
  +-- castVote()
  |
  v
in-memory store
  |
  +-- meta
  +-- activeProposals[]
  +-- archivedProposals[]
  +-- proposals{proposalId}
```

Seeded mock proposal states:

```text
Active group:
  discussion  2
  withheld    7
  voting      1
  rejected    1
  accepted    2
  applied     3
  executing   1
  terminated  0
  completed   5

Archived group:
  14 seeded historical proposals after local age normalization
```

## Full Policy Flow With Needed Screens

```text
+-----------------------------+
| [NEEDED] DAO Home / Overview|
| active proposals            |
| reward pools                |
| parameters                  |
| my pending actions          |
+--------------+--------------+
               |
               v
+-----------------------------+
| [NEEDED] Discussion List    |
| potential proposals         |
| discussion timers           |
| comments / signals          |
+--------------+--------------+
               |
               v
+-----------------------------+
| [PARTIAL] Proposal Builder  |
| title / summary / type      |
| options / parameters        |
| fee / grace / emergency     |
+--------------+--------------+
               |
               v
+-----------------------------+
| [NEEDED] Review And Submit  |
| fee preview                 |
| payload preview             |
| sign dao_proposal_create    |
+--------------+--------------+
               |
               v
+-----------------------------+
| [NEEDED] Committee Review   |
| accept / withhold           |
| withhold reason             |
| emergency handling          |
+------+----------------------+
       |
       +-----------------------+
       |                       |
       v                       v
+-------------------+   +-----------------------------+
| [NEEDED] Withheld |   | [NEEDED] Community Voting   |
| reason / burn     |   | eligibility                 |
| audit trail       |   | weighted ballot             |
+-------------------+   | spend amount                |
                        | live results                |
                        +-------------+---------------+
                                      |
                                      v
                        +-----------------------------+
                        | [NEEDED] Result / Rewards   |
                        | winner                      |
                        | reward pool burn            |
                        | voter reward claim          |
                        | grace countdown             |
                        +-------------+---------------+
                                      |
                                      v
                        +-----------------------------+
                        | [NEEDED] Apply / Execute    |
                        | apply tx                    |
                        | project milestones          |
                        | parameter change status     |
                        +-------------+---------------+
                                      |
                                      v
                        +-----------------------------+
                        | [PARTIAL] Archive / History |
                        | final state                 |
                        | full audit trail            |
                        +-----------------------------+
```

## Screens To Add Or Expand

### A. DAO Home / Overview

```text
+------------------------------------------------+
| DAO                                            |
+------------------------------------------------+
| Active proposals: N                            |
| Voting now: N                                  |
| Rewards available to claim: N LIB              |
|                                                |
| [Create] [My votes] [Parameters]               |
|                                                |
| Needs attention                                |
| - Committee vote required                      |
| - Claim reward available                       |
| - Proposal ready to apply                      |
+------------------------------------------------+
```

Why it may be needed:

- The current DAO list is useful, but the full policy creates different user tasks depending on role and proposal state.
- A dashboard can surface "things I can do now" instead of forcing users through filters.

### B. Discussion Screen

```text
+------------------------------------------------+
| <  Proposal Discussion                         |
+------------------------------------------------+
| Draft: Increase minimum spend                  |
| Discussion ends in 2d 4h                       |
|                                                |
| Summary / motivation                           |
|                                                |
| Comments                                      |
| alice: ...                                     |
| bob: ...                                       |
|                                                |
| [Comment] [Create proposal]                    |
+------------------------------------------------+
```

Why it may be needed:

- Policy says potential proposals should usually have a discussion period before creation.
- Current `discussion` is a proposal state, but there is no discussion UI or comment thread.

### C. Full Proposal Builder

```text
+------------------------------------------------+
| <  Create Proposal                             |
+------------------------------------------------+
| Step 1: Type                                   |
| ( ) Project                                    |
| ( ) Governance parameter                       |
| ( ) Economic parameter                         |
| ( ) Protocol parameter                         |
|                                                |
| Step 2: Ballot options                         |
| [Yes] [No] [+ option]                          |
|                                                |
| Step 3: Type-specific payload                  |
| [changes / milestones / funding / versions]    |
|                                                |
| Step 4: Timing and fee                         |
| discussion proof                               |
| grace duration                                 |
| emergency flag                                 |
+------------------------------------------------+
```

What is missing from current Add Proposal:

- Options array for ballots.
- Proposal fee preview and payment.
- Emergency proposal mode.
- Grace duration selection.
- Committee submission timing.
- Full project milestone structure.
- Governance/economic/protocol parameter change arrays.
- Duplicate/reproposal warning for the 90-day rule.

### D. Submit Confirmation / Transaction Screen

```text
+------------------------------------------------+
| <  Confirm Proposal                            |
+------------------------------------------------+
| Proposal fee: 100 USD equivalent               |
| Starts: committee review                       |
| Type: Governance                               |
|                                                |
| Payload preview                                |
| hash / account address                         |
|                                                |
| [Sign and submit]                              |
+------------------------------------------------+
```

Why it may be needed:

- `dao_proposal_create` is a real network transaction in the policy.
- Users should see the cost, payload, and final transaction state before leaving the screen.

### E. Committee Review Screen

```text
+------------------------------------------------+
| <  Committee Review                            |
+------------------------------------------------+
| Proposal #21                                   |
| Review ends in 1d 3h                           |
|                                                |
| Committee votes                                |
| Accept: 4                                      |
| Withhold: 2                                    |
| Needed for decisive result: >50% same choice   |
|                                                |
| [Accept] [Withhold]                            |
| Withhold reason: [select v]                    |
+------------------------------------------------+
```

Why it may be needed:

- Committee members must accept or withhold proposals during review.
- Withhold requires a reason dropdown.
- Emergency proposals have different default outcomes and no community voting.
- Emergency approvals require a written explanation within 3 days.

### F. Community Voting Screen

```text
+------------------------------------------------+
| <  Vote                                        |
+------------------------------------------------+
| Eligibility: balance above threshold           |
| Voting ends in 5d 2h                           |
|                                                |
| Options                                        |
| [Yes] weight: 3                                |
| [No ] weight: 1                                |
|                                                |
| Spend amount: [10.00 USD]                      |
| Estimated applied weight: 12.59                |
| Reward pool after vote: 312 LIB                |
|                                                |
| [Preview] [Submit vote]                        |
+------------------------------------------------+
```

Why it may be needed:

- Policy voting is not a simple Yes/No toggle.
- A vote contains option weights and a spend amount.
- Vote weight depends on spend, minimum spend, vote exponent, and time left.
- Votes are additive, not replacements.
- The user should understand cost, applied weight, and reward-pool impact before signing.

### G. Live Results / Audit Screen

```text
+------------------------------------------------+
| <  Results                                     |
+------------------------------------------------+
| Current winner: Yes                            |
|                                                |
| Yes  124.44                                    |
| No    88.10                                    |
|                                                |
| Recent votes                                   |
| address...  spend  option weights  time        |
| address...  spend  option weights  time        |
|                                                |
| [Verify on chain]                              |
+------------------------------------------------+
```

Why it may be needed:

- Policy requires transparent, auditable voting.
- Current proposal detail only shows aggregate mock counts.
- Users need to verify their own vote and inspect vote history.

### H. Result Finalization And Reward Claim

```text
+------------------------------------------------+
| <  Final Result                                |
+------------------------------------------------+
| Winner: Yes                                    |
| Initial burn: 50% of reward pool               |
| Claim period ends in 23d                       |
|                                                |
| Your reward estimate: 4.23 LIB                 |
| Claim status: available                        |
|                                                |
| [Claim reward]                                 |
+------------------------------------------------+
```

Why it may be needed:

- After voting ends, 50% of the reward pool is burned.
- Eligible unique voters can claim rewards.
- Unclaimed funds burn after the claim period.
- Current UI has no reward claim flow.

### I. Grace Period / Apply Screen

```text
+------------------------------------------------+
| <  Apply Proposal                              |
+------------------------------------------------+
| Accepted proposal                              |
| Grace period ends in 6d 4h                     |
|                                                |
| Change summary                                 |
| affected parameters / project escrow / version |
|                                                |
| [Apply when available]                         |
+------------------------------------------------+
```

Why it may be needed:

- Accepted community proposals are applied after a grace period.
- Emergency proposals can be applied immediately by committee members.
- Current UI has `accepted` and `applied` states but no apply action.

### J. Project Execution / Milestones

```text
+------------------------------------------------+
| <  Project Execution                           |
+------------------------------------------------+
| Project: Documentation sprint                  |
| Escrow balance: 5000 USD equivalent            |
|                                                |
| Milestone 1: Started                           |
| deliverable / duration / cost / penalty / bonus|
| [Mark complete] [Claim payment]                |
|                                                |
| Milestone 2: Pending                           |
+------------------------------------------------+
```

Why it may be needed:

- Project proposals have milestones, escrow balance, payment, bonus, penalty, and termination states.
- Current UI only stores minimal project address/amount fields.

### K. DAO Parameters Screen

```text
+------------------------------------------------+
| DAO Parameters                                 |
+------------------------------------------------+
| proposalFee       100 USD                      |
| voteThreshold     ...                          |
| minimumSpend      ...                          |
| voteExponent      1.1                          |
| pctBurned         50%                          |
| reviewDuration    2d                           |
| votingDuration    8d                           |
| graceDuration     7d                           |
| claimDuration     30d                          |
+------------------------------------------------+
```

Why it may be needed:

- Policy says DAO parameters are global network parameters and can be changed by DAO voting.
- Users need to see current values before creating or voting on proposals.

## Backend Integration Flow

```text
+------------------------+
| app.js DAO screens     |
+-----------+------------+
            |
            v
+------------------------+
| dao.repo.js            |
| normalizeDaoStore()    |
+-----------+------------+
            |
            v
+------------------------+
| [BACKEND] fetcher      |
| list proposals         |
| get proposal           |
| create proposal tx     |
| committee vote tx      |
| cast weighted vote tx  |
| claim reward tx        |
| apply proposal tx      |
+-----------+------------+
            |
            v
+------------------------+
| Network / chain state  |
| proposal accounts      |
| meta account           |
| global DAO params      |
+------------------------+
```

Current backend status:

- `daoRepo` has a backend mode hook.
- No backend endpoints or transaction calls are implemented.
- `createProposal()` and `castVote()` mutate local memory only.

## Suggested Build Order

```text
1. Keep current mock list/detail/add screens.
2. Add full proposal detail sections:
   timeline, committee votes, voting config, rewards, audit.
3. Replace mock Yes/No vote with weighted vote preview.
4. Add transaction confirmation screens for create/vote.
5. Add committee review screens and emergency flow.
6. Add reward claim and apply screens.
7. Add project milestone execution screens.
8. Wire dao.repo.js to backend/indexer data.
```

## Short Gap Summary

```text
Current:
  Menu -> DAO list -> Add Proposal
                  -> Proposal Detail -> Mock Yes/No vote

Needed:
  DAO overview
  Discussion/comments
  Full proposal builder
  Submit confirmation
  Committee review
  Weighted vote entry
  Live results/audit
  Final result/reward claim
  Grace/apply
  Project milestone execution
  DAO parameter browser
  Backend transaction/status handling
```
