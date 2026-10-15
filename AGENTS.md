# Client regression tests

Reusable regression tests live in the companion `client-testing` repository on
branch `codex/local-client-tests`.

- Before implementing behavior changes, locate that checkout using
  `CLIENT_TESTING_ROOT` if set. Otherwise check `../client-testing`, or find the
  primary client checkout with `git worktree list` and check its sibling
  `client-testing` directory. Report a missing checkout explicitly.
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
- Keep generated reports and local account data out of commits. The offline
  regression runner needs no live account; choose an appropriate test environment
  before running live end-to-end tests.
