# Feedback

Tried `@graphpay_ethglobal/agentpay`? Tell us what worked, what broke and what you need:
[open an issue with the "agentpay feedback" template](https://github.com/Zugzwang-world/graphpay/issues/new?template=agentpay-feedback.yml) (labels `agentpay` and `feedback`). Never paste a private key, a relayer key or a keyed RPC URL.

This file is the log of what we were asked and what we did about it. One line per request, newest first.

| date | who | what they asked | outcome |
|---|---|---|---|
| 2026-11-06 | (the event) | no issue was opened while the package was at 0.1.x | 1.0.0: our own review before the release found seven bugs (subscribe skipped guards, the refund limit could be split, accept ignored reputation, a settled payment stayed counted, a bad request could stop a node:http merchant, renewals reported twice, the MCP version), all fixed; every export documented; the README quickstart is the shipped example |
| 2026-11-06 | (first release) | nothing yet | 0.1.0 published for testing at ETHGlobal Mumbai |
