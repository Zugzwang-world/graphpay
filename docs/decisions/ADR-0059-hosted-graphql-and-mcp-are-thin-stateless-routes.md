# ADR-0059: Hosted GraphQL and MCP are thin, stateless routes

Status: accepted · Date: 2026-11-06 · Decided by: T3 Arkiv (M7 amendment §8, ADR-0037)

## Decision

`/api/graphql` (GET cached `s-maxage=5, stale-while-revalidate=10`, POST uncached), `/api/explain/[id]` and `/api/mcp` are thin routes in `apps/web`, owned by T3, over `@graphpay/money-graph`. The MCP route builds a fresh server and a stateless Streamable HTTP transport (`WebStandardStreamableHTTPServerTransport`, no session id, JSON responses) per request, with the tools `schema`, `ask`, `graphql` and `explain` only. One read engine per instance keeps that instance's last 200 explain traces in memory; a trace from another instance is "not found", never stored off-chain (ADR-0003). Synthetic cities are read only with `dataset=S` (or `M`). Each route is rate-limited per client per instance.

## Why

Vercel instances share nothing and the project keeps no off-chain database. Explain ids are deterministic (sha256 of backend and sorted queries), so the same question asked again on any instance recreates the same trace.

## Consequences

The routes read `ARKIV_BACKEND` and `ARKIV_ACCESS_KEY` on the server only; without a key they use Rabdi's keyless public endpoint. GraphQL is executed with graphql-js 16.14.2 directly (the pack named Yoga 5.24.6); `graphql-yoga` stays a dependency for now and can be dropped.
