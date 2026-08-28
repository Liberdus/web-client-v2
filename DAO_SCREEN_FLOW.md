# DAO Screen Flow

This document describes the DAO UI that exists on `main` at `9c02dfb3` (August 26, 2026). The interactive reference is [`mock/index.html`](mock/index.html).

## Entry and list

The Devnet-only **DAO** Menu item opens `daoModal`. The modal loads proposal metadata and details from the DAO backend and defaults to the **Vote** filter. A DAO notification can choose **Vote** or **Claim** as the initial filter.

The fixed, two-row filter bar contains:

1. Review
2. Vote
3. Accepted
4. Claim
5. Withheld
6. Rejected
7. Applied
8. All

All except **Claim** and **All** are server proposal-status filters. **All** contains every metadata entry. **Claim** is account-specific: it starts with locally tracked claim candidates, loads fresh proposal details, and only displays rows that are currently claimable.

Proposal rows show the title, proposal type, and contextual preview badges. Preview badges expose important timing and actions without adding separate screens, including:

- review or voting deadlines;
- ready-to-finalize status;
- accepted, rejected, or emergency results;
- ready-to-claim, ready-to-burn, and ready-to-apply actions.

The floating **+** button opens `addProposalModal`.

## Proposal creation

```text
DAO list
  -> Add Proposal
  -> Review Proposal
  -> Sign Proposal
  -> previous DAO filter + pending confirmation toast
  -> Review filter after settlement
```

**Add Proposal** includes:

- emergency and proposal-fee fields;
- title, description, and proposal type;
- the fixed first **no change** option;
- one to nine additional options with typed parameter changes;
- review-delay and grace-period pickers;
- Cancel and Review Draft actions.

**Review Proposal** reuses the same heading, option cards, overview cards, and review-timeline cards as the shared Proposal modal. Signing closes the creation modals and returns to the previously selected DAO filter. It does not automatically open the new proposal or select Review.

## Shared Proposal modal

Every proposal row opens `proposalInfoModal`. The modal title reflects the effective proposal state, and the body always starts with the proposal heading and option cards. State-, role-, account-, and time-dependent sections are added below them.

| Effective state | Always visible | Contextual actions |
| --- | --- | --- |
| Review | Proposal options and committee totals | Committee members can submit Accept or Withhold while review is open. After `reviewEnd`, a funded user can finalize the review result. |
| Voting | Proposal options and current weighted totals | Eligible users can allocate integer weights, select a whole-number minimum-spend multiple, preview power, and submit a vote. After `votingEnd`, a funded user can finalize the vote result. |
| Accepted | Winning option, result meter, and expandable details | Claim reward during the account's eligible claim window; apply parameters after the grace period; burn unclaimed rewards after the claim window. |
| Rejected | Winning option, result meter, and expandable details | Claim or burn rewards when the corresponding lifecycle conditions are met. |
| Withheld | Committee result, committee votes, and expandable details | Reward lifecycle actions when available. |
| Applied | Result and expandable reward accounting | Remaining reward lifecycle actions when available. |

The expandable **Show proposal details** section contains overview data, the review timeline, committee review information during Review, and reward accounting when available.

## State transitions

```text
Review
  -> committee votes during the review window
  -> Finalize review result
     -> Voting for an accepted standard proposal
     -> Accepted for an accepted emergency proposal
     -> Withheld when withhold wins

Voting
  -> weighted user votes during the voting window
  -> Finalize vote result
     -> Accepted when a change option wins
     -> Rejected when no-change wins

Accepted
  -> Claim reward during claim window, when eligible
  -> Apply parameters after grace period
  -> Burn unclaimed reward after claim window
  -> Applied after parameters are applied
```

## Concepts removed from the old mock

The current client does not use these older prototype concepts:

- in-memory DAO mock data;
- Active/Archived tabs;
- a funnel-based status overlay;
- a DAO category dashboard;
- a separate committee queue;
- standalone Vote, Results, Rewards, Parameters, Ready Actions, or Apply Parameters modals.

Their functions now live in the filter bar, proposal-row preview badges, and the shared Proposal modal.

## Interactive mock controls

- Use **+**, **−**, the mouse wheel, or the percentage button to control zoom.
- Drag the board background to pan.
- Click a flow arrow, arrow label, or connected source control to pin its animated highlight.
- Run `node mock/validate-current-flow.mjs` after changing production DAO modal labels or actions.
