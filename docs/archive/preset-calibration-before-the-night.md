# Preset calibration, the rows before the night run

Moved from `docs/thinking-partner/OPEN.md` at the backend's close (01:55 IST, Sat 7 Nov) to keep the thinking-partner folder under its word limit; the night run's rows stay in OPEN. Unchanged.

| time (IST) | run | preset | model, effort | seconds per errand | API cost per errand | notes |
|---|---|---|---|---|---|---|
| 22:54 | M0 probe (one-word reply, not an errand) | testing | `claude-opus-5-5`, xhigh | 2.2 | $0.0005 | accepted |
| 22:54 | M0 probe (one-word reply, not an errand) | video | `claude-opus-5-5`, xhigh | 1.6 | $0.0006 | accepted |
| 22:54 | M0 probe (one word, then three short turns) | live | `claude-haiku-5-5`, xhigh | 0.9; turns 0.9 / 0.9 / 1.9 | under $0.0002 in all | accepted; no empty reply, no `max_tokens`; once the same answer in two text blocks (read the final block) |
| 01:29 | T4 M10 live run 1 (mock services) | testing | `claude-opus-5-5`, xhigh | 94.1 | $0.2857 | paid the good shop; 19 calls, 47,456 tokens; risk reply over the strict schema |
| 01:31 | T4 M10 live run 2 | testing | `claude-opus-5-5`, xhigh | 73.2 | $0.3050 | paid the good shop; 20 calls, 51,639 tokens |
| 01:33 | T4 M10 live run 3 | testing | `claude-opus-5-5`, xhigh | 85.1 | $0.3049 | paid the good shop; 20 calls, 50,916 tokens |
| 01:34 | T4 M10 live run 4 | testing | `claude-opus-5-5`, xhigh | 139.5 | $0.2903 | paid the good shop; 19 calls, 46,989 tokens |
| 01:36 | T4 M10 live run 5 | testing | `claude-opus-5-5`, xhigh | 321.0 | $0.2965 | paid the good shop; 19 calls, 47,287 tokens; one slow model call (range 73 to 321 s) |
| 04:32 | Join e2e:food real, rehearsal (live hooks, real shop) | testing | `claude-opus-5-5`, xhigh | 56.5 | $0.2289 | refused by kesar's risk check: the MCP's buyer_risk table bug (fixed, PR 48) and rehearsal's real 1/6 cancel rate (correct by policy) |
| 04:40 | Join e2e:food real, payer | testing | `claude-opus-5-5`, xhigh | 88.8 | $0.2623 | approved by the shop; the signer answered a headers object, so nothing was signed (fixed) |
| 04:43 | Join e2e:food real, payer (the counting run) | testing | `claude-opus-5-5`, xhigh | 122.1 | $0.2986 | **paid** 4.80 on Whitechain, delivered, refunded 0.80; A–E pass |
| 10:41–10:42 | Join live runner on the production site (`/api/agents/run`), three runs, payer | live | `kimi-k3.1-pro-highspeed`, high | 11.9, 9.4, 7.6 | ≤ $0.025 each (1,225 and 1,187 tokens; the server's `apiCostUsd` line is in the Vercel log, not read here) | no-purchase: the concierge answered ("I'll find the best gulab jamun options…") and stopped without delegating to the scout and analyst; nothing signed |
| 10:31 | T4 Kimi run 0 (mock services, before the fix) | testing | `kimi-k3.1-pro`, high | 6.4 | $0.0042 | **no purchase**: with a `response_format` Kimi answered the JSON at once and called no tool (1 call); fixed in PR 92 by putting the schema in the instructions |
| 10:32 | T4 Kimi run 1 (mock services, after the fix) | testing | `kimi-k3.1-pro`, high | 123.4 | $0.0687 | paid the good shop; 18 calls, 26,452 tokens |
| 10:34 | T4 Kimi calibration 1 (mock services) | testing | `kimi-k3.1-pro`, high | 149.7 | $0.0661 | paid the good shop; 19 calls, 28,764 tokens |
| 10:37 | T4 Kimi calibration 2 | testing | `kimi-k3.1-pro`, high | 126.7 | $0.0586 | paid the good shop; 19 calls, 27,804 tokens |
| 10:39 | T4 Kimi calibration 3 | testing | `kimi-k3.1-pro`, high | 155.4 | $0.0664 | paid the good shop; 19 calls, 28,697 tokens |
| 10:41 | T4 Kimi calibration 1 (mock services) | video | `kimi-k3.1-pro-highspeed`, high | 70.0 | $0.1423 | paid the good shop; 19 calls, 28,706 tokens |
| 10:42 | T4 Kimi calibration 2 | video | `kimi-k3.1-pro-highspeed`, high | 56.0 | $0.1091 | paid the good shop; 19 calls, 27,189 tokens |
| 10:43 | T4 Kimi calibration 3 | video | `kimi-k3.1-pro-highspeed`, high | 57.2 | $0.1145 | paid the good shop; 19 calls, 27,850 tokens |
| 10:44 | T4 Kimi calibration 1 (mock services) | live | `kimi-k3.1-pro-highspeed`, high | 58.3 | $0.1139 | paid the good shop; 19 calls, 27,448 tokens |
| 10:45 | T4 Kimi calibration 2 | live | `kimi-k3.1-pro-highspeed`, high | 60.3 | $0.1210 | paid the good shop; 19 calls, 28,304 tokens |
| 10:46 | T4 Kimi calibration 3 | live | `kimi-k3.1-pro-highspeed`, high | 64.5 | $0.1249 | paid the good shop; 19 calls, 28,281 tokens; highspeed is about 2.2 times faster than pro and about 1.9 times the cost; Opus 5.5 xhigh was 73 to 321 s at about $0.30 |
| 10:47 | Join live runner on the production site, payer (after T4's Kimi fix, PR 92) | live | `kimi-k3.1-pro-highspeed`, high | 85.0 | not read (the server's `apiCostUsd` line is in the Vercel log) | refused before signing: the team ranked and chose kesar (0.913), the risk agent approved the payer, then the hosted shop's 402 step answered "quote write failed" (W_DIRECTORY; most likely a clash with this run's presence batches, now held around the 402 step, PR 93); 6 agents, 16 tool calls |
| 11:08 | Join live runner on the production site, payer (after PR 93's hold) | live | `kimi-k3.1-pro-highspeed`, high | 95.7 | not read (server log) | unsettled: every check passed and the payer signed 4.80, then the hosted facilitator's settle send threw (ContractFunctionExecutionError, T1's log); order NONE, relayer nonce unchanged, nothing sent |
| 11:11 | Join live runner on the production site, payer (retry) | live | `kimi-k3.1-pro-highspeed`, high | 171.2 | 177,690 tokens: between $0.71 (all input) and $3.55 (all output) at the config's prices, less with cache reads; the exact `apiCostUsd` is in the server log | **paid** 4.80 to kesar on Whitechain, the first live errand through the site: https://explorer.testnet.whitechain.io/tx/0x8617754857a8eb1fb1483b4f18fb6fa6a4f1607241d3f08c7ccd062de1b8863a ; 7 agents, 19 tool calls |
| 13:28 | Join live runner on the production site, payer (after #108, #112 and T1's settle-safety #114) | live | `kimi-k3.1-pro-highspeed`, high | 128.9 | 32,584 tokens: $0.13–$0.65 at the config's prices (exact `apiCostUsd` in the server log) | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0x9749a7f766282021a4e0e255276b938e53c608f55985a68b4b59b08d852a1e1a ; 7 agents, 16 tool calls, no retry |
| 13:30 | Join live runner on the production site, payer (the second of the founder's two) | live | `kimi-k3.1-pro-highspeed`, high | 115.1 | 28,712 tokens: $0.11–$0.57 | **paid** 4.80 to kesar: https://explorer.testnet.whitechain.io/tx/0x11588a5e47611c1e9095219ab95b8907d8b0f59a602f56d8b12d11a16cfa0a13 ; 7 agents, 15 tool calls, no retry |
