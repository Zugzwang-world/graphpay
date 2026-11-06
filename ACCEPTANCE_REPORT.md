# Acceptance report

Written by `pnpm acceptance` at 2026-11-06T08:05:32.312Z. Checks and pass criteria: `planning/ACCEPTANCE_TESTS.md` and `docs/plan/ACCEPTANCE_ADDITIONS.md`. Only D7 may be `blocked` (C7 and E3 no longer wait on supply, ADR-0054); a check without a result is `not run`, never `pass`.

**45 pass, 0 fail, 1 blocked, 2 not run** (of 48).

| id | check | status | note |
|---|---|---|---|
| A1 | CI is green (at M0 the `contracts` job runs a placeholder Foundry project) | pass |  |
| A2 | The secret scan is clean | pass |  |
| A3 | Deny rules block reads of `.env` | pass |  |
| A4 | Auto-merge works | pass |  |
| A5 | The event wallets are fresh, except FUNDER and OPERATOR | pass |  |
| A6 | `planning/` and the thinking-partner folder are in place | pass |  |
| A7 | No known address literal in code outside the config file (D6) | pass |  |
| A8 | No story name or value in code outside the story file (ADR-0047) | pass |  |
| A9 | The agent presets are accepted (ADR-0048) | pass |  |
| A10 | The Whitechain RPC rules hold (ADR-0031) | pass |  |
| B1 | The `graphpay.eth` namespace resolves; all owners and agents exist | pass |  |
| B2 | The gate passes active agents | pass |  |
| B3 | A scoped role stops an agent raising its own cap | pass |  |
| B4 | The payment preference parses | pass |  |
| B5 | A synthetic wildcard name resolves | pass |  |
| B6 | Killing a disposable agent makes the gate deny it | pass |  |
| B7 | The epoch changes on re-registration (fork test) | not run | no fork test for a new registration after a lapse or an unregister (only renew keeping the epoch); needs an anvil fork of Sepolia |
| B8 | ENSIP-26 records exist and the MCP endpoint answers | pass |  |
| B9 | The payee is the shop's ENS address | not run |  |
| C1 | Contracts are verified on the explorer | pass |  |
| C2 | A payment through the facilitator costs the payer no gas | pass |  |
| C3 | Partial refund, re-order and renewal work | pass |  |
| C4 | Revoked-agent and over-cap failures are recorded | pass |  |
| C5 | A repeat request returns "already paid" | pass |  |
| C6 | Hosted endpoints return 401 without the passcode or token | pass |  |
| C7 | **The qualifying payment in test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`** | pass |  |
| D1 | One payment event writes its edge and tallies in one atomic batch | pass |  |
| D2 | A retry with the same nonce creates no duplicate | pass |  |
| D3 | Tallies recomputed from edges equal the stored tallies | pass |  |
| D4 | GraphQL's top 10 matches the ground truth | pass |  |
| D5 | The explain trace lists the reads behind each answer | pass |  |
| D6 | Benchmark at size S | pass |  |
| D7 | Benchmark at size M, if seeded | blocked | waiting for the locked story (the M city is seeded only after the founder locks it) |
| D8 | The geo query returns only shops inside the box, and only from our writers | pass |  |
| D9 | A receipt cannot be edited | pass |  |
| D10 | An expired or missing quote is refused and the agent re-quotes | pass |  |
| D15 | The mirror resumes after a sleep or a network drop (ADR-0056) | pass |  |
| E1 | Vitalik's request | pass |  |
| E2 | The agents choose Kesar Kingdom, never the trap | pass |  |
| E3 | The payment is made in USDT on Whitechain | pass |  |
| E4 | The mirror writes it to Arkiv | pass |  |
| E5 | GraphQL shows the new edge and the updated tallies | pass |  |
| E6 | A refund updates the tallies | pass |  |
| E7 | A killed agent is refused | pass |  |
| E8 | Every counting errand records its time and cost (ADR-0048) | pass |  |
| F1 | No secrets are in the repo | pass |  |
| F2 | Spending endpoints are passcode-gated | pass |  |
| F3 | The relayer's safety floor is enforced | pass |  |

## A1: CI is green (at M0 the `contracts` job runs a placeholder Foundry project)

Status: **pass**.

### A1 (2026-11-05T22:50:47.454Z)

- What: CI is green on main
- Pass: true
- Expected: the latest ci run on main: success
- Evidence: `{"url":"https://github.com/Zugzwang-world/graphpay/actions/runs/42124115751"}`

```json
{
  "conclusion": "success",
  "headSha": "54af4519888c4d1cb6aa3f3b7d5caf6cfa2b94ae",
  "url": "https://github.com/Zugzwang-world/graphpay/actions/runs/42124115751"
}
```

## A2: The secret scan is clean

Status: **pass**.

### A2 (2026-11-05T22:50:47.934Z)

- What: the secret scan is clean (pnpm check)
- Pass: true
- Expected: check: clean
- Evidence: `{"cmd":"pnpm -s check"}`

```json
[
  "check: clean (590 files)"
]
```

## A3: Deny rules block reads of `.env`

Status: **pass**.

### A3 (2026-11-05T23:52:17.334Z)

- What: deny rules block reads of .env
- Pass: true
- Expected: every rule of SPEC/SECURITY_AND_OPS.md §2 present; the self-check shows the Read of .env refused (P-foundation-3: the wording changed, the block holds)
- Evidence: `{"settings":".claude/settings.json","spec":"planning/SPEC/SECURITY_AND_OPS.md §2","selfCheck":"docs/thinking-partner/relays/foundation.md","wording":"docs/problems/PROBLEM_LOG.md P-foundation-3"}`

```json
{
  "listed": 30,
  "deny": 34,
  "missing": [],
  "extra": [
    "Bash(vercel project ls*)",
    "Bash(vercel project list*)",
    "Bash(vercel projects ls*)",
    "Bash(vercel projects list*)"
  ],
  "selfCheck": "**A3 self-check.** An empty `.env` was created by a script (a direct write is refused once the deny rules load). The `Read` of `.env` was refused with: `File is in a directory that is denied by your permission settings.` The shell `cat .env` was refused with: `Permission to use Bash with command cat"
}
```

## A4: Auto-merge works

Status: **pass**.

### A4 (2026-11-05T23:52:19.406Z)

- What: auto-merge works
- Pass: true
- Expected: auto-merge on, squash only, delete-on-merge on; required check ci, admins enforced, linear history, no force-push; a docs PR merged by auto-merge after ci passed
- Evidence: `{"cmd":"gh api repos/{owner}/{repo}; gh api repos/{owner}/{repo}/branches/main/protection; gh pr list --state merged (read-only)","pr":"https://github.com/Zugzwang-world/graphpay/pull/62"}`

```json
{
  "repo": {
    "allow_auto_merge": true,
    "allow_merge_commit": false,
    "allow_rebase_merge": false,
    "allow_squash_merge": true,
    "delete_branch_on_merge": true,
    "full_name": "Zugzwang-world/graphpay"
  },
  "protection": {
    "admins": true,
    "checks": [
      "ci"
    ],
    "forcePush": false,
    "linear": true
  },
  "pr": {
    "number": 62,
    "url": "https://github.com/Zugzwang-world/graphpay/pull/62",
    "autoMergeRequest": {
      "mergeMethod": "SQUASH",
      "enabledAt": "2026-11-05T23:41:27Z"
    },
    "mergedAt": "2026-11-05T23:43:25Z",
    "ci": {
      "conclusion": "SUCCESS",
      "completedAt": "2026-11-05T23:43:16Z"
    }
  }
}
```

## A5: The event wallets are fresh, except FUNDER and OPERATOR

Status: **pass**.

### A5 (2026-11-05T23:29:28.194Z)

- What: the event wallets are fresh, except FUNDER and OPERATOR
- Pass: true
- Expected: only FUNDER and OPERATOR carried; no two roles share an address
- Evidence: `{"cmd":"pnpm -s wallets:addresses (addresses only)"}`

```json
{
  "roles": 21,
  "carried": [
    "FUNDER",
    "OPERATOR"
  ],
  "sharedAddresses": 0
}
```

## A6: `planning/` and the thinking-partner folder are in place

Status: **pass**.

### A6 (2026-11-05T22:50:47.934Z)

- What: `planning/` and the thinking-partner folder are in place
- Pass: true
- Expected: all present
- Evidence: `{"files":["planning/README.md","planning/ACCEPTANCE_TESTS.md","docs/thinking-partner/NOW.md","docs/thinking-partner/OPEN.md","docs/thinking-partner/LOG.md"]}`

```json
{
  "missing": []
}
```

## A7: No known address literal in code outside the config file (D6)

Status: **pass**.

### A7 (2026-11-05T22:50:48.309Z)

- What: no known address literal outside the config (pnpm check)
- Pass: true
- Expected: no address-literal finding
- Evidence: `{"cmd":"pnpm -s check"}`

```json
[
  "check: clean (592 files)"
]
```

## A8: No story name or value in code outside the story file (ADR-0047)

Status: **pass**.

### A8 (2026-11-05T22:50:48.683Z)

- What: no story name or value outside the story file (pnpm check)
- Pass: true
- Expected: no story finding
- Evidence: `{"cmd":"pnpm -s check"}`

```json
[
  "check: clean (593 files)"
]
```

## A9: The agent presets are accepted (ADR-0048)

Status: **pass**.

### A9 (2026-11-05T23:52:19.409Z)

- What: the agent presets are accepted
- Pass: true
- Expected: every preset of story.json's agentModels has a probe row with its model and effort, accepted, seconds and cost recorded; the live preset over three turns
- Evidence: `{"file":"docs/thinking-partner/OPEN.md (preset calibration)","cmd":"pnpm agents:probe (recorded, not re-run)"}`

```json
[
  {
    "preset": "testing",
    "want": [
      "`claude-opus-5-5`, xhigh"
    ],
    "row": {
      "time": "22:54",
      "run": "M0 probe (one-word reply, not an errand)",
      "model": "`claude-opus-5-5`, xhigh",
      "seconds": "2.2",
      "cost": "$0.0005",
      "notes": "accepted"
    },
    "ok": true
  },
  {
    "preset": "video",
    "want": [
      "`claude-opus-5-5`, xhigh"
    ],
    "row": {
      "time": "22:54",
      "run": "M0 probe (one-word reply, not an errand)",
      "model": "`claude-opus-5-5`, xhigh",
      "seconds": "1.6",
      "cost": "$0.0006",
      "notes": "accepted"
    },
    "ok": true
  },
  {
    "preset": "live",
    "want": [
      "`claude-haiku-5-5`, xhigh"
    ],
    "row": {
      "time": "22:54",
      "run": "M0 probe (one word, then three short turns)",
      "model": "`claude-haiku-5-5`, xhigh",
      "seconds": "0.9; turns 0.9 / 0.9 / 1.9",
      "cost": "under $0.0002 in all",
      "notes": "accepted; no empty reply, no `max_tokens`; once the same answer in two text blocks (read the final block)"
    },
    "ok": true
  }
]
```

## A10: The Whitechain RPC rules hold (ADR-0031)

Status: **pass**.

### A10 (2026-11-05T23:52:20.056Z)

- What: the Whitechain RPC rules hold
- Pass: true
- Expected: config tests pass (wrong chain and plain http refused, no URL in errors); the secret URL chosen first at 1874; the hook masks a keyed Ankr URL and the scan refuses it
- Evidence: `{"cmd":"node --test packages/config/test/config.test.mjs; resolveRpc(whitechain) label-only (eth_chainId reads); buildLine + scanText in process on scripts/test/samples.mjs","fact":"docs/technical/FACTS.md \"Founder's Ankr RPC\"","hookAndScanM0":"docs/thinking-partner/COVERAGE.md (23:10 proof)"}`

```json
{
  "tests": {
    "exit": 0,
    "pass": 13,
    "fail": 0
  },
  "live": {
    "label": "WHITECHAIN_RPC_URL (secret)",
    "secret": true,
    "chainId": 1874,
    "refused": []
  },
  "secretFirst": "measured now",
  "proof": {
    "hookMasks": true,
    "scanRefuses": true
  }
}
```

## B1: The `graphpay.eth` namespace resolves; all owners and agents exist

Status: **pass**.

### B1 (2026-11-05T22:52:28.170Z)

- What: the graphpay.eth namespace resolves; all owners and agents exist
- Pass: true
- Expected: every line of scripts/ens/acceptance.mjs for this id passes
- Evidence: `{"script":"scripts/ens/acceptance.mjs","exit":0}`

```json
[
  "pass B1 vitalik.graphpay.eth registered, epoch 0, node 0xbaff83a5…",
  "pass B1 vitalik.graphpay.eth kind human",
  "pass B1 vitalik.graphpay.eth status active",
  "pass B1 kesar-kingdom.graphpay.eth registered, epoch 0, node 0xb70f3815…",
  "pass B1 kesar-kingdom.graphpay.eth kind shop",
  "pass B1 kesar-kingdom.graphpay.eth status active",
  "pass B1/B9a kesar-kingdom.graphpay.eth coin type 2147485522 address is SHOP_KESAR's wallet",
  "pass B1 jamun-junction.graphpay.eth registered, epoch 0, node 0x4db52531…",
  "pass B1 jamun-junction.graphpay.eth kind shop",
  "pass B1 jamun-junction.graphpay.eth status active",
  "pass B1/B9a jamun-junction.graphpay.eth coin type 2147485522 address is SHOP_JAMUN's wallet",
  "pass B1 syrup-street.graphpay.eth registered, epoch 0, node 0x3b3147a7…",
  "pass B1 syrup-street.graphpay.eth kind shop",
  "pass B1 syrup-street.graphpay.eth status active",
  "pass B1/B9a syrup-street.graphpay.eth coin type 2147485522 address is SHOP_SYRUP's wallet",
  "pass B1 concierge.vitalik.graphpay.eth registered, epoch 0, node 0xe40213aa…",
  "pass B1 concierge.vitalik.graphpay.eth kind agent",
  "pass B1 concierge.vitalik.graphpay.eth status active",
  "pass B1 scout.vitalik.graphpay.eth registered, epoch 0, node 0xd7c50409…",
  "pass B1 scout.vitalik.graphpay.eth kind agent",
  "pass B1 scout.vitalik.graphpay.eth status active",
  "pass B1/B9a scout.vitalik.graphpay.eth coin type 2147485522 address is DEAL_HUNTER's wallet",
  "pass B1 analyst.vitalik.graphpay.eth registered, epoch 0, node 0x664f105d…",
  "pass B1 analyst.vitalik.graphpay.eth kind agent",
  "pass B1 analyst.vitalik.graphpay.eth status active",
  "pass B1 payer.vitalik.graphpay.eth registered, epoch 0, node 0xdb661831…",
  "pass B1 payer.vitalik.graphpay.eth kind agent",
  "pass B1 payer.vitalik.graphpay.eth status active",
  "pass B1/B9a payer.vitalik.graphpay.eth coin type 2147485522 address is PAYER's wallet",
  "pass B1 rehearsal.vitalik.graphpay.eth registered, epoch 0, node 0xa03a8a93…",
  "pass B1 rehearsal.vitalik.graphpay.eth kind agent",
  "pass B1 rehearsal.vitalik.graphpay.eth status active",
  "pass B1/B9a rehearsal.vitalik.graphpay.eth coin type 2147485522 address is REHEARSAL_PAYER's wallet",
  "pass B1 acceptance.vitalik.graphpay.eth registered, epoch 0, node 0xcdcbf48c…",
  "pass B1 acceptance.vitalik.graphpay.eth kind agent",
  "pass B1 acceptance.vitalik.graphpay.eth status active",
  "pass B1/B9a acceptance.vitalik.graphpay.eth coin type 2147485522 address is ACCEPTANCE_PAYER's wallet",
  "pass B1 storefront.kesar-kingdom.graphpay.eth registered, epoch 0, node 0xc62644e0…",
  "pass B1 storefront.kesar-kingdom.graphpay.eth kind agent",
  "pass B1 storefront.kesar-kingdom.graphpay.eth status active",
  "pass B1 risk.kesar-kingdom.graphpay.eth registered, epoch 0, node 0x535836c3…",
  "pass B1 risk.kesar-kingdom.graphpay.eth kind agent",
  "pass B1 risk.kesar-kingdom.graphpay.eth status active",
  "pass B1 dispatch.kesar-kingdom.graphpay.eth registered, epoch 0, node 0x260b20d3…",
  "pass B1 dispatch.kesar-kingdom.graphpay.eth kind agent",
  "pass B1 dispatch.kesar-kingdom.graphpay.eth status active",
  "pass B1 storefront.jamun-junction.graphpay.eth registered, epoch 0, node 0x86accf39…",
  "pass B1 storefront.jamun-junction.graphpay.eth kind agent",
  "pass B1 storefront.jamun-junction.graphpay.eth status active",
  "pass B1 risk.jamun-junction.graphpay.eth registered, epoch 0, node 0x45306e1d…",
  "pass B1 risk.jamun-junction.graphpay.eth kind agent",
  "pass B1 risk.jamun-junction.graphpay.eth status active",
  "pass B1 dispatch.jamun-junction.graphpay.eth registered, epoch 0, node 0x7b1d4ed3…",
  "pass B1 dispatch.jamun-junction.graphpay.eth kind agent",
  "pass B1 dispatch.jamun-junction.graphpay.eth status active",
  "pass B1 storefront.syrup-street.graphpay.eth registered, epoch 0, node 0x670631d0…",
  "pass B1 storefront.syrup-street.graphpay.eth kind agent",
  "pass B1 storefront.syrup-street.graphpay.eth status active",
  "pass B1 risk.syrup-street.graphpay.eth registered, epoch 0, node 0xc97b0969…",
  "pass B1 risk.syrup-street.graphpay.eth kind agent",
  "pass B1 risk.syrup-street.graphpay.eth status active",
  "pass B1 dispatch.syrup-street.graphpay.eth registered, epoch 0, node 0xa46bff94…",
  "pass B1 dispatch.syrup-street.graphpay.eth kind agent",
  "pass B1 dispatch.syrup-street.graphpay.eth status active",
  "pass B1 no two paying agents share a wallet"
]
```

## B2: The gate passes active agents

Status: **pass**.

### B2 (2026-11-05T22:52:44.691Z)

- What: the gate passes active agents
- Pass: true
- Expected: every paying agent of the story passes the full gate (ENS and its checkout policy)
- Evidence: `{"checkout":"0x75233b7341B9e86407e4b31599f07b8936716FcA"}`

```json
[
  {
    "name": "scout.vitalik.graphpay.eth",
    "ok": true,
    "reason": null,
    "capMicro": "1000000"
  },
  {
    "name": "payer.vitalik.graphpay.eth",
    "ok": true,
    "reason": null,
    "capMicro": "6000000"
  },
  {
    "name": "rehearsal.vitalik.graphpay.eth",
    "ok": true,
    "reason": null,
    "capMicro": "30000000"
  },
  {
    "name": "acceptance.vitalik.graphpay.eth",
    "ok": true,
    "reason": null,
    "capMicro": "6000000"
  }
]
```

## B3: A scoped role stops an agent raising its own cap

Status: **pass**.

### B3 (2026-11-05T23:52:24.075Z)

- What: a scoped role stops an agent raising its own cap
- Pass: true
- Expected: agent-context setText lands as the agent's own key; setAddress 2147485522 simulates ok; cap_micro, status, x-graphpay-accepts, agent-endpoint[mcp] setText and setAddress(60) revert EACUnauthorizedAccountRoles in simulation, none sent
- Evidence: `{"tx":"https://sepolia.etherscan.io/tx/0x12f009dfe98a8a5a7b4cab317774cb4d79fc40c64a16bff8cb9093052c7e456e","name":"acceptance.vitalik.graphpay.eth","file":"docs/technical/FACTS.md \"Setter scope\" (T2, b3-real.mjs --send, 02:25 IST; not re-run)","receipt":"read again now (Sepolia, read-only)"}`

```json
{
  "tx": {
    "status": "success",
    "fn": "setText",
    "key": "agent-context",
    "fromIsHolder": true,
    "toIsResolver": true,
    "gasUsed": 59046
  },
  "refusedRecorded": true
}
```

## B4: The payment preference parses

Status: **pass**.

### B4 (2026-11-05T22:52:44.692Z)

- What: the payment preference parses
- Pass: true
- Expected: every line of scripts/ens/acceptance.mjs for this id passes
- Evidence: `{"script":"scripts/ens/acceptance.mjs","exit":0}`

```json
[
  "pass B4 kesar-kingdom.graphpay.eth accepts 0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7",
  "pass B4 jamun-junction.graphpay.eth accepts 0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7",
  "pass B4 syrup-street.graphpay.eth accepts 0x0001000002075214cedfb56113143d55b2358b8cfbb0deb5ad2f55a7",
  "pass B4 a malformed copy is ignored whole"
]
```

## B5: A synthetic wildcard name resolves

Status: **pass**.

### B5 (2026-11-05T22:52:44.693Z)

- What: a synthetic wildcard name resolves
- Pass: true
- Expected: every line of scripts/ens/acceptance.mjs for this id passes
- Evidence: `{"script":"scripts/ens/acceptance.mjs","exit":0}`

```json
[
  "pass B5 acceptance-sh8bfy.sim.graphpay.eth graphpay.synthetic=true",
  "pass B5 wildcard kind agent",
  "pass B5 wildcard status empty",
  "pass B5 the walk says ENS_SYNTHETIC"
]
```

## B6: Killing a disposable agent makes the gate deny it

Status: **pass**.

### B6 (2026-11-05T23:26:19.713Z)

- What: killing a disposable agent makes the gate deny it
- Pass: true
- Expected: the gate denies ENS_EXPIRED_OR_REVOKED after the owner unregisters
- Evidence: `{"file":"docs/sessions/integration/runs/kill-disposable-1/kill.json","kill":"kill disposable-1.vitalik.graphpay.eth: done (block 12072701, tx 0x785a13f119ab77f67c1ed8dfa6f1213708fde4f43158122a357e72c018acf29f)","alive":"0x763973499f7f7eb7bdda058fa03ee3d9f9480be53d75bc4574c62d7beec84b9c"}`

```json
{
  "reason": "ENS_EXPIRED_OR_REVOKED",
  "secondsAfterKill": 9.3
}
```

## B7: The epoch changes on re-registration (fork test)

Status: **not run** (no fork test for a new registration after a lapse or an unregister (only renew keeping the epoch); needs an anvil fork of Sepolia).

### B7 (2026-11-05T23:52:24.077Z)

- What: the epoch changes on re-registration (fork test)
- Pass: null
- Expected: renew keeps e; a new registration after a lapse gets e + 1; after unregister +1 (AVAILABLE view +2)
- Evidence: `{"dir":"packages/ens/test-fork","cmd":"pnpm --filter @graphpay/ens test:fork (not run: needs FORK_URL)"}`

```json
{
  "epochTests": [
    "gate.fork.test.mjs: a lapse then renew revives the same epoch; a never-registered label is the next free disposable",
    "namespace.fork.test.mjs: B1/B2 on the fork: every name of the cast walks ok, is REGISTERED at epoch 0 with its own factory-proxy resolver"
  ]
}
```

## B8: ENSIP-26 records exist and the MCP endpoint answers

Status: **pass**.

### B8 (2026-11-05T22:52:44.693Z)

- What: ENSIP-26 records exist and the MCP endpoint answers
- Pass: true
- Expected: every line of scripts/ens/acceptance.mjs for this id passes
- Evidence: `{"script":"scripts/ens/acceptance.mjs","exit":0}`

```json
[
  "pass B8 graphpay.eth agent-context",
  "pass B8 graphpay.eth agent-endpoint[mcp] = https://graphpay-event.vercel.app/api/mcp",
  "pass B8 graphpay.eth agent-endpoint[web] = https://graphpay-event.vercel.app",
  "pass B8 concierge.vitalik.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 scout.vitalik.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 analyst.vitalik.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 payer.vitalik.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 rehearsal.vitalik.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 acceptance.vitalik.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 storefront.kesar-kingdom.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 risk.kesar-kingdom.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 dispatch.kesar-kingdom.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 storefront.jamun-junction.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 risk.jamun-junction.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 dispatch.jamun-junction.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 storefront.syrup-street.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 risk.syrup-street.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 dispatch.syrup-street.graphpay.eth agent-context and agent-endpoint[mcp]",
  "pass B8 https://graphpay-event.vercel.app/api/mcp: initialize and tools/list = schema, ask, graphql, explain"
]
```

## B9: The payee is the shop's ENS address

Status: **not run**.

### B9 (2026-11-06T00:13:18.602Z)

- What: the payee is the shop's ENS address
- Pass: null
- Expected: every line of scripts/ens/acceptance.mjs for this id passes
- Evidence: `{"script":"scripts/ens/acceptance.mjs","exit":0}`

```json
[]
```

## C1: Contracts are verified on the explorer

Status: **pass**.

### C1 (2026-11-05T22:52:45.975Z)

- What: the checkout is verified on the explorer
- Pass: true
- Expected: is_verified true
- Evidence: `{"url":"https://explorer.testnet.whitechain.io/address/0x75233b7341B9e86407e4b31599f07b8936716FcA?tab=contract"}`

```json
{
  "is_verified": true,
  "is_fully_verified": false,
  "name": "GraphPayCheckout"
}
```

## C2: A payment through the facilitator costs the payer no gas

Status: **pass**.

### C2 (2026-11-06T00:03:11.096Z)

- What: a payment through the facilitator costs the payer no gas
- Pass: true
- Expected: payer WBT identical; PaymentSettled; tx.from = the relayer; gas 312,024 or 234,292–252,082, ±15%; the quote key and the ENS payee read
- Evidence: `{"file":"docs/sessions/integration/hosted/paid-2026-11-06T00-00-52-957Z.json","startedAt":"2026-11-06T00:00:52.957Z","site":"https://graphpay-event.vercel.app"}`

```json
{
  "pass": true,
  "tx": "0x7c6b60e23cd92cc4efb4e0557df9d455aa093ea89ed35dc4f2f7429d64afa0c8",
  "explorer": "https://explorer.testnet.whitechain.io/tx/0x7c6b60e23cd92cc4efb4e0557df9d455aa093ea89ed35dc4f2f7429d64afa0c8",
  "gasUsed": 254294,
  "wbt": {
    "before": "5000000000000000",
    "after": "5000000000000000"
  },
  "from": "0x1ab82871c3e1be64717269d45f08ca9d54c1ebf6",
  "relayer": "0x1AB82871c3E1Be64717269D45F08cA9d54C1EBf6",
  "settled": {
    "amountMicro": "4800000",
    "orderId": "0x2c3b4236932c802cdd548d8ce3ea877d343a99e2a135b2f10460870778fb6844"
  },
  "delivery": "delivered",
  "quoteKey": "0x79848ec90f9b711352dd29789cc74549bcae6859eefab10627e411a2e85bd8cf",
  "payeeRead": {
    "payee": "0x26940565cb470e25B06F5a39cB4E3B98b3e0d03E",
    "node": "0xb70f38151e07566a895abd7d378d9a50fe295893cb665172c1162bedacd25a9c",
    "epoch": 0
  },
  "payerGate": {
    "ok": true
  }
}
```

## C3: Partial refund, re-order and renewal work

Status: **pass**.

### C3 (2026-11-06T00:03:12.274Z)

- What: partial refund, re-order and renewal work
- Pass: true
- Expected: Refunded(800000, full false), payer +0.80, gas 75,344 ±15%; re-order OrderCreated(kind 1, parent) + PaymentSettled 1.20, gas 252,082 ±15%; SubscriptionRenewed(cycle 2) + PaymentSettled of a kind-2 order, gas 201,555 ±15%
- Evidence: `{"file":"docs/sessions/integration/hosted/paid-2026-11-06T00-00-52-957Z.json","startedAt":"2026-11-06T00:00:52.957Z","site":"https://graphpay-event.vercel.app","renewal":{"tx":"https://explorer.testnet.whitechain.io/tx/0x48b14aa45f56d487dee743721416a359fed96296b3ad0ababf546838f55e480f","by":"the hosted cron as RENEWER (T1's M4)","subscription":"the rehearsal agent's 120 s demo subscription (C3 asks only for cycle 2 and a kind-2 PaymentSettled)"}}`

```json
{
  "refund": true,
  "reorder": true,
  "renewal": true,
  "refundTx": {
    "tx": "0x0d04220e9a26243f919715e649d85681439dc4f2a492618bb1f1a916df9fe33f",
    "explorer": "https://explorer.testnet.whitechain.io/tx/0x0d04220e9a26243f919715e649d85681439dc4f2a492618bb1f1a916df9fe33f",
    "gasUsed": 75323,
    "amountMicro": "800000",
    "full": false,
    "payerDelta": "800000",
    "pass": true
  },
  "reorderTx": {
    "tx": "0xb77851de876e39556a5c690e938e8fda69e5aa69ef5079a20b85aadcdf27e3d2",
    "explorer": "https://explorer.testnet.whitechain.io/tx/0xb77851de876e39556a5c690e938e8fda69e5aa69ef5079a20b85aadcdf27e3d2",
    "gasUsed": 244343,
    "kind": 1,
    "parent": "0x2c3b4236932c802cdd548d8ce3ea877d343a99e2a135b2f10460870778fb6844",
    "amountMicro": "1200000",
    "quoteKey": "0x0b0e824396410493214b17f5aaf78f5a3076777b8d56ad504b8949d545b5b118",
    "pass": true
  },
  "renewalTx": {
    "cycle": 2,
    "orderKind": 2,
    "settledMicro": "400000",
    "gasUsed": 222881,
    "from": "0x4dcb3564ede867001179ba695ef298e73005869c",
    "fromIsRelayer": true
  }
}
```

## C4: Revoked-agent and over-cap failures are recorded

Status: **pass**.

### C4 (2026-11-06T00:14:29.293Z)

- What: revoked-agent and over-cap failures are recorded
- Pass: true
- Expected: (a) PaymentFailed(AGENT_REVOKED), gas 160,525 ±15%, an on-chain fail edge; (b) 402 CAP_EXCEEDED, no transaction, an off-chain fail edge
- Evidence: `{"file":"docs/sessions/integration/hosted/paid-2026-11-06T00-00-52-957Z.json","startedAt":"2026-11-06T00:00:52.957Z","site":"https://graphpay-event.vercel.app"}`

```json
{
  "b": {
    "pass": true,
    "status": 402,
    "reason": "CAP_EXCEEDED",
    "relayerNonce": {
      "before": 12,
      "after": 12
    },
    "failEdge": {
      "entityKey": "0x1bd8324c4e695b5add4941ed96c90f933f639d0e0e3b2fdffd120bed963b54b7",
      "kind": "fail",
      "ref": "att:0x2d43695c83fd381d83edba571049cf18e6749f431a3681a5d66774e9b7a9c712:0x1a2a5a6c6fd1a8cff8632814ef8fa395726b837f:d354975b",
      "reason": null
    }
  },
  "a": {
    "pass": true,
    "chainChecked": true,
    "file": "docs/sessions/integration/hosted/c4a-2026-11-06T00-07-29-876Z.json",
    "attempt": {
      "status": 402,
      "reason": "AGENT_REVOKED",
      "orderId": "0x6af2397b92461068b29850e41167e9bed2018606793ed8e0dfba85526989b4ef",
      "tx": "0x312d31320300c20205ac46a66501ac4738c2ac572ef1abebd21534765aee6021",
      "explorer": "https://explorer.testnet.whitechain.io/tx/0x312d31320300c20205ac46a66501ac4738c2ac572ef1abebd21534765aee6021",
      "gasUsed": 136574,
      "paymentFailed": {
        "reason": 1,
        "logIndex": 1,
        "ref": "1874:0x312d31320300c20205ac46a66501ac4738c2ac572ef1abebd21534765aee6021:1"
      }
    },
    "revoke": "https://explorer.testnet.whitechain.io/tx/0x4fc9dabb3d9c1a16f56c30aeac5a18bda720c8dabab7f5b881359f89ef5534bc",
    "restore": "https://explorer.testnet.whitechain.io/tx/0xbafe960b7e34da24e8b84da0822f89ca4ad965263bda9c2bf082b9002d0511a7",
    "restoredExactly": true,
    "failEdges": [
      {
        "entityKey": "0xd39ad5ba868ed08493ac5b8bd83639f2c16a2b7e8ab52b7ccc14ef1888958982",
        "kind": "fail",
        "ref": "1874:0x312d31320300c20205ac46a66501ac4738c2ac572ef1abebd21534765aee6021:1"
      }
    ]
  }
}
```

## C5: A repeat request returns "already paid"

Status: **pass**.

### C5 (2026-11-06T00:03:12.276Z)

- What: a repeat request returns "already paid"
- Pass: true
- Expected: HTTP 200 alreadyPaid; relayer nonce and payer balance unchanged
- Evidence: `{"file":"docs/sessions/integration/hosted/paid-2026-11-06T00-00-52-957Z.json","startedAt":"2026-11-06T00:00:52.957Z","site":"https://graphpay-event.vercel.app"}`

```json
{
  "pass": true,
  "status": 200,
  "body": {
    "status": "paid",
    "alreadyPaid": true,
    "orderId": "0x2c3b4236932c802cdd548d8ce3ea877d343a99e2a135b2f10460870778fb6844",
    "chainStatus": "DELIVERED"
  },
  "relayerNonce": {
    "before": 11,
    "after": 11
  },
  "payerUsdt": {
    "before": "15200000",
    "after": "15200000"
  }
}
```

## C6: Hosted endpoints return 401 without the passcode or token

Status: **pass**.

### C6 (2026-11-06T08:05:32.304Z)

- What: hosted endpoints return 401 without the passcode or token (the server-to-server keys, public access)
- Pass: true
- Expected: the shop's pay step and the facilitator's verify and settle: every one the app's 401 without and with a wrong key; relayer nonce unchanged
- Evidence: `{"file":"docs/sessions/integration/hosted/read-2026-11-06T08-05-25-414Z.json","startedAt":"2026-11-06T08:05:25.414Z","site":"https://graphpay-event.vercel.app"}`

```json
{
  "pass": true,
  "table": [
    {
      "route": "POST /api/shop/orders/:id/pay",
      "gate": "passcode",
      "signs": "FACILITATOR (and W_DIRECTORY writes the quote on the 402 step)",
      "without": 401,
      "wrong": 401
    },
    {
      "route": "POST /api/facilitator/verify",
      "gate": "bearer",
      "signs": "FACILITATOR (verify reads only)",
      "without": 401,
      "wrong": 401
    },
    {
      "route": "POST /api/facilitator/settle",
      "gate": "bearer",
      "signs": "FACILITATOR",
      "without": 401,
      "wrong": 401
    }
  ],
  "relayerNonce": {
    "before": 16,
    "after": 16
  }
}
```

## C7: **The qualifying payment in test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`**

