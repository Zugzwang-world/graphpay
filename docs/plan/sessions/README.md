# Sessions: the index

One self-contained run file per session. To start one: in the Claude desktop app → Code, open a new session on `~/graphpay` with the worktree option on, pick the model and effort below, and paste its start line as the first message. When the founder is needed: `docs/plan/prompts/session-lines.md`.

| order | session | file | model | effort | start condition | runs with |
|---|---|---|---|---|---|---|
| wave 1 | T1 Payments | `T1-payments.md` | Opus 5.5 | xhigh | when main says M0 has merged | wave 1: all six together |
| wave 1 | T2 Identity | `T2-identity.md` | Sonnet 5.5 | high | same | wave 1 |
| wave 1 | T3 Arkiv | `T3-arkiv.md` | Opus 5.5 | xhigh | same | wave 1 |
| wave 1 | T4 Agents | `T4-agents.md` | Sonnet 5.5 | high | same | wave 1 |
| wave 1 | T5 Web | `T5-web.md` | Sonnet 5.5 | high | same | wave 1 |
| wave 1 | Join | `join.md` | Opus 5.5 | xhigh | same; waits for M7a (and M1, M5) by polling | wave 1 |
| handover | Coordinator | `coordinator.md` | Opus 5.5 | high | when main says "ready for handover" | wave 1, then Submission, until the pitch |
| Friday | Submission | `submission.md` | Sonnet 5.5 | high | Fri 13:00 IST or CP4 done, whichever is later | the Coordinator and the tracks' Friday items |

## Start lines

T1 Payments:
```text
You are T1 Payments. Run docs/plan/sessions/T1-payments.md. Go.
```
T2 Identity:
```text
You are T2 Identity. Run docs/plan/sessions/T2-identity.md. Go.
```
T3 Arkiv:
```text
You are T3 Arkiv. Run docs/plan/sessions/T3-arkiv.md. Go.
```
T4 Agents:
```text
You are T4 Agents. Run docs/plan/sessions/T4-agents.md. Go.
```
T5 Web:
```text
You are T5 Web. Run docs/plan/sessions/T5-web.md. Go.
```
Join:
```text
You are Join. Run docs/plan/sessions/join.md. Go.
```
Coordinator:
```text
You are Coordinator. Run docs/plan/sessions/coordinator.md. Go.
```
Submission:
```text
You are Submission. Run docs/plan/sessions/submission.md. Go.
```

## Who gets what

**The Coordinator owns the story config (`packages/config/story.json`) and the big-city load (size M), so the founder's story brief goes to the Coordinator.**

**Briefs go to their owner:** the founder sends each thinking-partner brief to the session that owns the work (each file's "Owns"); only cross-cutting briefs and the story brief go to the Coordinator.

## Across sessions

- The PR that completes a milestone ends its title with `(Mn done)`, so other sessions' polls can find it.
- Where an older record says "main" for work after M0, read the Coordinator (records, config, funding, secrets, merges) or Submission (M17).
- Each session's working notes live in `docs/sessions/<activity>/`, not in this folder.
