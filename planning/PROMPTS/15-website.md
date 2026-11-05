# M15 — The website (customer, merchant, explainer, race mode)

**Goal:** the founder's design, live on Vercel: two phone screens side by side (Vitalik left, Kesar Kingdom right) with a live explainer in the middle, and race mode. Every on-chain action opens its explorer page; nothing is simulated; spending is behind the passcode. The website doubles as the demo video.
**Depends on:** M0 for the shell; wired live after M4 (shop, facilitator), M6 (pause), M7b (GraphQL, explain), M9 (race), M10–M12 (agents, mirror). **Worktree:** `wt-web` (`web/*`). **Model:** Sonnet High. **Time:** 180–240 min (not built in the lab).

## Inputs
`WEBSITE_SPEC.md` (all), `SPEC/ARCHITECTURE.md` §2–§3, `SPEC/AGENTS.md` §9 (run log events), `SPEC/ARKIV_GRAPH.md` §5 (GraphQL, explain), `SPEC/BENCHMARK.md` (race), `SPONSOR_CHECKLIST.md` (demo moments).

## Prompt
> Build the website in `apps/web` exactly to `planning/WEBSITE_SPEC.md`: the layout of §2 (desktop: two phones and the explainer; phone: each screen on its own route), the customer screen of §3, the merchant screen of §4, the explainer of §5, race mode of §6, the server routes of §7 (every spending or owner action server-side behind `X-Demo-Passcode`; the passcode entered once per browser session and never stored in a URL), the live-data rules of §8 (agent events over SSE; tallies and edges from GraphQL with their explain ids; every transaction hash rendered as an explorer link), and the visual system of §9. Start with the shell and the data contracts of §7 against local fakes that use the exact response shapes, then switch each panel to the live route as the tracks land; the shipped site has no fake path. Accessibility: keyboard reachable, `prefers-reduced-motion` jumps to end states, sound only after the merchant's "Open shop" tap. Test the routes' passcode guard and the explorer-link builder. Deploy previews per PR; production from `main`.

## Done when
- `WEBSITE_SPEC.md` §13 checklist passes on the production URL with real transactions.
- A full run (request → paid → refund → re-order → subscribe → pause → resume) works from the two phones, and race mode shows live timers and read counts.

## Pitfalls
Do not show model prose as a figure (price, receipt). Never cache spending routes; race mode is uncached. One relayer nonce stream: queue the website's payments (one errand at a time) and show "busy" rather than firing in parallel. The agents' run takes minutes: stream progress, never block a request without output.

## Thinking-partner update (end of the step, in the same PR)
Activity name: **`website`**. In `docs/thinking-partner/` (convention in `PROMPTS/00-foundation.md`), touch only your own parts:
- `briefs/`: save any brief the founder attached for this step as soon as it arrives (a pack prompt gets a one-line pointer, not a copy).
- `NOW.md`: rewrite the `website` section (updated time IST, where we are in plain words, what's running, blockers, next).
- `relays/website.md`: overwrite with about 800 words, plain language first, then technical: what was built, PR links, numbers with their sources, where the work deviated from the spec and why.
- `LOG.md`: append one line per PR under the `website` heading (time IST, activity, result, PR link). Only main rolls lines up.
- `OPEN.md`: update the `website` section: the founder's to-dos and open questions, each with what, where, why and a recommendation; close what this step settled.

No secrets or key-shaped strings; judge-safe wording (the repo is public); the folder stays under about 20,000 words. After the last push, watch the PR until it merges; on a conflict, merge `origin/main` again, keep every line, and push.