Status: **pass**.

### C7 (2026-11-05T23:29:35.237Z)

- What: the qualifying payment in test USDT
- Pass: true
- Expected: PaymentSettled on the USDT checkout; a 4,800,000-unit transfer of the configured test USDT; sent by the relayer (payer gas 0)
- Evidence: `{"tx":"https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00","payer":"acceptance.vitalik.graphpay.eth","by":"T1's usdt-ready (M3 part B)"}`

```json
{
  "status": "success",
  "paymentSettled": true,
  "usdtTransferMicro": "4800000",
  "txFrom": "0x1ab82871c3e1be64717269d45f08ca9d54c1ebf6",
  "payerSentIt": false,
  "gasUsed": "309483",
  "block": 12322239
}
```

## D1: One payment event writes its edge and tallies in one atomic batch

Status: **pass**.

### D1 (2026-11-05T22:54:55.224Z)

- What: one payment event writes its edge and tallies in one atomic batch
- Pass: true
- Expected: `{"ops":"create edge:pay, 4 tally rows (shop all and day, payer all and day), the link, patch checkpoint; one transaction","gas":"recorded, lab 310527"}`
- Evidence: `{"ref":"1874:0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00:4","rabdiTx":"https://rabdi.explorer.arkiv.network/tx/0x8bbd25bd26bbe31f2104c25a214245d44dc2820166bc9c75ade22c668a979f0f","arkivBlock":266431,"whitechainTx":"https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00"}`

