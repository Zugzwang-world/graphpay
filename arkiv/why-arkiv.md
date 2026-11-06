# Why Arkiv, and not our own Postgres

GraphPay's agents ask a money graph before they pay: has this shop delivered, refunded, kept its promises? That record is only worth asking if the platform that serves it cannot quietly own it, edit it or switch it off. So the graph lives on Arkiv (Rabdi, chain 7794095), and GraphPay keeps no database of its own: state lives on the Whitechain contract and on Arkiv, and the website only runs code (ADR-0003). Every claim below links to the repo or to a live row.

## 1. A reputation no platform owns

- **The rows are public.** Every receipt, tally and shop listing is an Arkiv entity anyone can read with one JSON-RPC call and no account: the README's [keyless query](../README.md#query-arkiv-yourself-one-command-no-keys) prints the stage payer's receipts straight from the public endpoint.
- **Anyone can serve it.** Our GraphQL and MCP routes are thin and stateless over Arkiv (ADR-0060); they hold no data. Another team could run the same reads, or their own, against the same rows, with the open-source package [`@graphpay_ethglobal/arkiv-graph`](https://www.npmjs.com/package/@graphpay_ethglobal/arkiv-graph).
- **With Postgres** the reputation would be ours: our schema, our credentials, our uptime, and our word that nobody edited it.

## 2. Authorship anyone can check

- **Every row carries its writer.** Arkiv records the wallet that created each entity (`$owner`). Our reads filter `project`, `type` and `$owner = <trusted writer>` and check every returned row again; a blank or malformed writer stops the server at start-up ([`schema.md`](schema.md), "Owner rule"). Anyone can write rows that look like ours, and they never count.
- **One wallet per job:** the ledger (receipts and tallies), the recorder (off-chain refusals), the directory (shops, quotes, heartbeats, menus), and one wallet per synthetic city; all listed in the [README](../README.md#arkiv-the-money-graph).
- **The money can be re-derived.** Each receipt names the Whitechain event it mirrors: the `pay` edge [0xc64b…7204](https://rabdi.explorer.arkiv.network/entity/0xc64b6db9a92d0e17a84f2fd852c653355be86d12bb128ac5df8981d5715d7204) carries `ref = 1874:0x8617…863a:3`, the [payment on Whitechain](https://explorer.testnet.whitechain.io/tx/0x8617754857a8eb1fb1483b4f18fb6fa6a4f1607241d3f08c7ccd062de1b8863a). Acceptance D3 recomputes the tallies from the edges and finds them equal ([`ACCEPTANCE_REPORT.md`](../ACCEPTANCE_REPORT.md)).
- **With Postgres** a reader would have to trust that the platform's rows match the chain.

## 3. Receipts that cannot be edited

Every edge, payments included, is created readonly (ADR-0034): a simulated patch of a receipt's `amount_micro` reverts while a tally patch passes (acceptance D9). The owner could still delete or extend a readonly row (the SDK's own types say so), so we say "cannot be edited", not "cannot be removed". Receipts also lapse after 30 days, like every ledger row; the payment stays on Whitechain, and the receipt can be rebuilt from it.

## 4. Expiry as policy

Arkiv rows expire on their own, and GraphPay uses that as product logic, with no clean-up job:

| row | lifetime | what it means for a person |
|---|---|---|
| `shop_open` | 15 minutes, renewed while the shop's Open switch is on | a shop is "open now" only while someone keeps it open; a crashed server cannot leave it open |
| `agent_presence` | 15 minutes, renewed while an errand runs | the map shows an agent at work only while it works |
| `quote` | 15 minutes (valid for 10) | the payer refuses a missing or expired quote and asks again (acceptance D10) |
| every ledger row, receipts included; synthetic rows | 30 days; 14 days | the graph forgets old data by itself; a lapsed receipt can be rebuilt from its Whitechain transaction, named in its `ref` |

With Postgres each of these is a cron job that can fail silently (ADR-0035).

## 5. Reads for any agent

The question an agent asks is the same for every agent, so the answer is public: the [GraphQL endpoint](https://graphpay-event.vercel.app/api/graphql?query=%7Bnode%28ens%3A%22kesar-kingdom.graphpay.eth%22%29%7Bcategory%20tally%7Borders%20refunds%7D%7D%7D) returns the exact Arkiv queries behind each answer, and the MCP server is published in ENS (`graphpay.eth` → `agent-endpoint[mcp]`), so an agent can find it from the name alone. Decentralized, secure and verifiable: the rows are public, every reader can check the writer, and every answer shows its reads.

## What it costs, honestly

- **No SUM, GROUP BY or join.** We write running tallies with every event, in the same atomic batch, so a ranking is one sorted read ([`friction.md`](friction.md) #1). On the synthetic city at size S, the city-wide top 10 takes 2 reads against 5 for plain code; on other questions Graph Arkiv ties or needs more ([`bench/BENCHMARK-LIVE.md`](../bench/BENCHMARK-LIVE.md)).
- **Gas per event:** a steady payment event (1 create, 6 patches) cost 377,893 gas on Rabdi; a first event between two actors 1,301,681 ([`friction.md`](friction.md), "What worked").
- **Quotas:** our access key ran out of quota on Fri 6 Nov; reads now fall back to the keyless endpoint ([`friction.md`](friction.md) #8).
- **A mirror, not a transaction:** the receipt reaches Arkiv after the Whitechain event, written by the mirror from its checkpoint (ADR-0056); settlement never waits for the mirror. If the mirror stops, the receipts arrive when it resumes (acceptance D15).

## What stays off Arkiv

- **Personal data:** none is collected. The cast is synthetic and Mr. Vitalik is a fictional persona (ADR-0072).
- **Prompts and model output:** the agents' prompts and reasoning stay in the server's run logs; only payments, refunds, refusals, listings and presence reach Arkiv.
- **The ENS cache:** names are read from Sepolia at pay time, never copied to Arkiv as truth; a graph node records the name and its epoch, so a re-registered name starts a new history.
- **Secrets:** no key or token is ever written to a row; the menus on Swarm are public files with a content hash on Arkiv ([`swarm.md`](swarm.md)).
