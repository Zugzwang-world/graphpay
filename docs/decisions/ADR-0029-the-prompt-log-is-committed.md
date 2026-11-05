# ADR-0029: The prompt log is committed

Status: accepted · Date: 2026-11-05 · Decided by: main under the founder's authority (M0 step 2)

## Decision

`prompts/raw/` (written by the `UserPromptSubmit` hook, secrets masked, the home folder shortened to `~`) is committed with each PR, one file per session and IST day; `.vercelignore` keeps it out of deployments.

## Why

ETHGlobal wants the prompts in the repo; one file per session avoids merge conflicts between parallel sessions (a deviation from the pack's one file per day).

## Consequences

The two prompts typed before the hook existed were backfilled through the hook's own masking.