```json
{
  "pass": true,
  "failed": [],
  "gasUsed": 642628,
  "gasRatioToLab": 2.069,
  "counts": {
    "ops": 7,
    "edges": 1,
    "tallies": 4,
    "links": 1,
    "checkpoints": 1
  },
  "ops": [
    "create edge:pay",
    "create link:pay",
    "patch tally:all",
    "patch tally:day:20762",
    "patch tally:all",
    "patch tally:day:20762",
    "patch checkpoint"
  ]
}
```

## D2: A retry with the same nonce creates no duplicate

Status: **pass**.

### D2a (2026-11-05T22:56:14.434Z)

- What: the mirror step again over the same blocks sends no transaction
- Pass: true
- Expected: `{"checkpointForgotten":"no send","anchorHiddenToo":"no edge send (standing re-applies listed)"}`
- Evidence: `{"range":{"from":12313887,"to":12322516},"errors":[]}`

```json
{
  "checkpointForgotten": {
    "stats": {
      "written": 0,
      "standing": 0,
      "skippedCheckpoint": 36,
      "skippedRef": 0,
      "none": 0,
      "unknownLogs": 0,
      "retries": 0,
      "lastWriteAt": null
    },
    "wouldSend": [],
    "nonce": {
      "before": 251,
      "after": 251
    }
  },
  "anchorHiddenToo": {
    "stats": {
      "written": 0,
      "standing": 2,
      "skippedCheckpoint": 0,
      "skippedRef": 25,
      "none": 9,
      "unknownLogs": 0,
      "retries": 0,
      "lastWriteAt": 1793919367467
    },
    "wouldSend": [
      {
        "port": "writeStanding",
        "ref": "1874:0x20f8b2dba2b0a310773383c4653c73fa4eb773790e905c63ee89b0c2cb48d493:0"
      },
      {
        "port": "writeStanding",
        "ref": "1874:0x63045e36f2df6ecc4e376df64e0d628cfcc9b07a2d3a722a15e7d51dd829e559:0"
      }
    ],
    "edgeSends": 0,
    "nonce": {
      "before": 251,
      "after": 252
    }
  }
}
```

