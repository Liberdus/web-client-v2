# Client regression tests

Before changing behavior or creating a PR, read
[the companion testing workflow](docs/client-testing.md).

Reusable regression tests live in the GitHub repository
`Liberdus/client-testing`. Its permanent shared review target is `main`;
make changes on companion topic branches and open PRs against it. The
local checkout can live anywhere.

- Before implementing behavior changes, locate that checkout using
  `CLIENT_TESTING_ROOT` if set; report an invalid override instead of silently
  choosing another checkout. Otherwise check nearby checkouts and the primary
  client checkout's sibling directory using `git worktree list`. If unavailable,
  clone `https://github.com/Liberdus/client-testing.git` into a chosen local
  directory and select `main` as described in the guide.
  Report clone/access failures or a missing remote branch explicitly.
- Read its `AGENTS.md` and `local-tests/README.md`. Set `WEB_CLIENT_ROOT` to the
  absolute path of the implementation checkout, including when working in a
  worktree. Run relevant existing tests; when additional coverage is needed,
  add or update focused tests in `client-testing/local-tests/tests/`.
- Keep reusable tests committed on a task-specific `client-testing` branch;
  avoid new ignored test directories here. Commit client and companion changes
  separately. Do not commit, merge, cherry-pick or push changes directly into
  `main`; use a reviewed companion PR even when working alone.
- Keep validation proportional to the change and risk. Prefer observable behavior
  over source-text assertions; for bug fixes, demonstrate failure before the fix
  and success afterward when practical. Reuse existing automated runners and CI,
  and report limitations instead of adding unnecessary process.
- Preserve other agents' branches and local work. Create an isolated companion
  topic worktree from the published shared branch for test changes. Do not
  switch a shared checkout's branch while another agent is using it.
- When creating a client PR that needs new or updated companion tests, create or
  update the relevant `client-testing` PR targeting `main` and link it from the
  open client PR; link back from the companion PR. A genuine test stack may
  temporarily target its parent test branch; after the parent merges, rebase and
  retarget the child to `main`, accounting for a possible squash merge. Report test
  files, branch/commit IDs, tested client revision, commands, results and known
  baseline failures. If no companion test changes are needed, report N/A with a
  reason; do not create a companion PR solely because a client PR exists.
- For tests covering an already merged client PR, link that PR from the
  companion PR only. Do not edit the merged client PR or create a replacement.
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
