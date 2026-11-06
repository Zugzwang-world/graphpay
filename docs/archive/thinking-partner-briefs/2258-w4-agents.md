# W4 Agents: the deadline, speed and cost

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: a fresh session on Opus 5.5, Max effort, in its own worktree.

**Goal:** errands work at any hour, cost less and finish sooner, without changing what the screens show.

**Read first:** `docs/thinking-partner/TRACKER.md` and `NOW.md`, then the agents relay.

**You own:** `packages/agents`, and the request line in `packages/config/story.json`.

## Do, in order

1. **A relative deadline:**
   - The request becomes "Just landed in Mumbai. Get me the best masala dosa near BKC under 6 USDT, delivered within an hour."
   - The guard checks each shop's ETA against one hour from the request, so errands work at any time of day or night.
2. **Measure:** from the run logs of live errands, record per agent and per call the tokens, cached tokens, output tokens and seconds.
3. **Cut tokens and time, without changing what the screens show:**
   - lower Kimi's reasoning effort for the routine agents;
   - send the model shorter tool replies, while the full data stays for the screens and the explainer;
   - do routine steps in code.

   Keep the trap veto and every visible message.
4. **Reliability:** no stops after planning, and three live errands in a row that pay.

## Done when

- Errands work at any hour.
- Tokens and seconds per errand are lower, with before-and-after numbers in your relay.
- Three errands in a row pay.

## Rules (all night sessions)

- **Unattended:** no stops between steps, and no usage lines tonight.
- **Ownership:** edit only what you own. `story.json` changes come as small PRs touching only your keys; rebase before merging, and never reformat the file.
- **Safety:**
  - Use small PRs with auto-merge.
  - Run the reviewer on any code that signs or sends money.
  - Never print a secret.
  - No contract redeploys.
- **The live site:**
  - Develop on mocks, and use live errands to prove each step.
  - Never merge anything that breaks the live errand on https://graphpay-event.vercel.app.
- **No restyling:** a frontend pass handles the screens. If the phones need a route or event from you, build it and list it in OPEN under "frontend".
- **Reporting:**
  - Keep your relay at `docs/thinking-partner/relays/w4-agents.md`, under 800 words.
  - Add a line in NOW, and LOG lines as you go.
  - Tell the Coordinator as each item lands.
  - Ask the founder only for logins, funding or secrets.
