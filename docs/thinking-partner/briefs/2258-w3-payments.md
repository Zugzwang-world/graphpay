Received 22:58 IST, Fri 6 Nov, by W3 Payments (attached by the founder; from the thinking partner).

# W3 Payments: re-order, subscriptions, refunds, limits

From the thinking partner (claude.ai), via the founder, Fri 6 Nov. For: a fresh session on Opus 5.5, Max effort, in its own worktree.

**Goal:** every money action in the story works live, each with its explorer link and its Arkiv record.

**Read first:** `docs/thinking-partner/TRACKER.md` and `NOW.md`, then the payments and integration relays.

**You own:**
- the hosted shop and facilitator;
- the customer and merchant money routes in `apps/web/app/api`;
- the renewal and re-order keys in `packages/config/story.json`.

For ENS writes, use `packages/ens`'s existing helpers without editing that package. If one is missing, ask W1 through the Coordinator.

## Do, in order

1. **Re-order:** "Another coffee" pays 0.80 for the filter coffee, which is the story's re-order. It works live; it failed with `BAD_402` before.
2. **Subscriptions:**
   - Subscribe to the Sunday breakfast at 2.40 a week, on the labelled 2-minute demo clock. Store 2.40 on chain, not 0.40.
   - The renewal cron renews it, and the subscriber can cancel with its own signature.
   - Build the subscribe and cancel routes.
3. **Refunds:** the shop can decline a refund request, and the decline is recorded on Arkiv. Approving already works.
4. **Limits**, each recorded on Arkiv:
   - **Over the pass:** a payment above the payer's daily pass is refused. Build the route for the "dosas for everyone" moment.
   - **The owner changes the payer's cap,** in both the spending policy and the ENS record.
   - **The agent tries to raise its own cap in ENS and is refused.** Show the revert reason, whether or not the transaction is sent.

List every new route and event in OPEN under "frontend".

## Done when

Each action works once on production, with its explorer link and its Arkiv record.

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
  - Keep your relay at `docs/thinking-partner/relays/w3-payments.md`, under 800 words.
  - Add a line in NOW, and LOG lines as you go.
  - Tell the Coordinator as each item lands.
  - Ask the founder only for logins, funding or secrets.
