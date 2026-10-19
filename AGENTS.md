# Client regression tests

Before changing behavior or creating a PR, read
[the companion testing workflow](docs/client-testing.md).

Reusable regression tests live in the GitHub repository
`Liberdus/client-testing`. Branch `codex/local-client-tests` is the shared review
target; make changes on companion topic branches and open PRs against it. The
local checkout can live anywhere.

- Before implementing behavior changes, locate that checkout using
  `CLIENT_TESTING_ROOT` if set; report an invalid override instead of silently
  choosing another checkout. Otherwise check nearby checkouts and the primary
  client checkout's sibling directory using `git worktree list`. If unavailable,
  clone `https://github.com/Liberdus/client-testing.git` into a chosen local
  directory and select `codex/local-client-tests` as described in the guide.
  Report clone/access failures or a missing remote branch explicitly.
- Read its `AGENTS.md` and `local-tests/README.md`. Set `WEB_CLIENT_ROOT` to the
  absolute path of the implementation checkout, including when working in a
  worktree. Run relevant existing tests and add or update focused regression
  coverage in `client-testing/local-tests/tests/`.
- Keep reusable tests committed on a task-specific `client-testing` branch;
  avoid new ignored test directories here. Commit client and companion changes
  separately. Do not commit, merge, cherry-pick or push changes directly into
  `codex/local-client-tests`; use a reviewed companion PR even when working alone.
- Preserve other agents' branches and local work. Create an isolated companion
  topic worktree from the published shared branch for test changes. Do not
  switch a shared checkout's branch while another agent is using it.
- At PR creation, link the companion test PR from the client PR and link back
  from the companion PR. Report test files, branch/commit IDs, tested client
  revision, commands, results and known baseline failures. Use N/A with a reason
  when no companion changes are needed.
- Keep tests requiring unmerged client features on their companion PR branch.
  Before merging changed tests into the shared branch, confirm every required
  feature is on client main and rerun focused tests against that main revision.
  Publishing a topic branch or opening a PR does not mean those tests are integrated.
- Remind the user of pending commits, topic pushes, PR creation/linking, review
  or dependency/merge steps. Follow the user's authorization for commits and
  pushes; verify publication before reporting tests as available remotely.
- Keep generated reports and local account data out of commits. The offline
  regression runner needs no live account; choose an appropriate test environment
  before running live end-to-end tests.
