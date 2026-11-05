# Story inputs (the pack's test story)

What tonight's test story holds, for writing the final story. The live file is `packages/config/story.json` (ADR-0047). Every number is a synthetic story input.

| input | test value | source in the pack |
|---|---|---|
| persona | Vitalik (`vitalik.graphpay.eth`), owner and human payer | `planning/SPEC/AGENTS.md` §1 |
| buyer agents | concierge, scout (1.00 a day), analyst, payer (6.00 a day); working agents rehearsal (30.00), acceptance (6.00); disposable agents (1.00) | `planning/SPEC/AGENTS.md` §1; `planning/DECISIONS.md` E-11 |
| shops | Kesar Kingdom (the good one: 4.80 for 12, 1.2% refunds, 97% on time, 4,812 orders), Jamun Junction (the trap: 3.30, 18.4%, 71%, 2,190), Syrup Street (runner-up: 4.20, 3.1%, 93%, 1,204); each with storefront, risk and dispatch agents | `planning/SPEC/AGENTS.md` §1; `planning/FACTS.md` §7 |
| request text | "Just landed in Mumbai. Get me the best gulab jamun near me under 6 USDT by 8 pm." | `planning/SPEC/AGENTS.md` (top); `planning/WEBSITE_SPEC.md` §3 |
| order | 12 gulab jamun, 4.80 at the good shop, budget 6, by 20:00 IST; refund 0.80 for two squashed jamuns | `planning/SPEC/AGENTS.md` §1 |
| re-order | 3 more for 1.20 from the same shop | `planning/WEBSITE_SPEC.md` §3 |
| renewal | the Sunday sweets box, 0.40 a box, weekly, or the labelled 2-minute demo period (`sunday-box`, `demo-2min`) | `planning/WEBSITE_SPEC.md` §3, §7 |
| city sizes | S about 1,000 edges (tonight), M about 10,000 (after the story is locked); seed 2026, 120 days, Zipf popularity with the cast shops at ranks 1–3 | `planning/PROMPTS/08-city-and-seeding.md`; `planning/SPEC/ARKIV_GRAPH.md` §8 |
| locations | test point 19.0760, 72.8777 (the addendum's example); the final story sets real neighbourhoods, dishes and landmarks with fictional shop names (ADR-0050) | `planning/EVENT_ADDENDUM.md` A1 |
| video shot list | nine shots, 0:00–4:00: the line, the request and veto, the payment, the merchant's phone, the Arkiv write, refund and renewal, pause, race mode, the drop-in | `planning/WEBSITE_SPEC.md` §11 |
| agent presets | testing and video: `claude-opus-5-5` at xhigh; live: `claude-haiku-5-5` at xhigh | ADR-0048 |
