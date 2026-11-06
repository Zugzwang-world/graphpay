# Video script: the founder's clicks

One page for recording the stage at https://graphpay-event.vercel.app (ADR-0082). No narration here: the words are yours. Rules stand in [`docs/submission/VIDEO.md`](../../submission/VIDEO.md): your own voice, 2 to 4 minutes, never sped up, every party shown.

## Setup (5 minutes before)

1. **The payer is active and the shop is open:** [state](https://graphpay-event.vercel.app/api/state/customer) shows `"status":"ACTIVE"`; [heal](https://graphpay-event.vercel.app/api/state/heal) shows the shop `"open":true`. A paused payer resumes by itself 2 minutes after its pause; a closed shop reopens 5 minutes after it closed.
2. **A fresh Sunday box renewal, from [`/customer`](https://graphpay-event.vercel.app/customer), not from the stage:** tap Subscribe there (2.40 a box on the labelled 2-minute demo clock). Wait 2 to 3 minutes: the renewal cron charges it once. Scene 6 then shows "Sunday breakfast box renewed: 2.40" with its link. Cancel it from `/customer` after the recording (at most 3 charges either way).
3. **The pass:** 300 test USDT a day, reset at 05:30 IST. Each errand spends 4.80; the refund gives 0.80 back.
4. **The window:** Chrome at 1440 × 900 or 1920 × 1080, no login, the stage on scene 0 (press Esc if not). Close the browser's other tabs. The top bar says "Everything is live, not recorded."
5. **One errand at a time:** if anyone else runs one, the bubble says "Another errand is running. Try again in a minute."

## The scenes

| scene | tap | wait for | it proves |
|---|---|---|---|
| 0 Opening film | nothing; let the film play once (38 s: the coins, the question, the table of payments growing, the pointer, the table turning into a graph, then Identify, Remember fast, Pay, built slowly and held about 4 s to speak over), then tap the floating request bubble on Vitalik's phone (the USER phone) | the bubble becomes the sent message | the problem |
| 1 Two teams | nothing | the concierge's line; Find turns green; the ENS tree's agent nodes light | every agent is a name on ENS |
| 2 Finding the best shop | nothing (three beats, about 35 s) | the shop cards with their photos from Swarm; their scoreboards; the ranking with the trap in red, the menu with the chosen dish; Pay turns on | the agents ask Arkiv before paying |
| 3 The check back | nothing | the shop's phone: the risk agent's numbers and "Approved", then "Sending the bill" | the shop checks the buyer back |
| 4 The bill and the payment | nothing | the bill, "Signed once", then Paid with its Whitechain link and "Gas paid by GraphPay, you paid 0"; right after, the shop (the MERCHANT phone) marks the order dispatched on Whitechain by itself: both receipts show Paid and Dispatched, each with its own Whitechain link | x402 on Whitechain, no gas for the payer; the shop dispatches on chain |
| 5 The refund | **Refund** on the paid card (it shows only once the order is dispatched); **Attach the photo**. Nothing to tap on the shop's phone | the coffee photo "On Swarm" with its link, the request on Arkiv; the shop's risk agent accepts by itself ("… on a dispatched order. Accept."), then "Refunded 0.80" with its Whitechain link on both phones. Within 30 s of the dispatch, the shop first waits out its per-order guard | a refund with its proof, accepted by the shop's own agent |
| 6 The off switch | tap the **Payer** figurine on Vitalik's phone, then **Pause** | "Paused" with its Sepolia link and "Resumes by itself at …" (up to 20 s), then the payer's next payment "Refused: the payer is paused on ENS. Nothing was sent." The shop's phone says nothing was received | the owner stops an agent in one tap |
| 7 Arkiv | **→** (arrow key or clicker) | the two meters fill: "1.8x faster" and "about 30x less data" (lab, 9,612 payments); the npm card shows its version | memory, fast and light |
| 8 ENS | **→** | the features, each with its proof | names, owners, off switches |
| 9 Whitechain | **→** | the two columns and the proof links; the agentpay card | payments people can use |
| 10 Close | **→** | the line and the three small graphs; both phones replay the run | the close |

**After:** press Esc (the stage returns to scene 0; the display only). The payer resumes by itself within 2 minutes of the pause. Cancel the Sunday box from `/customer`.

**If a step fails:** the phone says what happened in plain words. An errand that stops says so on both the phone and the middle; wait a minute and tap the bubble again (Esc first).
