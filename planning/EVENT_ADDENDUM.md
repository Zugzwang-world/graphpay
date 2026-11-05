# EVENT ADDENDUM — approved additions (5 Nov), for the 9 pm build

Attach this together with `00-foundation.md`.

**Status:** knowledge only (specs, decisions, checks). Write all code fresh at the event. Copy no third-party code or designs.

**What to do with it:**
- Fold the "tonight" items into M5 (ENS) and M7 (Arkiv).
- Put the Friday items into the plan.
- Add the acceptance checks below to `ACCEPTANCE_TESTS.md`.
- Record each decision as an ADR.
- Items marked UNVERIFIED must be checked against installed SDK types, official docs or the sponsor booth before building on them.

## A. Arkiv: discovery, locked receipts, expiring activity

**Track:** Build on Arkiv (from scratch), plus the Arkiv + Swarm bonus. Judging has four equal parts: friction, reach, why Arkiv, and how you use Arkiv. The last one asks whether filters, edit rights and expirations fit the app, and whether users can see them.

### Conventions (all entities)
- Every entity carries `project="graphpay"`, `type=<entity type>`, `schema_v=1`.
- At most 30 user attributes per entity.
- Nothing private in attributes or payloads, because the network is public.
- Every read is scoped by `$owner` to our writer wallets, because the store is shared.
- **Two writers:**
  - the **money mirror** (single writer, money events only, unchanged);
  - a new **directory writer** (its own wallet) for directory, heartbeat, quote and handoff entities. It never writes money entities.
- **UNVERIFIED, ask the Arkiv booth:** what makes an entity count as "tagged" with a schema in the Rabdi explorer (align our schema tag with it), and what "stored" vs "indexed" attributes mean and how the installed SDK declares them.

### Tonight, inside M7

1. **`shop` directory entity: the discovery layer.**
   - Attributes: `shop_key` (ENS namehash + epoch), `shop_ens`, `category` (for example `sweets`), `area` (for example `bandra`), `city="mumbai"`, `lat` and `lng` as i32 (degrees × 1,000,000; for example 19.0760 becomes 19076000), `status`.
   - Payload: display name and opening hours.
   - Mutable by the directory writer.
   - Expiry: the event duration plus a margin.
   - The synthetic city uses fictional Mumbai shops with realistic neighbourhood coordinates, clearly labelled synthetic.
2. **Locked receipts.** Payment edges (lines) are created with the `readonly` flag.
   - Readonly locks payload and attributes. The owner can still extend, transfer or delete, so wording in the README and UI is "cannot be edited", not "permanent".
   - Scoreboards (tallies) stay mutable.
   - Check the flag syntax against the installed SDK types.
3. **`quote` entity**, written by the directory writer.
   - Attributes: `request_id`, `shop_key`, `agent_ens`, `price` (u64, 6 decimals), `valid_until`.
   - Expiry: 15 minutes.
   - The payer refuses a quote that has expired or is missing on Arkiv.
4. **Scout discovery query.** Filter by project, type `shop`, category, a `lat`/`lng` bounding box and `$owner` = directory writer, then join with the existing scoreboards. Use the installed SDK's real query syntax.
5. **Write `/arkiv/schema.md` now** (every entity: attributes and types, which are queried, owner, expiry with the reason).

### Friday
6. **`shop_open` heartbeat** (`shop_key`, `open_until`): expiry 15 minutes, renewed while the shop's "Open" toggle is on. When it lapses, the shop drops out of "open now" results.
7. **`agent_presence` heartbeat** (`agent_ens`, `owner_ens`, `role`, `session`): expiry 15 minutes, renewed while the agent runs.
8. **`handoff`** (`request_id`, `from_agent`, `to_agent`, `step`): expiry 30 minutes. It feeds the explainer's agent lane.
9. **Mumbai map on the website.**
   - Shop dots from the directory; open shops and live agents glow and fade when they lapse.
   - Every dot and every receipt opens its Rabdi explorer entity page.
   - Key queries are shared as explorer "run this query" links, which double as the README's runnable query.
10. **Swarm entities** `menu` and `refund_evidence`: see part C.
11. **`/arkiv` files:** `friction.md` (no slow-query shapes), `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`, `swarm.md`. In `how-you-use-arkiv.md`, include a table mapping each Arkiv feature to its user-visible effect: filters → discovery; expiry → open/online/quotes; readonly → uneditable receipts; owner → who may write.

### Acceptance checks (Arkiv)
- **Geo query:** returns only shops inside the bounding box, and only from our writer.
- **Readonly:** editing a receipt's attribute fails (negative test).
- **Quotes:** an expired quote is refused and the agent re-quotes.
- **(Friday) Heartbeats:** `shop_open` lapses within its window when the toggle is off; `agent_presence` appears on start and is gone 15 minutes or less after stop.
- **(Friday) Explorer links:** every dot and receipt on the website opens the right explorer page.