### D2b (2026-11-05T23:33:21.225Z)

- What: the same batch sent twice at once with the same confirmed nonce: exactly one lands
- Pass: true
- Expected: both first sends at one nonce, exactly one mined; count(edge where ref = id) = 1 for every edge event up to the raced one
- Evidence: `{"event":"1874:0x8f57b92a4354f661010066b129c3a8f988b2139d12cc62ca97b53d6869bbcaaf:0","mined":["https://rabdi.explorer.arkiv.network/tx/0x5770c7de61da77785a77bc5d965129176ab2822c68e1435d7449e18ab8ba525f","https://rabdi.explorer.arkiv.network/tx/0xba04a8d033258ea473eb53f5754dce81aa9f9c61a6e82eca16a6018ec64a65ea"],"firstSends":[{"hash":"0x2c04c516413fd79f7805913df17ae4a5f8e9afd737eda25e5ec9fc208af142b7","nonce":320,"mined":false},{"hash":"0x5770c7de61da77785a77bc5d965129176ab2822c68e1435d7449e18ab8ba525f","nonce":320,"mined":true}]}`

```json
{
  "window": {
    "events": 2,
    "edgeEvents": 2,
    "wrong": []
  },
  "runs": [
    {
      "exit": 0,
      "signal": null,
      "stats": {
        "written": 0,
        "standing": 0,
        "skippedCheckpoint": 3,
        "skippedRef": 0,
        "none": 0,
        "unknownLogs": 0,
        "retries": 1,
        "lastWriteAt": null
      },
      "error": {
        "code": "NONCE_TAKEN",
        "message": "arkiv-graph: nonce 320 is taken (confirmed 321); re-read the state",
        "recovered": true
      },
      "nonce": {
        "before": 320,
        "after": 322
      },
      "raw": [
        {
          "hash": "0x2c04c516413fd79f7805913df17ae4a5f8e9afd737eda25e5ec9fc208af142b7",
          "nonce": 320,
          "at": 1793921580421,
          "error": "replacement transaction underpriced"
        }
      ]
    },
    {
      "exit": 0,
      "signal": null,
      "stats": {
        "written": 2,
        "standing": 0,
        "skippedCheckpoint": 1,
        "skippedRef": 0,
        "none": 0,
        "unknownLogs": 0,
        "retries": 0,
        "lastWriteAt": 1793921589146
      },
      "error": null,
      "nonce": {
        "before": 320,
        "after": 322
      },
      "raw": [
        {
          "hash": "0x5770c7de61da77785a77bc5d965129176ab2822c68e1435d7449e18ab8ba525f",
          "nonce": 320,
          "at": 1793921580367,
          "error": null
        },
        {
          "hash": "0xba04a8d033258ea473eb53f5754dce81aa9f9c61a6e82eca16a6018ec64a65ea",
          "nonce": 321,
          "at": 1793921586685,
          "error": null
        }
      ]
    }
  ]
}
```

