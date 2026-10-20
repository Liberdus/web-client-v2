<!--
Inspect the final branch/PR diff before writing this description. Keep it concise
and describe the resulting behavior, rather than listing implementation history.
When the scope changes, rewrite stale content and preserve issue-closing links.
-->

## What Changed

<!--
Lead with one sentence describing the concrete outcome. Add focused bullets for
the important changes and why they matter. Name functions or concepts when they
help a reviewer follow the diff; avoid vague claims such as "improved handling".
-->

## Fixed Flow

<!--
For behavioral fixes, races, async flows or multi-step interactions, describe:
1. The initial state or user action.
2. The event or transition.
3. The new behavior.
4. The resulting protected or fixed outcome.
Remove this section when it does not help explain the change.
-->

## Why

<!--
Explain the previous failure mode or missing behavior and why this change fixes
its cause. Describe the relevant state or source of truth; treat extra UI guards
as safety nets when appropriate. Avoid repeating the change list.
-->

## Validation

<!-- Keep validation proportional. Prefer behavior checks and reuse existing
automated runners/CI. For bug fixes, report failure before the fix and success
afterward when practical, or explain the limitation. List exact commands that
actually ran and their results; identify manual checks and unrun checks with
the concrete reason. -->

## Companion regression tests

- [ ] Companion changes have a linked topic-branch PR, or N/A with a reason.
- Companion PR URL and base; parent test PR if stacked (link this client PR back from it):
- Test files, topic branch and commit IDs:
- Tested client revision, commands, results and known baseline failures:
- Required client PRs/features, readiness after focused validation on client main, and child retarget/rebase steps after a parent test PR merges:
- Remaining actions and reminder: commit / push topic / open or link PR / review / wait for client dependencies and revalidate before merge / none / N/A with reason.

## Related Issues

<!-- Link relevant issues and preserve required closing references, such as
Closes #<issue-number>. Replace the placeholder with the actual issue number. -->
