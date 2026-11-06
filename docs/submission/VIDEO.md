# The demo video: shot list

For the founder, who records it. **Your own voice, no text-to-speech or AI voiceover** (ETHGlobal's rule), 2 to 4 minutes, a screen recording of the live site (ADR-0053). Whitechain asks that the video show each party: the customer and his agents, the shop and its agents, the facilitator we run, and the chain. The narration lines are prompts to say in your own words, not a script to read.

## Before you record

- The payer agent is **active** and Filter & Fold is **open**: https://graphpay-event.vercel.app/api/state/customer and the [map](https://graphpay-event.vercel.app/map).
- A laptop window at least 1200 wide, on https://graphpay-event.vercel.app.
- An errand took 91 to 171 s on the production site before [#182](https://github.com/Zugzwang-world/graphpay/pull/182) (the calibration table, `docs/thinking-partner/OPEN.md`); with the routine steps in code, three errands in a row on the production site took 43 to 54 s (Sat 7 Nov 01:16 to 01:19 IST, [#206](https://github.com/Zugzwang-world/graphpay/pull/206)). Talk over it while the deck follows each step. If the video runs long, cut the wait; never speed it up.
- Do not tap on the phones: Revoke, Change cap or "Let the agent try to raise its own cap" (not wired), Pause on Concierge or Analyst (use the Payer card), Subscribe and Cancel ([`docs/sessions/booth/demo-note.md`](../sessions/booth/demo-note.md)). Subscribe, Cancel and the kill work from the [`/customer`](https://graphpay-event.vercel.app/customer) page instead (#173, #175); a kill spends a spare agent, so use it once, as its own shot, if at all. W7 updates this list as the night streams land.

## Shots

| time | on screen | say, in your words | proves |
|---|---|---|---|
| 0:00–0:15 | The stage: Vitalik's phone, the deck, Filter & Fold's phone | "Your next customer is an agent. Ask before you pay." Agents that can pay, can be trusted and can be stopped. | the pitch |
| 0:15–1:15 | Send the request: "Get me the best masala dosa near BKC under 6 USDT, delivered within an hour." The team fans out; the analyst's one GraphQL call with its exact Arkiv reads; Tawa Tangle refused in red, with its refund and on-time rates; Filter & Fold chosen | Every agent has an ENS name. Before paying, they ask a money graph on Arkiv about each shop, and they see every read behind the answer. The trap shop is refused by code, not by a prompt. | agents, guards in code, Graph Arkiv |
| 1:15–1:50 | The 402 quote, one signature, the settlement; the Whitechain explorer page opens | The shop asks for payment with HTTP 402. The payer signs once and pays no gas: our own facilitator checks its ENS name, settles in test USDT on Whitechain, and pays the gas. The payee came from the shop's ENS name just now. | x402 on Whitechain, our facilitator |
| 1:50–2:10 | Filter & Fold's phone rings: the buyer agent's ENS name and its reputation; Mark dispatched | The shop sees who is buying, by name, and its record. | ENS identity, the merchant view |
| 2:10–2:30 | The deck's record step: the payment on Arkiv as a receipt and tallies, with its explorer link | The payment is now memory: a receipt that cannot be edited, and running tallies, written in one batch. The next agent that asks will see it. | Arkiv as the memory |
| 2:30–2:55 | Request refund on Vitalik's phone (the coffee arrived cold, with a photo); Refund 0.80 on the shop's phone; its Whitechain link | Past the first payment: a partial refund, on chain. Renewals and the accountant's export work the same way. | refunds, the business flow |
| 2:55–3:20 | Vitalik's Payer card: Pause; the Sepolia transaction; resume (or leave it: the site resumes a paused agent after 2 minutes) | The human stays in charge: one ENS record stops the agent, and the gate refuses it before anything is signed. | the ENS kill switch |
| 3:20–3:45 | [Race mode](https://graphpay-event.vercel.app/race) at size S, the synthetic city: the reads each side needs, ticking | Plain Arkiv has to read every payment to rank the city; Graph Arkiv reads its tallies: 2 reads against 5 here. Say that the city is synthetic and small, and that the gap grows with every payment. | the benchmark, in reads |
| 3:45–4:00 | The README's "Verify each claim" table, or the drop-in store's 12 lines | Every claim links to a public explorer. Any shop can add this checkout in 12 lines. | the evidence, the drop-in |

The facilitator's [health page](https://graphpay-event.vercel.app/api/facilitator/health) (relayer, balance, floor, daily gas budget) can open for a second in the payment shot if there is time: it is the "facilitator we run" party.

## After recording

- Upload it publicly (YouTube unlisted works for ETHGlobal) and paste the link into the form's video field ([`ETHGLOBAL.md`](ETHGLOBAL.md)).
- Tell W7 or the Coordinator the Swarm moment's timestamp, if there is one, for [`arkiv/swarm.md`](../../arkiv/swarm.md) item 6.