### D2c (2026-11-05T23:33:58.469Z)

- What: stopped after sending, before the receipt; the restart finds the mined transaction
- Pass: true
- Expected: the crash run killed after its send, that transaction mined, the restart sends no copy; one edge per event
- Evidence: `{"event":"1874:0xf9830bccdcba70527ffdc656e4452c72277ed6eddc0da5f258de61ef95f0de4c:0","mined":["https://rabdi.explorer.arkiv.network/tx/0x5937fea4d859e8e52e02be8b12fac5e3daf1d6cc31f0906f42f8ecba457b9613"],"firstSends":[{"hash":"0x5937fea4d859e8e52e02be8b12fac5e3daf1d6cc31f0906f42f8ecba457b9613","nonce":322,"mined":true}]}`

```json
{
  "window": {
    "events": 3,
    "edgeEvents": 3,
    "wrong": []
  },
  "runs": [
    {
      "exit": null,
      "signal": "SIGKILL",
      "nonce": 322,
      "raw": [
        {
          "hash": "0x5937fea4d859e8e52e02be8b12fac5e3daf1d6cc31f0906f42f8ecba457b9613",
          "nonce": 322,
          "at": 1793921628966,
          "error": null
        }
      ]
    },
    {
      "exit": 0,
      "signal": null,
      "stats": {
        "written": 0,
        "standing": 0,
        "skippedCheckpoint": 1,
        "skippedRef": 0,
        "none": 0,
        "unknownLogs": 0,
        "retries": 0,
        "lastWriteAt": null
      },
      "error": null,
      "nonce": {
        "before": 323,
        "after": 323
      },
      "raw": []
    }
  ]
}
```

