# ADR-0037: ENSIP-26 agent records and the hosted MCP endpoint

Status: accepted · Date: 2026-11-05 · Decided by: founder (addendum B1)

## Decision

`graphpay.eth` carries `agent-context`, `agent-endpoint[mcp]` (`<site url>/api/mcp`) and `agent-endpoint[web]` (the site URL); every agent carries `agent-context` and `agent-endpoint[mcp]`. T3 hosts the read-only MCP server at `/api/mcp` (Streamable HTTP) and owns `apps/web/app/api/{graphql,explain,mcp}`.

## Why

Agents and judges can discover GraphPay's tools from ENS alone (ENSIP-26, verified 2026-11-05).

## Consequences

The site URL is the production domain `https://graphpay-event.vercel.app` (config `site.url`). Acceptance B8.
