Received 23:10 IST by main (attached by the founder; from the thinking partner).

# Brief: split the work into sessions for context clarity

From the thinking partner (claude.ai), via the founder. For: main, the M0 coordinator.
File it in `docs/thinking-partner/briefs/` with your usual time prefix.

Act on it before you write the wave-1 lines. It is the founder's last message to you before those lines. It changes how the work is organised, not what is built.

## Why

In the lab, each workstream ran in its own session and worktree. That kept every context small and the order clear. Here, M0 and every brief have gone through this one session. It is now past 70% context, with M0's merges, the story config and the wave-1 lines still to do. We want the lab's shape back, starting now.

## 1. Finish M0 lean

- Keep your own context for decisions, merges and the lines.
- Hand heavy reading and building to sub-agents (reviews, the story-config implementation, the coverage audit), and keep only their summaries.
- If a remaining M0 item can safely run as its own worktree session without blocking wave 1, move it into the lines instead of doing it here.

## 2. One file per session, one index

- Each session gets a self-contained file containing:
  - its goal and milestones, in order;
  - its gates (what must merge before what);
  - the files and folders it owns;
  - its acceptance checks;
  - the unattended rules from the previous brief;
  - a recommended effort level.
- Where the pack's PROMPTS already hold this, point to them plus the amendments instead of rewriting.
- Each copy-paste line then only names the session and the file to run.
- One index file lists every session in order (wave 1, the join, Friday), with its start condition and which sessions can run together.
- Name the session that owns the story config and the big-city load, so the story brief has a clear destination.

## 3. A fresh coordinator after M0

- Write a coordinator file covering:
  - the overnight job: watch merges, settle conflicts, write the two-hourly records, load the big city after the founder's story lock, run the acceptance tests;
  - where state lives: NOW, OPEN, LOG, COVERAGE, briefs;
  - what the coordinator must not do.
- Leave the main checkout clean on an up-to-date main branch, so the secret helpers work from it after PR #3 merges.
- When M0 is merged and the lines are ready, say "ready for handover". The founder will start a fresh Coordinator session from the coordinator file, and this session takes no more work.
- A queued update from the founder will arrive when this turn ends: the Ankr URL is stored, FUNDER got 15 more tGLM, and the Ankr session's worktree and branch should be removed. Handle it, update NOW.md, then hand over.

## 4. Briefs go to their owner

From now on, the founder sends each thinking-partner brief to the session that owns the work. Only cross-cutting briefs go to the coordinator.

## Do not

- Stop mid-merge, or leave a PR half-reviewed, for the handover.
- Seed the big city before the founder's story lock.