## B. ENS (tonight, inside M5)

1. **ENSIP-26 agent records.**
   - **graphpay.eth:** `agent-context` (a short Markdown description of GraphPay and its tools), `agent-endpoint[mcp]` (our MCP URL), `agent-endpoint[web]` (site URL).
   - **Every agent:** `agent-context`, plus `agent-endpoint[mcp]` or `[web]`.
2. **Whitechain receiving address.**
   - Each shop and paying agent sets an address for coinType `0x80000752` (2147485522; `toCoinType(1874)`).
   - The payer resolves the shop's address from ENS at pay time. No hard-coded addresses: the ENS prize forbids hard-coded values.
3. **Key-limited permissions (Enhanced Access Control).**
   - Use `grantSetterRoles` to give an agent only `setText` for `agent-context` and `setAddress` for coinType `0x80000752`.
   - Never `cap`, `status` or `payment-preference`.
   - Negative test: the agent's `setText('cap')` reverts.
4. **ENSIP-31 payment preference: experimental, behind a flag.** Use only if the ENS booth confirms the current key format.
   - The ERC-7930 value for test USDT on chain 1874 is `0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7`. A unit test must reproduce it.
   - Fallback: text record `x-graphpay-accepts` with the same value.
5. **Facts verified 5 Nov** (re-check at kickoff):
   - PermissionedResolver setters take the DNS-encoded name.
   - Reads go through the Universal Resolver proxy `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`, using `resolve(name, data)`.
   - The resolver emits `DataUpdated`.
   - The ENSv2 Sepolia addresses in the pack are still current.

### Acceptance checks (ENS)
- graphpay.eth's `agent-endpoint[mcp]` resolves to a reachable MCP server.
- The shop's coinType-1874 address equals the payee in the last settled payment.
- An agent can set `agent-context`; its `setText('cap')` reverts.
- The ERC-7930 unit test passes.
- A grep test finds no ENS or Whitechain address literals outside the config file.

## C. Swarm bonus (Friday)

- **Setup:**
  - a Bee light node or Swarm Desktop on the Mac;
  - pin bee-js 13.2.0 and use its namespaced API (check the type definitions; older docs show flat methods);
  - buy one postage batch by size and duration (`buyStorage`), not by hand-picked depth;
  - reads on Vercel go through `https://api.gateway.ethswarm.org/bzz/<ref>/…`.
- **Fallback (UNVERIFIED behaviour):** an unstamped upload through the public gateway from the server, disclosed honestly in `swarm.md`.
- **`menu` entity:** `shop_key`, `shop_ens`, `version`, `swarm_ref` (a 64-hex manifest reference).
- **`refund_evidence` entity:**
  - Attributes: `order_id`, `shop_key`, `buyer_key`.
  - The photo is uploaded encrypted. **Never put a 128-hex encrypted reference on Arkiv in plain form:** wrap it with AES, and add a regex test.
- **`/arkiv/swarm.md`, seven items:**
  1. what lives on Swarm vs Arkiv;
  2. one entity key, its reference and an openable link;
  3. the batch ID, buyer wallet and node or service;
  4. the upload and read files;
  5. run steps;
  6. the demo-video timestamp;
  7. what got in the way.
- **Ask the booth:** is there a shared hackathon batch, and is the public gateway acceptable?

## D. UI patterns (Friday, our own designs; Stripe and Privy as inspiration only)

- **Vitalik's phone:**
  - request card with a budget chip and a countdown;
  - agent feed: ENS name, action, status chip, and the reason for any decline;
  - **spending pass:** payee, cap, used/remaining, expiry and state (Active, Used up, Expired, Paused, Revoked);
  - receipt with explorer links;
  - refund request with photo (Requested, Accepted, Refunded);
  - **Pause agent** toggle, which writes the ENS status record.
- **Kesar Kingdom's phone:**
  - order pop-up showing the buyer agent's ENS name, its Arkiv reputation and the risk verdict;
  - Dispatch;
  - full or partial refund, with the evidence photo;
  - accountant CSV export;
  - notifications.
- **Explainer:** lanes Ask → Check → Check back → 402 quote → Pay. Every chip opens its explorer page.

## E. Placement and records
- **M5:** part B. **M7:** part A, items 1–5. **Friday:** everything else, scheduled by the backend plan.
- New ADRs: second writer wallet; locked receipts; expiring activity entities; ENS key-limited permissions; Swarm design.
- Thinking-partner folder: list the booth questions in `OPEN.md`, and update `NOW.md` and relays as usual.
