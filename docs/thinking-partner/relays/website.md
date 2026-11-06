# Relay: website (the final stage)

Updated 03:40 IST, Sat 7 Nov (final website session, brief `briefs/0248-final-website.md`).

**In plain words.** The stage at the production URL now tells one story in eleven scenes, 0 to 10, on one screen. Vitalik's phone, the middle and Filter & Fold's phone move together: the phones act, the middle follows, and arrow keys only browse the last four scenes. The 19-slide deck is gone.

**What a visitor sees**
- **Scene 0:** a film made from the figurines loops in the middle; Vitalik's request floats on his phone as one bubble marked "Live demo". A tap sends the real errand.
- **Scenes 1 to 4, the errand:** the ENS tree of both teams, the receipts as a plain table, plain Arkiv beside GraphPay with this run's real query, the receipts as a graph of names, the shop checking the buyer back, and the x402 payment lane by lane. Both phones show the same step at the same time.
- **Scene 5:** Refund on Vitalik's phone, one tap to attach the coffee photo (uploaded from the browser to Swarm's public gateway), then Accept or Decline on the shop's phone.
- **Scene 6:** the payer's switch: paused on ENS, then its next payment refused, nothing sent.
- **Scenes 7 to 10:** what we proved on Arkiv (the race live at size S), ENS and Whitechain, then the close.

**Technical**
- One scene table, `apps/web/lib/stage/scenes.ts`, with its test; the errand folded once from its frames by `lib/stage/errand.ts`, paced by `lib/stage/pace.ts`; the agents' lines are templates in `lib/stage/lines.ts` filled from the frames and `story.json`.
- The director is `apps/web/components/stage/director.tsx`. Two new messages: `graphpay.scene` (stage to both phones) and `graphpay.relay` (stage to the other phone). The shop's phone forwards the merchant stream's edges, so the stage opens no stream of its own.
- The phones (`apps/phones/src/customer.tsx`, `merchant.tsx`) are built on the team's PhoneFrame, tokens and figurines; the team's design is credited in each PR.
- Config: `order.area` in `story.json`; the ENS app's Sepolia name pages, the repository and the two npm packages in `graphpay.config.json`.

**Next:** merge, check one live errand on production, then the refund, the decline off camera, and the pause with its refused payment.
