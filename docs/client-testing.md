# Companion regression-test workflow

Reusable regression tests belong in the GitHub repository
[`Liberdus/client-testing`](https://github.com/Liberdus/client-testing), on
`codex/local-client-tests`. The GitHub organization does not prescribe a local
directory layout. Keep client changes here and companion tests there; commit
them separately and reference both commits in the implementation handoff or PR.

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

## Prepare an isolated test checkout

Fetch the required branch explicitly. This also works when the existing
repository was originally cloned with a different single branch:

```bash
git -C "$CLIENT_TESTING_ROOT" fetch origin \
  refs/heads/codex/local-client-tests:refs/remotes/origin/codex/local-client-tests
```

If a local `codex/local-client-tests` branch has unpublished commits, coordinate
their integration before selecting a base; do not silently omit that work.
For a busy, dirty or concurrently used checkout, create a separate topic
worktree. Choose an unused branch name and a new absolute destination:

```bash
export CLIENT_TESTING_WORKTREE=/absolute/path/chosen-for/issue-tests
git -C "$CLIENT_TESTING_ROOT" worktree add \
  -b codex/issue-number-tests "$CLIENT_TESTING_WORKTREE" \
  origin/codex/local-client-tests
export CLIENT_TESTING_ROOT="$CLIENT_TESTING_WORKTREE"
```

An exclusively owned, clean checkout already on `codex/local-client-tests` can
be used directly. Inspect its local/remote history before updating it; use only
fast-forward updates and resolve divergence explicitly. Never reset, force-push
or switch another agent's checkout to make the workflow fit.

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

Report new regressions and known baseline failures separately. Keep generated
reports, credentials, account data and browser profiles out of commits. Avoid
new ignored test directories in this client repository. Browser fixtures and
live end-to-end tests have separate setup and environment requirements in the
companion README; select and authorize a suitable environment before live runs.

## Preserve tests and report their PR status

Follow the user's commit/push authorization. Stage only changes belonging to
the task and keep client implementation commits separate from companion test
commits. Fetch the latest shared branch before integrating topic work. In an
owned, clean checkout of `codex/local-client-tests`, integrate verified commits
sequentially with `git merge --ff-only <test-topic>`. Resolve divergence in the
topic worktree and rerun relevant tests before retrying integration. Publish
with a normal push; if rejected, inspect and reconcile the new commits rather
than overwriting them.

When creating a PR, fill in the companion-test section of the PR template and
include the same status in the handoff:

- Test files, companion branch/commit IDs and the tested client revision.
- Exact commands, results and relevant baseline failures, or why companion
  coverage does not apply (for example, a documentation-only change).
- The actual remaining steps: **commit** for uncommitted tests, **integrate** for
  topic commits absent from `codex/local-client-tests`, and **push** for shared
  commits absent from the remote. List every applicable step in that order and
  explicitly remind the user to complete it. If nothing remains, say so.

A local commit alone does not publish tests. Verify the remote shared branch
contains the companion commit before reporting that tests are available to
other machines. Do not mark pending work as completed just because a PR exists.
