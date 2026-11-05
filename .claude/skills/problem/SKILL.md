---
name: problem
description: Log a problem that cost time or nearly broke something in docs/problems/PROBLEM_LOG.md, with cause, fix and prevention.
---

# problem

Append one entry to `docs/problems/PROBLEM_LOG.md` (newest last, under your activity's heading if the file has them):

```
### P-<activity>-<n>: <one-line symptom>
When: YYYY-MM-DD HH:MM IST · Activity: <activity> · Cost: <minutes lost or risk>
Symptom: <what we saw, redacted>
Cause: <the root cause, with evidence>
Fix: <what changed, PR link>
Prevention: <the rule, test or check that stops it happening again>
```

No secrets or private URLs in the entry. If the prevention is a rule every session should follow, add it to `CLAUDE.md` in the same PR and say so in your relay.
