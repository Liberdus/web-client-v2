# Client regression tests

Before changing behavior or creating a PR, read
[the companion testing workflow](docs/client-testing.md).

Reusable regression tests live in the GitHub repository
`Liberdus/client-testing`, on branch `codex/local-client-tests`. Its local
checkout can live anywhere.

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
- Keep reusable tests committed in `client-testing`; avoid new ignored test
  directories in this repository. Commit implementation and companion tests
  separately, and include both commit IDs, commands, and results in the handoff.
- Preserve other agents' branches and local work. For concurrent test changes,
  use separate topic branches/worktrees based on `codex/local-client-tests` and
  integrate verified commits sequentially. Do not switch a shared checkout's
  branch while another agent is using it.
- At PR creation, report companion test files, branch/commit IDs, tested client
  revision, commands and results. Remind the user to commit, integrate into
  `codex/local-client-tests`, or push any pending test work, stating only the
  steps that remain. Follow the user's authorization for commits and pushes;
  verify publication before reporting tests as available remotely.
- Keep generated reports and local account data out of commits. The offline
  regression runner needs no live account; choose an appropriate test environment
  before running live end-to-end tests.
