# Relay: w7-submission (the night Submission stream)

Updated 23:25 IST, Fri 6 Nov, by W7 Submission (`local_abd77623-de22-4fe2-a0a9-865fdd43dba2`). Brief: [`briefs/2258-w7-submission.md`](../briefs/2258-w7-submission.md).

## Plain language

W7 writes what a judge reads, so the founder can paste the ETHGlobal submission from one file and every claim in it links to evidence.

**Landed in this step:** the README. It now says what GraphPay is, gives the live link, and has a "verify each claim" table: every payment, refund, renewal, ENS action and Arkiv receipt it mentions opens on a public explorer. Each of those 24 transactions was checked on its explorer at about 23:10 IST. It also has the fictional-persona sentence from the brief, the SDKs, the Whitechain, ENS and Arkiv sections the prize rules ask for, a runnable Arkiv query with no keys, the limitations, and the team. A root MIT `LICENSE` is added (the packages were MIT already; the repo root had none).

**Next, in order:** AI_USAGE.md; the Arkiv files (`friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`, `swarm.md`); `WHITECHAIN_FEEDBACK.md` and `docs/submission/ENS.md`; then `docs/submission/ETHGLOBAL.md`, the form text. Then a pass after each night stream lands (W1's new shop names, W2's menus and the race at M, W6's 1.0.0 SDKs).

**The founder must:** review the README; record the video (2 to 4 minutes, own voice) and paste its link into the form; submit by 08:00 IST from `docs/submission/ETHGLOBAL.md`; confirm the team list and that every member is registered.

## Technical

- **Branch and PRs:** `submit/readme` (this step). Small PRs, one per item, auto-merge.
- **How links were checked:** a read-only script queried the Whitechain explorer's API (status, method, token transfers), and public Sepolia and Rabdi RPCs (receipt status, chain id first). All 24 succeeded. Highlights:
  - the first real test-USDT payment, 4.80, 04:13 IST, sent by our relayer: [0x8750…2c00](https://explorer.testnet.whitechain.io/tx/0x87505ef2457b6e925fa7378a55fd91419e83c37fb8effc06d901884700c72c00);
  - the latest live errand, 4.80, 20:36 IST: [0xbc05…cd43](https://explorer.testnet.whitechain.io/tx/0xbc052d7f11bd61ab0fcee69a78da0b7fbe5bcbf9821741d1150345a0fe29cd43);
  - refund 0.80, re-order 1.20, the cron renewal, a subscription created, renewed and cancelled (by script), a revoked agent's on-chain `PaymentFailed`;
  - on Sepolia: the agent's own `agent-context` write (B3), the disposable agent's kill, the payer's cap record.
- **Arkiv receipts link to their payment:** a keyless `arkiv_query` for the payer's `pay` edges (owner W_LEDGER) returns rows whose `ref` is `1874:<Whitechain tx>:<log>`; for example entity `0xc64b…7204` points at the errand `0x8617…863a`. The README carries the query as a curl command and as an explorer "run this query" link.
- **ENS read with stock viem** on Sepolia's public RPC: the shop's coin-type 2147485522 address is the payee of every payment; the payer's `graphpay.status` and `graphpay.cap_micro`; `graphpay.eth`'s `agent-endpoint[mcp]`; a wildcard `sim-0042` name answers "synthetic agent, unverified".
- **The drop-in:** the store's integration is 12 lines in four files, counted by the store's own rule (`apps/store/lib/integration.ts`); the old "about 20" stays the limit its test holds.
- **Deviations:**
  - The tallies of the good shop include labelled synthetic history (`history-buyer-N.sim…`, `synthetic: true`). The README says so rather than quoting the shop's order count.
  - The payer's daily cap is not quoted as a number: it reads 300 test USDT in ENS since about 23:10 IST (W5's #152), after the 100 of ADR-0071. The README links the live state instead.
  - The store is not deployed (graphpay-store.vercel.app answers 404), so the README says how to run it locally.
  - The brief's `why.md` is written as `arkiv/why-arkiv.md`, the name the pack, the master plan and the M17 plan use.
- **Open risks:** the ENS labels change with W1, the race numbers with W2 at M, the SDK versions with W6; each is a find-and-replace in the README and the form text, done after it lands.
