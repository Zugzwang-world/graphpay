Received 23:02 IST, Fri 6 Nov, by W1 Identity (attached by the founder; from the thinking partner).

# W1 Identity: the new shops on ENS, then the kill

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: a fresh session on Opus 5.5, Max effort, in its own worktree.

**Goal:** the shops on chain match the screens (Filter & Fold, Idli Index, Tawa Tangle), and the kill works live.

**Read first:**
- `docs/thinking-partner/TRACKER.md` and `NOW.md`
- `docs/sessions/identity/namespace.md`
- `planning/SPEC/IDENTITY_ENS.md`

**You own:** `packages/ens`, `scripts/ens`, the watcher, and the shop ENS labels in `packages/config/story.json`.

## Do, in order

1. **Register the three new shops:**
   - `filter-and-fold.graphpay.eth`, `idli-index.graphpay.eth` and `tawa-tangle.graphpay.eth`, each with its storefront, risk and dispatch agents.
   - Build them the same way as the existing shops: their own registry and resolvers, and the same records.
   - Point each at the wallet its old shop used, so no funds move: Kesar Kingdom's to Filter & Fold, Syrup Street's to Idli Index, Jamun Junction's to Tawa Tangle.
   - Keep the old names registered as history.
   - Add the new rows to `namespace.md`.
2. **Flip the shop labels in `story.json`** to the new names, in one small PR.
   - Do it only once W2 confirms the new shops' Arkiv rows and history are written. The Coordinator times it.
   - Afterwards, tell the Coordinator, so W5 restarts the workers.
3. **The kill:**
   - Keep one funded spare disposable agent ready, with its key in Vercel, unprinted.
   - A route unregisters it as its owner.
   - The watcher then revokes its spending pass, and its next payment is refused and recorded on Arkiv.
   - A fresh spare is then provisioned for the next kill.
   - List the route in OPEN under "frontend".

## Done when

- The new names resolve with their records.
- A live errand pays Filter & Fold through its new name.
- One kill on production is followed by a refused payment and a fresh spare.

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
  - Keep your relay at `docs/thinking-partner/relays/w1-identity.md`, under 800 words.
  - Add a line in NOW, and LOG lines as you go.
  - Tell the Coordinator as each item lands.
  - Ask the founder only for logins, funding or secrets.
