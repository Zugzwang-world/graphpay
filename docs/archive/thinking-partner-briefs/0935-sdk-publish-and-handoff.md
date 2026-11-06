Received 09:28 IST, Fri 6 Nov, by the Coordinator (attached by the founder; from the thinking partner). It replaces the founder's 09:15 publish message that named `@graphpay`.

# Brief: publish both SDKs, record the thinking partner's decisions, prepare the handoff

From the thinking partner (claude.ai), via the founder, about 09:35 IST, Fri 6 Nov. For: the Coordinator (cross-cutting).
File it in `docs/thinking-partner/briefs/` with your usual time prefix.

**This replaces the publish message the founder may have sent a few minutes earlier.** That message named the scope `@graphpay`. The founder's decision: the scope is **`@graphpay_ethglobal`** (the npm organisation he created). We do not claim `graphpay`.

## 1. Publish both SDKs by about 13:00 IST

**Packages**
- `@graphpay_ethglobal/arkiv-graph` (T3, the Arkiv lane).
- `@graphpay_ethglobal/agentpay` (T6, the Whitechain lane).

Rename them everywhere: `package.json`, imports, READMEs, ADR-0057, Friday item 18, `OPEN.md`, `FACTS.md`.

**Why today, not after the 21:30 reset:** the founder will ask developers at the venue to try both packages today, collect their requests, and ship new versions. Their feedback is also real-usage evidence for the Arkiv and Whitechain judges.

**Readiness checklist, per package.** Use Sonnet sessions where possible (usage was 82% at 08:51).
1. A README quickstart that works in 5 minutes, one example and a CHANGELOG.
   - arkiv-graph's example: not payments (a leaderboard).
   - agentpay's examples: the sweet shop and a fixed-fare cab ride.
   - The full API reference can follow in 0.1.x.
2. Version `0.1.0`, `publishConfig.access` set to `public`, a `files` list, and a license. Default MIT unless the founder objects.
3. **Self-contained:** no workspace-only dependencies (inline the checkout ABIs into agentpay). Then pack each package, install the tarball in an empty folder, and run the quickstart from there.
4. **AgentPay safety (blocking):**
   - Testnet only: V1 refuses any chain but 1874.
   - It never defaults to GraphPay's hosted facilitator or relayer. Developers bring their own relayer key, with the anti-drain limits on by default. Strangers must not be able to spend our gas or break the demo.
   - Run the reviewer on this before publishing.
5. **Lane tests:** arkiv-graph keeps its no-payment-words test. Add a test that fails if agentpay imports anything from our Arkiv or ENS packages.
6. **Feedback:** a `FEEDBACK.md` per package (date, who, what they asked, outcome), plus GitHub issue labels `arkiv-graph`, `agentpay` and `feedback`.

**Publish**
- **Hand-off to the founder:** tell him when both are ready. He runs `npm login` in a Terminal tab (a two-hour session; his 2FA is set up) and approves the prompts.
- **Command:** publish with `pnpm publish --access public`, so workspace links are rewritten.
- **Check:** install each package from the registry in an empty folder and run its quickstart.
- **Record:** the versions and npm links in `FACTS.md`, the sponsor files and the README.

**Versions:** 0.1.x for fixes, 0.2.0 for changes. After submission (Sat 08:00), freeze the published versions until judging ends.

## 2. Decisions from the thinking-partner chat

Record these as ADRs where they change the plan.

- **One SDK per partner, each in its own lane;** the GraphPay app combines them.
  - **Arkiv:** `arkiv-graph`.
  - **Whitechain:** `agentpay`, a universal two-sided kit for agentic stablecoin payments.
    - Buyer side: agents with on-chain spending passes, pay with one signature and no gas, refunds and subscriptions, plus AI tools.
    - Merchant side: middleware, events, refunds, renewals and CSV export, plus merchant agent tools and a pluggable risk check.
    - V1 handles fixed-price orders only; pre-authorisation for variable fares is V2.
  - **ENS:** an agent-identity kit (subnames, scoped permissions, kill switch), only if Friday has time. Otherwise it is named as the next step.
- **Demo:** a 15–20 second "same kit, different business" moment (the cab ride) for Whitechain's judges, placed when the story locks.
- **Front-end team, in parallel:**
  - The founder's human team builds its own UI in `apps/demo-ui`, from `FRONTEND_HANDOVER.md`. T5 keeps `apps/web`; nothing changes for T5.
  - Their PRs touch only `apps/demo-ui`, and CI must accept the new app.
  - Teammates commit from their own GitHub accounts and must be on the ETHGlobal team.
  - Later the founder compares both UIs and combines the best.
- **T6 AgentPay** is a standing session; its scope and boundaries are in its 03:xx brief.

## 3. Founder items to keep in OPEN.md ("Founder now")

1. **Story lock:** overdue against 08:30; the latest is 13:00, because the large city must start seeding by 14:00.
2. **Extra usage with a cap:** 82% at 08:51, the pause line is 92%, and the reset is at 21:30.
3. **FUNDER holds 15.54 test USDT:** state the exact top-up today's real runs need.
4. **ADR-0059 appears twice** (T2's zero cap and the npm scope): renumber one.

## 4. Handoff

After this, the founder opens a fresh thinking-partner chat, which reads the synced `docs/thinking-partner/` folder. Before he syncs:
- File this brief.
- Make the NOW.md summary current and time-stamped: the SDK publish status, story-lock status, usage, open founder items and anything blocked.
- Merge the docs PR promptly.
- Tell the founder when it has merged.
