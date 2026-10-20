# Companion regression-test workflow

Reusable regression tests belong in the GitHub repository
[`Liberdus/client-testing`](https://github.com/Liberdus/client-testing).
`main` is the permanent shared review target, not a branch for direct
feature commits. The GitHub organization does not prescribe a local directory
layout. Keep client changes here and companion changes on a separate test topic
branch. Commit them separately and link their PRs in both directions while the
client PR is open.

Create a companion branch and PR only when the client task needs new or updated
companion tests. Running existing tests does not require a companion PR. For
documentation-only work or changes already covered by existing tests, report
the validation performed and mark companion changes N/A with a reason.

If the published shared branch lacks the required runner or instructions,
report setup as unavailable. Do not silently select another branch or claim
validation passed.

## Find or clone the companion repository

Start from the implementation checkout, including when it is a Git worktree:

```bash
export WEB_CLIENT_ROOT="$(git rev-parse --show-toplevel)"
git status --short
git branch --show-current
```

Use this discovery order:

1. If `CLIENT_TESTING_ROOT` is set, use that location. Require an absolute path
   to the companion Git checkout. Report an invalid or inaccessible override and
   stop setup instead of silently selecting another repository.
2. Otherwise check for a sibling `../client-testing` next to this client checkout
   and any known nearby companion checkout.
3. For a client worktree, run `git worktree list --porcelain`. The first worktree
   is the primary client checkout; check its sibling `client-testing` directory.
   Paths may contain spaces, so do not split them on whitespace.
4. If none exists, choose an available absolute destination and clone as below.

Once found, set `CLIENT_TESTING_ROOT` to its absolute path. Inspect its Git root,
origin and local state to confirm it is the intended companion repository:

```bash
git -C "$CLIENT_TESTING_ROOT" rev-parse --show-toplevel
git -C "$CLIENT_TESTING_ROOT" remote get-url origin
git -C "$CLIENT_TESTING_ROOT" status --short
git -C "$CLIENT_TESTING_ROOT" branch --show-current
```

An existing checkout on another branch can still provide the repository for a
new test worktree. Do not switch it or discard its changes to obtain the tests.

For a missing checkout, replace the example destination with a path you choose;
do not overwrite an existing directory:

```bash
export CLIENT_TESTING_ROOT=/absolute/path/chosen-for/client-testing
git clone --branch main --single-branch \
  https://github.com/Liberdus/client-testing.git "$CLIENT_TESTING_ROOT"
```

The shared `main` branch must be available for clone-based setup. Report
authentication, network or filesystem failures, or a missing remote branch;
do not silently fall back to the default branch or claim tests were run.

## Create a companion topic branch

Fetch the required branch explicitly. This also works when the existing
repository was originally cloned with a different single branch:

```bash
git -C "$CLIENT_TESTING_ROOT" fetch origin \
  refs/heads/main:refs/remotes/origin/main
```

If an existing checkout has unrelated unpublished commits, report them and
coordinate a separate review; do not publish them as part of this task.
For every new test change, create a topic branch and isolated worktree from the
published shared branch, even if the existing checkout is clean and exclusively
owned. Choose an unused task-specific branch name and a new absolute destination:

```bash
export CLIENT_TESTING_WORKTREE=/absolute/path/chosen-for/issue-tests
git -C "$CLIENT_TESTING_ROOT" worktree add \
  -b codex/issue-number-tests "$CLIENT_TESTING_WORKTREE" \
  origin/main
export CLIENT_TESTING_ROOT="$CLIENT_TESTING_WORKTREE"
```

A checkout of `main` can be used for read-only baseline runs;
all edits belong on the topic branch. Reuse that task's topic checkout when
updating its existing PR. Do not commit, merge, cherry-pick or push changes
directly into the shared branch, or switch another agent's checkout.

For a genuine stack of dependent test changes, a child topic branch may start
from its published parent test branch and its PR may target that parent branch.
Record the parent PR and the parent tip used as the child's base. After the
parent merges, fetch `origin/main`, rebase only the child's commits onto it, and
retarget the child PR to `main`. If the parent was squash-merged, use the recorded
parent tip as the rebase boundary so its original commits are not replayed.
Inspect the resulting diff to confirm it contains only the child test changes.

Read the selected checkout's `AGENTS.md` and `local-tests/README.md` before
adding tests or installing dependencies.

## Run and extend regression coverage

Keep validation proportional to the task:

- **Scope:** start with relevant existing tests and broaden checks according to
  the changed behavior and risk. Existing coverage can be sufficient; new test
  changes and a companion PR are only needed when coverage needs updating.
- **Behavior:** prefer tests of inputs, outputs, UI state and side effects over
  source-text assertions or other implementation details.
- **Regression proof:** for bug fixes, run the focused regression before and
  after the fix when practical, showing failure followed by success. Record any
  limitation that prevents that comparison.
- **Repeatability:** reuse existing automated runners and CI checks for routine
  validation. Record exact commands and results; identify manual checks and
  automation gaps without adding new CI work to every task.

Use Node.js 20.19 or newer. The offline runner uses synthetic fixtures and needs
no live account. With `WEB_CLIENT_ROOT` still pointing to the implementation
checkout, run relevant existing tests before changing behavior:

```bash
node "$CLIENT_TESTING_ROOT/local-tests/run.mjs" --list
node "$CLIENT_TESTING_ROOT/local-tests/run.mjs" dao-timeline.test.mjs
```

Replace the example filename with relevant suites from `local-tests/tests/`.
Record the client revision (`git -C "$WEB_CLIENT_ROOT" rev-parse HEAD`), test
branch/commit, command and result. Record any pre-existing failures before
making changes; suites on test topic branches may require particular client
features. See the companion repository's `local-tests/README.md` for its
documented baseline and supported commands.

When additional coverage is needed, add or update focused tests in
`$CLIENT_TESTING_ROOT/local-tests/tests/`, using synthetic fixtures. Run the
focused tests after implementation. The full default offline command is:

```bash
node "$CLIENT_TESTING_ROOT/local-tests/run.mjs"
```

Record both the companion revision and the exact client revision. Tests on a
dependent topic branch may fail until its required client features are present.
Explain prerequisites or stale expectations without weakening tests or silently
skipping failures to obtain a green run.

Report new regressions and known baseline failures separately. Keep generated
reports, credentials, account data and browser profiles out of commits. Avoid
new ignored test directories in this client repository. Browser fixtures and
live end-to-end tests have separate setup and environment requirements in the
companion README; select and authorize a suitable environment before live runs.

## Open linked PRs and respect client dependencies

When creating the client PR, create or update a relevant companion test PR if
the task adds or changes companion tests. Otherwise mark the companion section
N/A with a reason and skip companion branch/PR creation.

For companion test changes, follow the user's commit/push authorization and stage
only task-owned changes. Commit on the topic branch, then publish that branch:

```bash
git -C "$CLIENT_TESTING_ROOT" push --set-upstream origin codex/issue-number-tests
```

Open a companion PR in `Liberdus/client-testing` with base `main`, or its parent
test branch for a genuine stack as described above. Keep the diff
focused on the task. Review and merge through that PR; never bypass it with a
local merge, cherry-pick or direct push to the shared branch.

For an open `web-client-v2` PR, link the companion PR there and add a link back
in the companion description. For an already merged client PR, link that PR
from the companion PR only; do not edit the merged PR
or create a replacement client PR. Record the tested client and companion
commit IDs, exact commands/results, known baseline failures, and all required
client PRs or features. A published topic branch preserves tests without making
them part of the shared suite.

Tests that require new client behavior must remain unmerged until that behavior
and every other required client feature are available on client main. After the
client PR merges, update the companion topic branch as needed and rerun focused
tests against the resulting main revision. Record that SHA and result before
merging the companion PR. If the client PR closes unmerged, keep its dependent
tests unmerged or close their PR. Test changes already compatible with main can
be reviewed and merged independently after the focused main validation.
Documentation-only updates can use documentation checks and explain runtime N/A.

After the companion PR merges, record its resulting merge or squash commit and
verify the remote shared branch contains that commit. Do not assume the original
topic SHA survives a squash merge.

When creating a PR, fill in the companion-test section of the PR template and
include the same status in the handoff:

- Companion PR URL and base, parent test PR if stacked, a link back to the client
  PR, test files, topic branch/commit IDs, and the tested client revision.
- Exact commands, results and relevant baseline failures, or why companion
  coverage does not apply (for example, a documentation-only change).
- The actual remaining steps: **commit**, **push the topic branch**, **open/link
  the companion PR**, **review**, or **wait for client dependencies and revalidate
  before merge**. Remind the user of every applicable step. Report a published
  but unmerged PR as awaiting review/merge, not as fully integrated.

A local commit alone does not publish tests. Verify the remote topic branch
before reporting it as available for review. Shared-branch integration is a
separate status that requires the companion PR to be merged and verified.
