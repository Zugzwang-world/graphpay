# Feedback

Version 1.0.0 was released at ETHGlobal Mumbai (5 to 7 November 2026). We would like it to be useful to you, and we learn most from people who try it.

## How to tell us

Open a GitHub issue with the labels **`arkiv-graph`** and **`feedback`**. The easiest way is the template, which adds both:

<https://github.com/Zugzwang-world/graphpay/issues/new?template=arkiv-graph-feedback.yml>

Bug reports, a missing feature, a confusing README step, "it worked, here is what I built": all welcome. Do not put keys, private RPC URLs or other secrets in an issue.

## What we want to learn

1. Did the quickstart work in 5 minutes on your machine? Where did you stop or guess?
2. What graph did you try to define, and did nodes, edges and totals fit it? What did you have to work around?
3. Did the explain trace tell you what you needed? What else would you want in it?
4. What was missing or surprising in the types, errors or limits (30 attributes, the predicate budget, row lifetimes)?
5. Would you use it on a node rather than ArkivSim, and what stopped you?

## Log

What people asked, and what we did about it. Newest last.

| date | who | what they asked | outcome |
|---|---|---|---|
| 2026-11-06 | (the event) | no issue was opened while the packages were at 0.1.x | 1.0.0: our own review before the release found five bugs (paging past rows that do not fit the schema, row lifetimes, split writes, refused batches waiting out the recovery window, the predicate budget), all fixed; every export documented and typed; the quickstart safe to run twice on a node |
