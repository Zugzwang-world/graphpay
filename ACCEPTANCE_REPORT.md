# Acceptance report

Written by `pnpm acceptance` at 2026-11-05T23:28:01.884Z. Checks and pass criteria: `planning/ACCEPTANCE_TESTS.md` and `docs/plan/ACCEPTANCE_ADDITIONS.md`. Only D7 may be `blocked` (C7 and E3 no longer wait on supply, ADR-0054); a check without a result is `not run`, never `pass`.

**26 pass, 0 fail, 1 blocked, 21 not run** (of 48).

| id | check | status | note |
|---|---|---|---|
| A1 | CI is green (at M0 the `contracts` job runs a placeholder Foundry project) | pass |  |
| A2 | The secret scan is clean | pass |  |
| A3 | Deny rules block reads of `.env` | not run | no runner yet |
| A4 | Auto-merge works | not run | no runner yet |
| A5 | The event wallets are fresh, except FUNDER and OPERATOR | not run | no runner yet |
| A6 | `planning/` and the thinking-partner folder are in place | pass |  |
| A7 | No known address literal in code outside the config file (D6) | pass |  |
| A8 | No story name or value in code outside the story file (ADR-0047) | pass |  |
| A9 | The agent presets are accepted (ADR-0048) | not run | no runner yet |
| A10 | The Whitechain RPC rules hold (ADR-0031) | not run | no runner yet |
| B1 | The `graphpay.eth` namespace resolves; all owners and agents exist | pass |  |
| B2 | The gate passes active agents | pass |  |
| B3 | A scoped role stops an agent raising its own cap | not run | no runner yet |
| B4 | The payment preference parses | pass |  |
| B5 | A synthetic wildcard name resolves | pass |  |
| B6 | Killing a disposable agent makes the gate deny it | pass |  |
| B7 | The epoch changes on re-registration (fork test) | not run | no runner yet |
| B8 | ENSIP-26 records exist and the MCP endpoint answers | pass |  |
| B9 | The payee is the shop's ENS address | not run |  |
| C1 | Contracts are verified on the explorer | pass |  |
| C2 | A payment through the facilitator costs the payer no gas | not run | no runner yet |
| C3 | Partial refund, re-order and renewal work | not run | no runner yet |
| C4 | Revoked-agent and over-cap failures are recorded | not run | no runner yet |
| C5 | A repeat request returns "already paid" | not run | no runner yet |
| C6 | Hosted endpoints return 401 without the passcode or token | not run | no runner yet |
| C7 | **The qualifying payment in test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`** | not run | no runner yet |
| D1 | One payment event writes its edge and tallies in one atomic batch | pass |  |
| D2 | A retry with the same nonce creates no duplicate | not run | 2 of 3 parts not run |
| D3 | Tallies recomputed from edges equal the stored tallies | pass |  |
| D4 | GraphQL's top 10 matches the ground truth | pass |  |
| D5 | The explain trace lists the reads behind each answer | pass |  |
| D6 | Benchmark at size S | pass |  |
| D7 | Benchmark at size M, if seeded | blocked | waiting for the locked story (the M city is seeded only after the founder locks it) |
| D8 | The geo query returns only shops inside the box, and only from our writers | pass |  |
| D9 | A receipt cannot be edited | pass |  |
| D10 | An expired or missing quote is refused and the agent re-quotes | not run | no runner yet |
| D15 | The mirror resumes after a sleep or a network drop (ADR-0056) | not run | the drop and restart (03:27–03:30 IST) came before the first payment; every event since the deploy is mirrored exactly once (36 events, 25 edges), but no payment fell inside a drop yet |
| E1 | Vitalik's request | pass |  |
| E2 | The agents choose Kesar Kingdom, never the trap | pass |  |
| E3 | The payment is made in USDT on Whitechain | not run | no runner yet |
| E4 | The mirror writes it to Arkiv | pass |  |
| E5 | GraphQL shows the new edge and the updated tallies | pass |  |
| E6 | A refund updates the tallies | pass |  |
| E7 | A killed agent is refused | pass |  |
| E8 | Every counting errand records its time and cost (ADR-0048) | pass |  |
| F1 | No secrets are in the repo | not run | no runner yet |
| F2 | Spending endpoints are passcode-gated | not run | no runner yet |
| F3 | The relayer's safety floor is enforced | not run | no runner yet |

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

### B9 (2026-11-05T22:52:44.693Z)

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

Status: **not run** (2 of 3 parts not run).

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

## D15: The mirror resumes after a sleep or a network drop (ADR-0056)

Status: **not run** (the drop and restart (03:27–03:30 IST) came before the first payment; every event since the deploy is mirrored exactly once (36 events, 25 edges), but no payment fell inside a drop yet).

### D15 (2026-11-05T22:55:11.794Z)

- What: the mirror resumes after a sleep or a network drop (ADR-0056)
- Pass: null
- Expected: count(edge where ref = id) = 1 for every edge event, 0 for the rest
- Evidence: `{"from":12313887,"to":12322924}`

```json
{
  "pass": true,
  "events": 36,
  "edgeEvents": 25,
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

