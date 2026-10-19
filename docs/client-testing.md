# Companion regression-test workflow

Reusable regression tests belong in the GitHub repository
[`Liberdus/client-testing`](https://github.com/Liberdus/client-testing).
`codex/local-client-tests` is the shared review target, not a branch for direct
feature commits. The GitHub organization does not prescribe a local directory
layout. Keep client changes here and companion changes on a separate test topic
branch. Commit them separately and link their PRs in both directions.

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
git clone --branch codex/local-client-tests --single-branch \
  https://github.com/Liberdus/client-testing.git "$CLIENT_TESTING_ROOT"
```

The testing branch must be published before clone-based setup can work. Report
authentication, network or filesystem failures, or a missing remote branch;
do not silently fall back to the default branch or claim tests were run.

## Create a companion topic branch

Fetch the required branch explicitly. This also works when the existing
repository was originally cloned with a different single branch:

```bash
git -C "$CLIENT_TESTING_ROOT" fetch origin \
  refs/heads/codex/local-client-tests:refs/remotes/origin/codex/local-client-tests
```

If a local `codex/local-client-tests` branch has unpublished commits, report
them and coordinate a separate review; do not publish them as part of this task.
For every new test change, create a topic branch and isolated worktree from the
published shared branch, even if the existing checkout is clean and exclusively
owned. Choose an unused task-specific branch name and a new absolute destination:

```bash
export CLIENT_TESTING_WORKTREE=/absolute/path/chosen-for/issue-tests
git -C "$CLIENT_TESTING_ROOT" worktree add \
  -b codex/issue-number-tests "$CLIENT_TESTING_WORKTREE" \
  origin/codex/local-client-tests
export CLIENT_TESTING_ROOT="$CLIENT_TESTING_WORKTREE"
```

A checkout of `codex/local-client-tests` can be used for read-only baseline runs;
all edits belong on the topic branch. Reuse that task's topic checkout when
updating its existing PR. Do not commit, merge, cherry-pick or push changes
directly into the shared branch, or switch another agent's checkout.

Read the selected checkout's `AGENTS.md` and `local-tests/README.md` before
adding tests or installing dependencies.

## Run and extend regression coverage

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
making changes; some preserved suites require particular client features. See
the companion repository's `local-tests/REPAIRS.md` for the documented baseline.

Add or update focused tests in `$CLIENT_TESTING_ROOT/local-tests/tests/`, using
synthetic fixtures. Run the focused tests after implementation and broaden
validation when appropriate. The full default offline command is:

```bash
node "$CLIENT_TESTING_ROOT/local-tests/run.mjs"
```

Record both the companion revision and the exact client revision. A shared
baseline may already contain historical or feature-specific failures; creating
a topic branch does not repair them. Explain prerequisites or stale expectations
without weakening tests or silently skipping failures to obtain a green run.

Report new regressions and known baseline failures separately. Keep generated
reports, credentials, account data and browser profiles out of commits. Avoid
new ignored test directories in this client repository. Browser fixtures and
live end-to-end tests have separate setup and environment requirements in the
companion README; select and authorize a suitable environment before live runs.

## Open linked PRs and respect client dependencies

Follow the user's commit/push authorization and stage only task-owned changes.
Commit companion changes on the topic branch, then publish that topic branch:

```bash
git -C "$CLIENT_TESTING_ROOT" push --set-upstream origin codex/issue-number-tests
```

Open a companion PR in `Liberdus/client-testing` with base
`codex/local-client-tests`, not the repository's default branch. Keep the diff
focused on the task. Review and merge through that PR; never bypass it with a
local merge, cherry-pick or direct push to the shared branch.

Link the companion PR in the `web-client-v2` PR and add a link back to the client
PR in the companion description. In both, record the tested client and companion
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

- Companion PR URL with a link back to the client PR, test files, topic
  branch/commit IDs, and the tested client revision.
- Exact commands, results and relevant baseline failures, or why companion
  coverage does not apply (for example, a documentation-only change).
- The actual remaining steps: **commit**, **push the topic branch**, **open/link
  the companion PR**, **review**, or **wait for client dependencies and revalidate
  before merge**. Remind the user of every applicable step. Report a published
  but unmerged PR as awaiting review/merge, not as fully integrated.

A local commit alone does not publish tests. Verify the remote topic branch
before reporting it as available for review. Shared-branch integration is a
separate status that requires the companion PR to be merged and verified.
