# ADR 0002 — Async memory surfacing (jobs queue)

Status: **proposed** (2026-06-04)

## Context

The engine reads are slow by nature (two sequential model calls):
- **Bring a page back** (`POST /memories/run`) ≈ 130s over a capped archive.
- **Voiced On-this-day** (`/memories/on-this-day/framed`) ≈ 10–67s over a date's
  entries.

Running these *inside* the HTTP request is fragile:
- It risks the autoscale/proxy **request timeout** (we already saw extract/score
  truncation + ~85–160s runs near the edge).
- The user must **hold the tab open** for minutes; a refresh or network blip loses
  the run.
- On-this-day can't lead with voice instantly, and warming it in the `run-nudges`
  cron is unviable (that cron already times out).

## Decision

Decouple the engine read from the request via a durable **`memory_jobs`** queue.
The client **enqueues** a job and **polls** for the result; the work runs
**detached** from the request. Processing is an **optimistic in-process start +
a cron backstop** (no always-on worker needed — fits Replit autoscale + the
existing cron infra, and the volume is tiny).

### Flow
1. `POST /memories/run` (and on-this-day warming) **enqueues** a job → returns
   `{ jobId }` immediately (202). Dedupe on a recent identical queued/running job.
2. The same process **optimistically kicks off** `processJob(id)` fire-and-forget
   (starts immediately when the instance survives).
3. `processJob` atomically claims (queued→running), runs `runMemoryForUser`,
   writes `result`, marks `done`/`error`.
4. A **backstop cron** (`POST /cron/process-memory-jobs`, ~1–2 min) re-claims any
   job left `queued` (the optimistic start died with the instance) or `running`
   too long (stale), and processes it. Idempotent; returns fast (kicks off, does
   not block on the engine).
5. `GET /memories/jobs/:id` returns `{ status, result }`. The client polls every
   ~3s, shows the calm reading state, renders on `done`, and persists `jobId` so
   navigating away/back resumes.

### On-this-day
Warming uses the SAME queue: enqueue a `kind:"on_this_day"` job (a small cron
batch + on first cold visit). It runs `runMemoryForUser({ entryIds, preview })`,
which warms the engine cache; the `/on-this-day/framed` endpoint then serves from
cache → instant. No synchronous engine work in any cron.

### Why optimistic-in-process + cron backstop (not a Reserved VM worker)
At this scale (single-digit users, occasional taps) instances usually stay warm
long enough to finish the detached work; the cron backstop covers the rare miss
with at most one interval of extra latency. A dedicated always-on worker is more
reliable but is infra/cost we don't need yet — and the queue makes swapping the
processor in later a non-event.

## Migration
One additive table, `memory_jobs`, via `drizzle-kit push` (same flow as capsules).
No change to existing tables/data.

## Slices
- **A — DONE:** `memory_jobs` table + ADR. Inert.
- **B — DONE:** job lib (`enqueueMemoryJob` w/ dedupe + optimistic start,
  `processMemoryJob` atomic claim, `sweepMemoryJobs` backstop); `POST
  /memories/run` → enqueue when `ASYNC_MEMORY=on` (else unchanged sync);
  `GET /memories/jobs/:id`; `POST /cron/process-memory-jobs`; frontend enqueue →
  poll (3s) → render, resume via `localStorage`.
- **C — DONE:** on-this-day warming. `onThisDayFramedSet` is shared by the framed
  endpoint and `POST /cron/warm-on-this-day` so warm + serve use identical entry
  ids → the warmed engine cache lines up and the page serves the voiced lead
  instantly. Warm cron enqueue-only (no optimistic stampede); backstop drains.
- **D — NEXT:** dev-verify B+C together, then the ordered prod enable
  (`drizzle-kit push` → `ASYNC_MEMORY=on` → schedule `process-memory-jobs` +
  `warm-on-this-day` crons).

## Rollback
`POST /memories/run` keeps a synchronous fallback path behind a flag during
rollout, so if the queue misbehaves we revert the route to inline execution
without a redeploy. The table is additive and harmless if unused.