## D3: Tallies recomputed from edges equal the stored tallies

Status: **pass**.

### D3 (2026-11-05T22:53:43.852Z)

- What: tallies recomputed from edges equal the stored tallies
- Pass: true
- Expected: `{"source":"RAW_VERIFIED","recount":"orders, refunds, paid and refunded equal the all-time tally"}`
- Evidence: `{"explainIds":["481d3731dbf6","319ccfa4b1c6"]}`

```json
[
  {
    "ens": "kesar-kingdom.graphpay.eth",
    "kind": "shop",
    "epoch": 0,
    "source": "RAW_VERIFIED",
    "reputation": {
      "orders": "250",
      "refunds": "4",
      "fails": "1",
      "delivered": "245",
      "paidUsdt": "1168.81",
      "refundedUsdt": "15.2",
      "source": "RAW_VERIFIED",
      "synthetic": true
    },
    "stored": {
      "orders": "250",
      "refunds": "4",
      "delivered": "245",
      "onTime": "238",
      "paidMicro": "1168810000",
      "refundedMicro": "15200000",
      "fails": "1",
      "synthetic": true
    },
    "counted": {
      "edges": 751,
      "orders": "250",
      "refunds": "4",
      "delivered": "245",
      "onTime": "238",
      "paidMicro": "1168810000",
      "refundedMicro": "15200000"
    },
    "recountMatches": true,
    "explainId": "481d3731dbf6"
  },
  {
    "ens": "acceptance.vitalik.graphpay.eth",
    "kind": "agent",
    "epoch": 0,
    "source": "RAW_VERIFIED",
    "reputation": {
      "orders": "1",
      "refunds": "0",
      "fails": "0",
      "delivered": "1",
      "paidUsdt": "4.8",
      "refundedUsdt": "0",
      "source": "RAW_VERIFIED",
      "synthetic": false
    },
    "stored": {
      "orders": "1",
      "refunds": "0",
      "delivered": "1",
      "onTime": "1",
      "paidMicro": "4800000",
      "refundedMicro": "0",
      "fails": "0",
      "synthetic": false
    },
    "counted": {
      "edges": 3,
      "orders": "1",
      "refunds": "0",
      "delivered": "1",
      "onTime": "1",
      "paidMicro": "4800000",
      "refundedMicro": "0"
    },
    "recountMatches": true,
    "explainId": "319ccfa4b1c6"
  }
]
```

## D4: GraphQL's top 10 matches the ground truth

Status: **pass**.

### D4 (2026-11-05T22:53:51.138Z)

- What: GraphQL's top 10 matches the ground truth (seeded S city, synthetic)
- Pass: true
- Expected: exact order and amounts against the generator's identity truth; 2 calls
- Evidence: `{"script":"packages/city/scripts/check.mjs (read-only)","file":"docs/sessions/arkiv/city/check-S.json","exit":0}`

```json
{
  "ok": true,
  "calls": 2,
  "explainId": "6d02b9d6f1a0",
  "bytes": 35370
}
```

## D5: The explain trace lists the reads behind each answer

Status: **pass**.

### D5 (2026-11-05T22:53:52.818Z)

- What: the explain trace lists the reads behind each answer
- Pass: true
- Expected: calls 2; every query carries the owner filter; entity keys non-empty; explain returns the trace; the second run has the same explainId
- Evidence: `{"dataset":"S (synthetic)","explainId":"6d02b9d6f1a0"}`

```json
{
  "calls": 2,
  "explainId": "6d02b9d6f1a0",
  "secondRun": "6d02b9d6f1a0",
  "queries": 2,
  "ownerFilterInEvery": true,
  "entityKeys": 26
}
```

## D6: Benchmark at size S

Status: **pass**.

### D6 (2026-11-05T22:53:52.819Z)

- What: benchmark at size S (calls exact; times recorded, not scored)
- Pass: true
- Expected: Graph Arkiv 2; plain ceil(R/100) sequential, +1 parallel
- Evidence: `{"file":"bench/BENCHMARK-LIVE.md","run":"2026-11-05T22:08:32.320Z","by":"T3, M9 (PR 31)"}`

```json
[
  "| Graph Arkiv Q2 reads | 2 | 2 | pass |",
  "| plain Q2, one page at a time: ceil(R / 100), R = 490 | 5 | 5 | pass |",
  "| plain Q2 in parallel: that + 1 (the count()) | 6 | 6, 6, 6, 6 | pass |",
  "| Graph Arkiv correct (by identity) | every run | yes | pass |",
  "| plain correct (by name) | every run | yes | pass |"
]
```

