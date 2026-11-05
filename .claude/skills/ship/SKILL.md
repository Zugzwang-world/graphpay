---
name: ship
description: Ship a step as a small PR into protected main with auto-merge, including the thinking-partner update in the same PR, then watch it until it merges.
---

# ship

1. **Branch:** never commit to `main`. Use your session's prefix (`m0/`, `pay/`, `ens/`, `arkiv/`, `agents/`, `web/`, `join/`).
2. **Checks before the commit:** `pnpm check` (secret scan and hygiene), then the tests, lint, typecheck and build of what you touched (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`; Node 22 via `fnm exec --using=22.23.4` where it matters). If the change touches a contract, payment, signature, key, secret or spending endpoint, run the **reviewer** agent and fix every blocking item first.
3. **Thinking-partner update in the same PR** (skill `relay`): your section of `docs/thinking-partner/NOW.md`, `relays/<activity>.md`, one `LOG.md` line per PR under your heading (time IST, activity, result, PR link; add the link once the PR exists), your section of `OPEN.md`, any brief received in `briefs/`. Also stage `prompts/raw/`.
4. **Commit** with a conventional message and end it with the attribution line the session was given (`Co-Authored-By: …`).
5. **Push and open the PR as separate commands:** `git push -u origin <branch>`; write the body to a file (what, why, tests, reviewer result, deviations from the spec) ending with the PR attribution line, then `gh pr create --base main --head <branch> --title … --body-file <file>`.
6. **Auto-merge:** `gh pr merge <n> --auto --squash`. If it says "Base branch was modified", wait until CI has started and run it again.
7. **Watch until merged:** `gh pr checks <n>` and `gh pr view <n> --json state,mergeStateStatus,autoMergeRequest`. Never merge on red or pending. If it is green and `CLEAN` for several minutes and auto-merge has not fired, merge it with `gh pr merge <n> --squash`.
8. **Conflicts:** never force-push. `git fetch origin && git merge origin/main`, keep every line of both sides in the shared files (`NOW.md`, `LOG.md`, `OPEN.md`), take main's `pnpm-lock.yaml` and re-run `pnpm install`, re-run the checks, push.
9. After the merge, append the PR link to your `LOG.md` line if it was missing (in your next PR).
