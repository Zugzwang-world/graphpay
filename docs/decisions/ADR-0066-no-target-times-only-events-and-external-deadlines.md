# ADR-0066: No target times; only events and the deadlines we don't control

Status: accepted · Date: 2026-11-06 09:46 IST · Decided by: founder (chat) · Source: the founder's standing rule

## Decision

From now on no task has a target time, whether it's the Coordinator's or a session's. Every task starts the moment it's given, runs as fast as it can, and is reported when it's done, never by a clock time. Two kinds of time remain:
- the deadlines we don't control: **the submission, Sat 7 Nov 09:00 IST**, and **the presentation, Sat 09:30 IST**;
- dependencies stated as events: the large city seeds the moment the story locks; the founder logs in to npm the moment both SDKs are ready; rehearsal 1 runs once the demo cast is in.

## Why

Clock targets made sessions pace and wait. Event-driven work lets every task finish as early as possible and keeps the reporting honest.

## Consequences

- ADR-0053's internal times are no longer targets: the "submit by 08:00", the 18:00 feature freeze and the rehearsal hours. The same goes for ADR-0049's "latest start 14:00", ADR-0063's "by 13:00", and the times in `docs/plan/MASTER_PLAN.md` §3 to §4 and the run files. ADR-0053's cut order still stands.
- The Coordinator's ticks stay a polling cadence, not a target. The M14 records go out on events (a milestone merged, the publish, the story lock, the 92% pause), not every two hours.
- The 92% pause rule (ADR-0062) is unchanged.