## D8: The geo query returns only shops inside the box, and only from our writers

Status: **pass**.

### D8 (2026-11-05T22:53:52.820Z)

- What: the geo query returns only shops inside the box, and only from our writers
- Pass: true
- Expected: the cast shops only; synthetic ones only when opted in
- Evidence: `{"script":"packages/city/scripts/check.mjs (read-only)","exit":0}`

```json
{
  "ok": true,
  "real": 3,
  "withSynthetic": 11,
  "calls": 1
}
```

## D9: A receipt cannot be edited

Status: **pass**.

### D9 (2026-11-05T22:53:54.873Z)

- What: a receipt cannot be edited
- Pass: true
- Expected: every W_LEDGER edge is created readonly; a patch of one reverts
- Evidence: `{"readonlyFlags":"read live now","patchReverts":"docs/technical/FACTS.md \"Readonly edge\" (M7a live probe, 01:29 IST: a simulated patch of a probe edge reverts, a tally patch passes)"}`

```json
{
  "edgesRead": 5,
  "allReadonly": true,
  "sample": [
    {
      "key": "0x008fd1bc6c03e2c2f7aba896f2db4226b54c729805232a30a8d83ef102822374",
      "readonly": true
    },
    {
      "key": "0x0092336adcc5b9fd6cc64370d13d53725d8b186cd507e5665ccec9b627046b5d",
      "readonly": true
    }
  ]
}
```

## D10: An expired or missing quote is refused and the agent re-quotes

Status: **pass**.

### D10 (2026-11-06T04:21:08.387Z)

- What: an expired or missing quote is refused and the agent re-quotes
- Pass: true
- Expected: (a) QUOTE_MISSING, one re-quote that passes; (b) QUOTE_EXPIRED, one re-quote with a new entity key that passes; no signature before the passing check; (c) owner W_DIRECTORY, expiry 15 min after creation (±2 blocks), valid_until 10 min after
- Evidence: `{"how":"(a), (b) in process on the mock world (packages/agents/mocks): createPayer → presignCheck with fake 402s, quote entities and signer; no network, no model, no real signature; the one mock signature follows the passing re-quote","tests":"packages/agents/test/errand.test.mjs (D10 a, D10 b)"}`

```json
{
  "a": {
    "refused": true,
    "requotes": 1,
    "status": "paid",
    "signed": 1,
    "quoteKeys": 1,
    "guards": [
      "QUOTE_MISSING: re-quoting once (new quote, new 402)"
    ]
  },
  "b": {
    "refused": true,
    "requotes": 1,
    "status": "paid",
    "signed": 1,
    "quoteKeys": 2,
    "guards": [
      "QUOTE_EXPIRED: re-quoting once (new quote, new 402)"
    ]
  },
  "c": {
    "quoteKey": "0x1fced134518db48adb16d628520187f3fe1beb6d43317aa56bd23034d3658dc4",
    "owner": "0x146002b43A9Fb8EB963699e77Ed18579dC30A6e4",
    "lifeBlocks": 450,
    "wantBlocks": 450,
    "blockSeconds": 2,
    "validAfterSeconds": 596,
    "file": "docs/sessions/integration/hosted/quote-2026-11-06T04-17-21-900Z.json"
  }
}
```

## D15: The mirror resumes after a sleep or a network drop (ADR-0056)

Status: **pass**.

### D15 (2026-11-05T23:35:03.129Z)

- What: the mirror resumes after a sleep or a network drop (ADR-0056)
- Pass: true
- Expected: count(edge where ref = id) = 1 for every edge event, 0 for the rest
- Evidence: `{"from":12313887,"to":12325311,"procedure":"workers SIGSTOP 23:30:53–23:34:05 UTC (3 min 12 s); during it rehearsal.vitalik paid 0.40 and the shop delivered (tx 0x8f57b92a…bcaaf, 3 edge events, mirrored by the D2b and D2c replays); SIGCONT: caught up to the head, the 3 events skipped by the checkpoint, 0 retries; then SIGKILL 23:34:24 and a restart (lease taken at once, running 23:34:41); every event since the deploy checked once each","workersLogs":"workers-3.log, workers.log (local)"}`

```json
{
  "pass": true,
  "events": 47,
  "edgeEvents": 35,
  "wrong": []
}
```

## E1: Vitalik's request

Status: **pass**.

### E1 (2026-11-05T23:15:02.717Z)

- What: Vitalik's request
- Pass: true
- Expected: the exact request; budget 6.000000, deadline 20:00 local; scout and analyst both start before either ends
- Evidence: `{"runFile":"docs/sessions/integration/runs/run-a8d00695846884f3/run.json"}`

```json
{
  "request": "Just landed in Mumbai. Get me the best gulab jamun near me under 6 USDT by 8 pm.",
  "mandate": {
    "budgetUsdt": "6.000000",
    "deadlineIso": "2026-11-06T20:00:00+05:30",
    "hash": "0x0c5a80df0c98786229a9427ac38c4d4a5286d6b848d8329687d2af4b8751195d"
  },
  "scoutStart": 6,
  "analystStart": 12,
  "firstEnd": 19
}
```

## E2: The agents choose Kesar Kingdom, never the trap

Status: **pass**.

### E2 (2026-11-05T23:15:02.718Z)

- What: the agents choose the good shop, never the trap
- Pass: true
- Expected: explainId; good > runner-up, trap excluded; no trap order or payment; trap balance unchanged
- Evidence: `{"runFile":"docs/sessions/integration/runs/run-a8d00695846884f3/run.json","startedAt":"2026-11-05T23:11:01.937Z","assertion":"A"}`

```json
{
  "explainId": "f3d1bb972a81",
  "chosen": "kesar-kingdom.graphpay.eth",
  "scores": [
    {
      "ens": "kesar-kingdom.graphpay.eth",
      "score": 0.9152605195518567,
      "eligible": true
    },
    {
      "ens": "syrup-street.graphpay.eth",
      "score": 0.8632476215644365,
      "eligible": true
    },
    {
      "ens": "jamun-junction.graphpay.eth",
      "score": 0.7508551857689739,
      "eligible": false
    }
  ],
  "trapEvents": 0
}
```

## E3: The payment is made in USDT on Whitechain

Status: **pass**.

### E3 (2026-11-05T23:29:42.411Z)

- What: the payment is made in USDT on Whitechain
- Pass: true
- Expected: PaymentSettled on the USDT checkout; a 4,800,000-unit transfer of the configured test USDT; sent by the relayer (payer gas 0)
- Evidence: `{"tx":"https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00","payer":"acceptance.vitalik.graphpay.eth","by":"T1's usdt-ready (M3 part B)"}`

```json
{
  "status": "success",
  "paymentSettled": true,
  "usdtTransferMicro": "4800000",
  "txFrom": "0x1ab82871c3e1be64717269d45f08ca9d54c1ebf6",
  "payerSentIt": false,
  "gasUsed": "309483",
  "block": 12322239
}
```

## E4: The mirror writes it to Arkiv

Status: **pass**.

### E4 (2026-11-05T23:15:02.719Z)

- What: the mirror writes it to Arkiv
- Pass: true
- Expected: cursor past the settle block; trail order → pay → deliver; refs 1874:<tx>:<logIndex>
- Evidence: `{"runFile":"docs/sessions/integration/runs/run-a8d00695846884f3/run.json","startedAt":"2026-11-05T23:11:01.937Z","assertion":"C"}`

```json
{
  "cursorBlock": 12324028,
  "settleBlock": 12323999,
  "trail": [
    "order 1874:0xe92d009a862f7fef9cd752c69bd0ea172b003fc33c3e877dd02b6f9ffe44e791:2",
    "pay 1874:0xe92d009a862f7fef9cd752c69bd0ea172b003fc33c3e877dd02b6f9ffe44e791:6",
    "deliver 1874:0x8f3066b30436028438b7ab8f2d362818fa054c5b9a608ac44deffab016329dc6:0"
  ]
}
```

