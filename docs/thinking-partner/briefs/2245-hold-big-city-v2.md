Received 22:45 IST by main (attached by the founder; from the thinking partner). Replaces v1, which main never received.

# Brief v2: verify funding, hold the big city, record decisions

From the thinking partner (claude.ai), via the founder. For: main, the M0 coordinator.
File it in `docs/thinking-partner/briefs/` with your usual time prefix. It replaces v1, which wrongly said the Ankr URL was already stored.

Everything here is already decided by the founder, or is a check. Nothing here sets the story; the story-config brief comes later. Some items overlap the founder's three queued messages (the story-config rule, the FUNDER top-up, the model presets); do each once.

## Context

- Funding: by the founder's figures, FUNDER holds about 154 test USDT and 3.8 WBT on Whitechain, 12.9 tGLM on Arkiv Rabdi, and 0.28 Sepolia ETH.
- Ankr: when this was written, the founder's personal testnet URL was not stored. He is storing it through the hidden prompt in the Terminal panel, with the command he asked you for. His Ankr plan is the free tier; its WSS endpoint appears locked, so only the HTTPS endpoint is available.
- Founder decision: the large city is seeded into Arkiv only after the final story is locked. The thinking partner's copy of OPEN.md (item 4) still plans M seeding for about 23:30 tonight.
- Budget: 12.9 tGLM covers one M seeding (about 8.5) plus the mirror. A second M seeding needs another faucet claim.

## Do, in this order

1. **Hold the big city.** Seed nothing above size S until the founder says the story is locked. Tonight, S only, with the test cast. If M seeding has already started, pause it and report entities written, tGLM spent and tGLM left. Make sure the wave-1 line for the arkiv track says this.
2. **Funding and RPC.** Your queued message covers balances and role funding. Also: if the test USDT is there, retire the stand-in token from the plan. Once the founder has stored the Ankr URL, confirm it is in `.env` without printing it, and that the RPC reports chain 1874. Anything that needs live events (for example the merchant chime) polls over HTTPS or uses another WSS endpoint; say which. Close OPEN items 2, 4 and 5 once verified.
3. **Secrets hygiene.** Confirm the prompt-log hook redacts anything shaped like an Ankr RPC URL with a key (rpc.ankr.com, a chain name, a long hex token) before it writes, and that the secret scan blocks one in any commit. Never ask the founder to paste a secret into chat.
4. **Seeding numbers, in NOW.md.** tGLM for one M seeding; wall-clock time for one M seeding; the latest safe start so M is ready, with margin, before the Friday 18:00 IST freeze. Also: which story-config fields the seed reads, and whether the background city could seed before the featured cast is final.
5. **Record decisions.** Add ADRs for the founder decisions below, where not already recorded.
6. **Mirror.** When you start it, keep the Mac awake for as long as it runs (for example `caffeinate -ims -w` with the mirror's PID). Confirm it resumes from its last processed block after a sleep or a network drop.
7. **Model presets.** Run one tiny call per preset (testing, video, live) and confirm the model ID and effort level are accepted. Record seconds and cost. For the live preset (Haiku 5.5 at xhigh), also run a short multi-turn exchange and check for an empty text reply and for `stop_reason` `max_tokens`; give xhigh a large `max_tokens`. Third-party guides report that Haiku 5.5 at xhigh sometimes puts the whole answer into thinking and returns no visible text. If anything is rejected or flaky, name the nearest working setting and change nothing without the founder.
8. **Disclosure.** If the written pre-event disclosure has not gone to ETHGlobal, show the founder a paste-ready message: the README line, the `planning/DISCLOSURE.md` table, organiser questions 1, 3 and 4, and an optional last line asking ETHGlobal to confirm in writing the kickoff answer on AI use.
9. **Report.** Update NOW.md (summary and foundation) and OPEN.md, so the thinking partner sees it after Sync now.

## Founder decisions to record (if absent)

- **Tracks:** Arkiv "Build on Arkiv" plus the Swarm bonus; ENS "Best Use of ENSv2"; Whitechain Operate (one Whitechain prize per project). A general Whitechain payments solution; nothing hard-coded to one track.
- **Pitch frame:** identify (ENS), remember (Arkiv), pay (Whitechain). Agents that can pay, can be trusted, and can be stopped. Say "decentralized, secure and verifiable"; never "hidden".
- **One story config:** cast, shops, agents, products, prices, renewal item and schedule, locations, city parameters and demo steps come only from it, never from code. Tonight: a test cast and a small test city. The large city is seeded straight into Arkiv after the story is locked, labelled synthetic, with no real payments.
- **Mumbai:** real neighbourhoods, dishes and landmarks; fictional shop names, especially the trap shop.
- **Agent model presets, in the story config:** testing = `claude-opus-5-5` at xhigh (active now); video = Opus at xhigh if its timing fits (videos cannot be sped up); live and submission = `claude-haiku-5-5` at xhigh. Every test run records seconds and API cost per errand in OPEN.md.
- **Timeline:** acceptance tests target Friday 05:00–06:00 IST; demo product built Friday daytime; feature freeze Friday 18:00; rehearsals Friday evening; video in the founder's own voice, Mac screen recording, real speed; submit by Saturday 08:00 (hard deadline 09:00 IST); presentation Saturday 09:30.
- **Cut order if short:** Swarm, map heartbeats, renewal, package polish. **Never cut:** the real USDT payment, the live kill switch and the refused cap change, the 48-against-2 race, both phone views, the sponsor files, the video.

## Do not

- Seed the big city with the test cast.
- Print any secret, or ask the founder to paste one into chat.
- Ask the founder anything the chain or the repo can answer.