## E5: GraphQL shows the new edge and the updated tallies

Status: **pass**.

### E5 (2026-11-05T23:15:02.719Z)

- What: GraphQL shows the new edge and the updated tallies
- Pass: true
- Expected: TODAY +1 order, +4.80, +1 delivered, +1 on time; all-time +1; payer TODAY +4.80
- Evidence: `{"runFile":"docs/sessions/integration/runs/run-a8d00695846884f3/run.json","startedAt":"2026-11-05T23:11:01.937Z","assertion":"D"}`

```json
{
  "goodToday": {
    "orders": "10",
    "refunds": "1",
    "delivered": "5",
    "onTime": "5",
    "paidMicro": "16810000",
    "refundedMicro": "800000"
  },
  "goodAllOrders": "251",
  "payerToday": {
    "orders": "1",
    "refunds": "0",
    "delivered": "0",
    "onTime": "0",
    "paidMicro": "4800000",
    "refundedMicro": "0"
  },
  "explainIds": [
    "7abbde9ee4ad",
    "7abbde9ee4ad"
  ]
}
```

## E6: A refund updates the tallies

Status: **pass**.

### E6 (2026-11-05T23:15:02.719Z)

- What: a refund updates the tallies
- Pass: true
- Expected: refunds +1, refunded +0.80, trail ends in refund
- Evidence: `{"runFile":"docs/sessions/integration/runs/run-a8d00695846884f3/run.json","startedAt":"2026-11-05T23:11:01.937Z","assertion":"E"}`

```json
{
  "goodToday": {
    "orders": "10",
    "refunds": "2",
    "delivered": "5",
    "onTime": "5",
    "paidMicro": "16810000",
    "refundedMicro": "1600000"
  },
  "trailEnd": "refund"
}
```

## E7: A killed agent is refused

Status: **pass**.

### E7 (2026-11-05T23:28:01.873Z)

- What: a killed agent is refused
- Pass: true
- Expected: HTTP 402 ENS_EXPIRED_OR_REVOKED within 25 s of the kill's receipt; the recorder's fail edge on Arkiv; folded into fails by the mirror
- Evidence: `{"file":"docs/sessions/integration/runs/kill-disposable-1/kill.json","kill":"kill disposable-1.vitalik.graphpay.eth: done (block 12072701, tx 0x785a13f119ab77f67c1ed8dfa6f1213708fde4f43158122a357e72c018acf29f)","alive":"0x763973499f7f7eb7bdda058fa03ee3d9f9480be53d75bc4574c62d7beec84b9c","failEdge":"0xc2d2ed3801c81500b108d904c3048c4c9c984f10d2f88c5218073e0b581e2699"}`

```json
{
  "assertion": {
    "status": 402,
    "reason": "ENS_EXPIRED_OR_REVOKED",
    "secondsToBite": 9.3,
    "failEdge": "0xc2d2ed3801c81500b108d904c3048c4c9c984f10d2f88c5218073e0b581e2699"
  },
  "failed": [],
  "foldedFails": "1"
}
```

## E8: Every counting errand records its time and cost (ADR-0048)

Status: **pass**.

### E8 (2026-11-05T23:15:02.720Z)

- What: every counting errand records its time and cost
- Pass: true
- Expected: a row in OPEN.md's preset calibration table with the preset, seconds and apiCostUsd
- Evidence: `{"file":"docs/thinking-partner/OPEN.md"}`

```json
{
  "row": "| 04:43 | Join e2e:food real, payer (the counting run) | testing | `claude-opus-5-5`, xhigh | 122.1 | $0.2986 | **paid** 4.80 on Whitechain, delivered, refunded 0.80; A–E pass |",
  "cost": {
    "apiCostUsd": 0.2986,
    "seconds": 122.1,
    "tokens": 52693
  }
}
```

## F1: No secrets are in the repo

Status: **pass**.

### F1 (2026-11-06T00:11:30.285Z)

- What: no secrets are in the repo
- Pass: true
- Expected: no secret shapes in the tree or the history of every branch; only .env.example tracked; every key and token on Vercel Hidden or Secret
- Evidence: `{"cmds":["node scripts/check.mjs","git log -p --all (scanned in process, labels only)","git ls-files","vercel env ls production (names and types)"]}`

```json
{
  "tree": "check: clean (738 files)",
  "history": {
    "commits": 313,
    "findings": {},
    "commitsWithFindings": []
  },
  "trackedEnvFiles": [],
  "vercelProduction": {
    "vars": 15,
    "secretShaped": 14,
    "notHidden": []
  }
}
```

## F2: Spending endpoints are passcode-gated

Status: **pass**.

### F2 (2026-11-06T08:05:32.305Z)

- What: spending endpoints: visitors open (ADR-0069), the keys between our servers enforced
- Pass: true
- Expected: public access on (config site.publicAccess, ADR-0069): the run route takes a visitor without a passcode (an empty request is a 400, nothing starts); every server-to-server route (shop pay and re-order, facilitator, recorder, cron) the app's 401 without and with a wrong key; relayer and merchant nonces unchanged
- Evidence: `{"file":"docs/sessions/integration/hosted/read-2026-11-06T08-05-25-414Z.json","startedAt":"2026-11-06T08:05:25.414Z","site":"https://graphpay-event.vercel.app"}`

```json
{
  "pass": true,
  "mode": "public access (ADR-0069): visitor routes open; server-to-server keys stay",
  "table": [
    {
      "route": "POST /api/shop/orders/:id/pay",
      "gate": "passcode",
      "signs": "FACILITATOR (and W_DIRECTORY writes the quote on the 402 step)",
      "without": 401,
      "wrong": 401
    },
    {
      "route": "POST /api/shop/orders/:id/reorder",
      "gate": "passcode",
      "signs": "FACILITATOR",
      "without": 401,
      "wrong": 401
    },
    {
      "route": "POST /api/facilitator/verify",
      "gate": "bearer",
      "signs": "FACILITATOR (verify reads only)",
      "without": 401,
      "wrong": 401
    },
    {
      "route": "POST /api/facilitator/settle",
      "gate": "bearer",
      "signs": "FACILITATOR",
      "without": 401,
      "wrong": 401
    },
    {
      "route": "POST /api/recorder/attempts",
      "gate": "bearer",
      "signs": "W_SYNC",
      "without": 401,
      "wrong": 401
    },
    {
      "route": "GET /api/cron/renew",
      "gate": "bearer",
      "signs": "RENEWER",
      "without": 401,
      "wrong": 401
    }
  ],
  "visitor": {
    "publicAccess": true,
    "runWithoutPasscode": 400,
    "runBody": {
      "error": "request must be 1 to 400 characters"
    }
  },
  "relayerNonce": {
    "before": 16,
    "after": 16
  },
  "merchantNonce": {
    "role": "SHOP_KESAR",
    "before": 17,
    "after": 17
  }
}
```

## F3: The relayer's safety floor is enforced

Status: **pass**.

### F3 (2026-11-06T04:19:22.383Z)

- What: the relayer's safety floor is enforced
- Pass: true
- Expected: the payment refused before sending, naming the floor; no transaction (relayer nonce unchanged); health shows the floor and the balance
- Evidence: `{"file":"docs/sessions/payments/f3.json","by":"T1, a local production build with the hosted env (not a preview; the record says why)","at":"2026-11-06T04:16:55.317Z"}`

```json
{
  "reason": "relayer_floor",
  "transaction": "",
  "relayerNonce": {
    "before": 13,
    "after": 13
  },
  "floorWbt": "1001",
  "balanceWei": "794659557124942758",
  "checks": [
    "ok the local production build answers /api/facilitator/health",
    "ok health shows the raised floor",
    "ok health shows the balance below it",
    "ok the local shop answers 402 (no facilitator call yet)",
    "ok settle is refused before sending, naming the floor",
    "ok no transaction: the relayer nonce is unchanged"
  ]
}
```

