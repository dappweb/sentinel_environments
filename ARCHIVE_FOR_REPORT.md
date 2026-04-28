# Sentinel Environments — Consolidated Archive for NeurIPS Report

**Purpose.** This file concatenates planning, audit, and design documents that have been superseded by git history but contain reasoning, inventory, and methodology useful for drafting the NeurIPS benchmark paper. Feed this file (plus the repo itself) to a report-writing LLM.

## Repo state at consolidation time (2026-04-20)

- Current branch: `scenario-authoring`, stacked on `speed-factor` → `time-scale-changes` → `main`.
- 10 environments: MicroMail, MicroChat, MicroDin, MicroFy, MicroGram, MicroHood, MicroHub, MicroLendar, MicroScholar, MicroTube.
- 32 benchmark scenarios across `scenarios/<env>/*.json`, plus 10 dev wildcard scenarios (one per env). Target matrix is 8/env = 80 total.
- **MicroMail is the only env at full 2-2-2-2 coverage** (4 cells × 2 distinct targets per cell). All other envs are at 2–3 scenarios.
- Open PRs: #73 `time-scale-changes` (randomized condition_at + schema), #74 `speed-factor` (wall-clock scaling knob).
- CI is shipped (`.github/workflows/ci.yml`): backend pytest + eval_sql, frontend lint/type-check/build, two parallel jobs.

## Benchmark design summary

- **Task**: an agent polls a simulated web app (FastAPI backend, React frontend, per-env handler) and must detect when a user-specified condition becomes true. Each scenario has a natural-language `prompt`, a deterministic `events` timeline in sim-seconds, and an `eval_sql` query.
- **Matrix dimensions**: `{passive, active} × {absolute, relative}`.
  - *Passive*: condition resolvable from the list/summary view. *Active*: requires opening a detail view each poll (content past the list-row preview).
  - *Absolute*: fixed threshold/keyword. *Relative*: delta vs baseline captured at `/init` (handler writes `baseline_*` to session_meta).
- **Evaluation**: `POST /evaluate` materializes session state to in-memory SQLite, runs the scenario's `eval_sql`, returns pass/fail. Truthy = success. Binary accuracy + wall-clock elapsed + token cost.
- **Anti-gaming**: server stays a dumb state machine; state is server-side (not agent-visible); events are deterministic; harness enforces `kill_at` via `os.killpg`.

## Timing model (PRs #73 + #74)

- `condition_at` is randomized per scenario, uniform in `[10, 600]` sim-sec, seeded deterministically from `scenario_id` (md5-hashed). Per-id seeding means new scenarios don't reshuffle existing ones.
- `kill_at = MAX_CONDITION_AT + REACTION_WINDOW = 600 + 30 = 630` sim-sec at `speed_factor=1.0`.
- `event_timeline_end = MAX_CONDITION_AT + EVENT_BUFFER = 600 + 120 = 720` sim-sec. Events may extend into the tail buffer; at slow speeds the tail is dormant, at fast speeds it fills the reaction window.
- `speed_factor` scales wall-clock ↔ sim-clock exchange rate. `>1` slower (1.5 → event at sim=300 fires at wall=450); `<1` faster; floor `MIN_SPEED_FACTOR=0.25` (4× real-time). The 30-wall-sec reaction window is NOT scaled, so the agent's think-budget after target is constant across all speeds.
- `kill_at_wall = MAX_CONDITION_AT × speed_factor + REACTION_WINDOW`. Buffer and reaction window are **overlapping, not additive** (see Duration Changes Plan section below for worked example).

## Contents (in order)

1. **DURATION_CHANGES_PLAN.md** — Design doc for the timing model in PRs #73/#74. Worked-example table, `kill_at` formula derivation, MIN_SPEED_FACTOR=0.25 rationale. *High paper value: methodology section.*
2. **FEATURE_AUDIT.md** — 10-env feature-parity matrix vs reference products (Outlook, Teams, LinkedIn, Spotify, Instagram, Robinhood, GitHub, Google Calendar/Scholar, YouTube). Per-env tables + summary. *High paper value: environment descriptions / appendix.*
3. **AUDIT_PROMPTS.md** — Six pre-release audit prompts (state merging, eval_sql correctness, endpoint/type contracts, asset pipeline, test coverage, security/deployment). **NOTE**: path references inside are stale — written before scenarios moved from `server/<env>/scenarios/` to `scenarios/<env>/`, and before the `sentinel_api/` → `server/` rename. The *topics* are still valid. *Medium paper value: validation methodology.*
4. **AUDIT_RUNBOOK.md** — Playwright visual audit commands per env; paths current. *Low paper value; reproducibility appendix only.*
5. **PR_PLAN.md** — Chunked execution log for the `cleaning-files` branch. Chunks A–G done (scenarios-to-root, filename prefix drop, self-user refactor, lint/README hygiene, test_integration fixes, CI workflow). Chunk H (fictional brand/institution scrub) pending. *Low paper value; shows scope of pre-release cleanup.*
6. **RENAME_PROMPT.md** — One-off directory rename prompt (`sentinel_api/` → `server/`, `sentinelbench/` → `frontend/`). Executed. *Minimal paper value; historical context only.*

## NOT in this archive (still live in repo root)

- `README.md`, `SECURITY.md` — tracked files, read them directly.
- `CLAUDE.md` — active Claude-session instructions; local, per-user.
- `SCENARIO_GEN.md` — active scenario-authoring guide; referenced by ongoing authoring work.
- `SCENARIO_AUTHORING_PROMPTS.md` — 9 per-env prompts for the scenario-authoring push; actively in use on the current branch.

## Cross-references for the report writer

- For **evaluation protocol**: see the `Evaluation Protocol` section of `README.md` + the `anti-gaming` bullets in the Timing Model section above + `server/eval_harness.py` source.
- For **timing model rationale**: see DURATION_CHANGES_PLAN.md section below (especially the worked-example table).
- For **environment scope**: see FEATURE_AUDIT.md section below.
- For **scenario authoring methodology**: see `SCENARIO_GEN.md` in the repo (kept standalone; not in this archive).


---

# ========== ORIGINAL FILE: DURATION_CHANGES_PLAN.md ==========

# Time Dimension Plan — `time-scale-changes`

Draft for Adam's review. Follow-up to PR #70.

## Motivation

Two problems with the current scenario timing:

1. **Fixed `condition_at: 300` across all 32 benchmark scenarios is a benchmark leak.** An agent can hardcode `sleep(300); check` and beat the suite without any real monitoring logic.
2. **Int-valued event times quantize badly under scaling.** At 10× speedup, int timestamps at second boundaries snap to a 10s grid instead of filling the space — wastes resolution.

Adam's proposal (from thread):

- Randomize `condition_at` per scenario, uniform in `[10, 600]`.
- Convert all time fields from `int` to `float` (2-decimal precision).
- Extend event timelines past `condition_at` with a post-condition **buffer** so future scaled-up runs always have events filling the reaction window.
- **Kill-at formula (Adam's PR #70 thread):** `kill_at_wall = MAX_CONDITION_AT × speed_factor + REACTION_WINDOW`. The 30 wall-sec reaction window is **not scaled**, so the agent's think-budget after target is constant across all speeds. At `speed_factor=1.0`, `kill_at_wall = 630`; at `speed_factor=2.0` (slower), `1230`; at `speed_factor=0.25` (fastest), `180`.
- **Buffer and reaction window are OVERLAPPING, not additive.** The buffer is authored *content* in sim-time, not extra *time* on the clock. At `speed_factor=0.25`, the 120 sim-sec buffer compresses into exactly the 30 wall-sec reaction window (they coincide). At `speed_factor=1.0`, most of the buffer (sim=[630, 720]) fires past `kill_at` and is **dormant — never fires**. Only 30 sim-sec of buffer gets used at 1×. Buffer existence does not shift kill_at.

**Worked example** (for reviewers — same JSON across all speed_factors):

```
Authored JSON:  sim=100 A,  sim=300 B,  sim=600 C [TARGET],
                sim=630 D,  sim=700 E,  sim=720 F
```

| `speed_factor` | `kill_at_wall` | events that fire | events in reaction window | wall-clock duration |
|---|---|---|---|---|
| 2.0 (slow)    | 1230s | A, B, C          | — silent             | ~20.5 min |
| 1.5           |  930s | A, B, C          | — silent             | ~15.5 min |
| 1.0 (default) |  630s | A, B, C, D       | D                    | ~10.5 min |
| 0.5           |  330s | A, B, C, D       | D                    | ~5.5 min  |
| 0.25 (fastest)|  180s | A, B, C, D, E, F | D, E, F              | 3 min     |

Key observations:
1. Same JSON, uniformly scaled — no regeneration per speed.
2. Fast speeds fire *more* of the authored timeline (they reach the tail F); slow speeds get killed before tail events can fire.
3. Agent's think-budget after target is always 30 wall-sec regardless of speed.
4. The buffer fills the reaction window at fast speeds; at slow speeds it falls past `kill_at` and is dormant (and the reaction window can be entirely silent — buffer can't rescue slow speeds).

Split into two phases. **Phase 1** (this PR): schema + randomization. **Phase 2** (follow-up): `speed_factor`. Phase 1's schema is forward-compatible.

---

## Phase 1 — schema + randomization

### 1.1 Scope: 32 benchmark scenarios, 10 dev scenarios untouched

Audit of `scenarios/*/*.json` (42 total):
- **32 benchmark scenarios** have `condition_at` — these are what Phase 1 edits.
- **10 `dev.json` scenarios** (one per env) lack `condition_at` — development/fallback scenarios, untouched by this PR. The regeneration script skips any scenario missing `condition_at`.

### 1.2 Schema changes

| Field | Before | After |
|---|---|---|
| `condition_at` | `300` (int, fixed) | float in `[10, 600]`, seeded per scenario, 2 decimals |
| `duration` | `600` (int) | renamed to `event_timeline_end`, value `720.0` |
| `kill_at` | *(absent)* | `630.0` — harness-enforced termination |
| `events[].time` | `int` | `float`, 2 decimals |

The `duration` → `event_timeline_end` rename is mostly cosmetic. One non-trivial ripple: `server/handlers/microhood.py:36` reads `session.duration` as a stock-price progress denominator — attribute name needs updating there.

### 1.3 Constants — new module `server/timing.py`

```python
MIN_CONDITION_AT = 10.0
MAX_CONDITION_AT = 600.0
REACTION_WINDOW = 30.0           # wall-clock seconds, NOT scaled
MIN_SPEED_FACTOR = 0.25          # fastest allowed: 1 wall-sec = 4 sim-sec
EVENT_BUFFER = REACTION_WINDOW / MIN_SPEED_FACTOR     # 120.0s sim-time tail
EVENT_TIMELINE_END = MAX_CONDITION_AT + EVENT_BUFFER  # 720.0s
KILL_AT = MAX_CONDITION_AT + REACTION_WINDOW          # 630.0s
SCENARIO_SEED = 42
```

Speed-factor convention matches Adam's PR #70 thread: `speed_factor = 1.5` means *slower* (event at sim=300 fires at wall=450). `speed_factor < 1.0` is faster, floored at `MIN_SPEED_FACTOR = 0.25` (4× real-time).

The server itself does not import `timing.py` at runtime (stays a dumb state machine). Consumers:
- Regen script (§1.5) — one-shot, reads bounds to pick `condition_at`.
- `tests/test_scenario_schema.py` (§1.8) — persistent; asserts every scenario stays in range.
- Phase 2 harness — persistent; uses `MIN_SPEED_FACTOR` + `REACTION_WINDOW` to compute `kill_at_wall` under scaling.
- Documented in `SCENARIO_GEN.md` (§1.9).

File lives under `server/` for import-path convenience with the tests; could relocate to a shared module if runtime vs spec separation becomes a concern.

### 1.4 Target event identification

**Convention (no new JSON field):** the target event is the one whose `time` equals `condition_at` in the current fixed-300 layout. Script locates it by filtering events where `time == condition_at`. This avoids adding any `target_*` field to the JSON — which would be trivially readable by a hostile agent.

**Audit across the 32 benchmark scenarios:**
- **29 scenarios**: exactly 1 event at `time == condition_at` → clean, script-handled.
- **2 scenarios with 2 events at condition_at** — both events jointly create the target state. Treat both as the "target bundle" and move them together:
  - `scenarios/microchat/unread-absolute-active.json`
  - `scenarios/microtube/notifications-absolute-active.json`
- **1 scenario with 0 events at condition_at** — the condition is driven by a **stock price trace crossing a threshold**, not a discrete event:
  - `scenarios/microhood/orders-absolute-active.json` (DRNE price hits $42.20 around t=300, driven by `data/catalogs/microhood/stock_price_traces.json`).
  - **Manual handling**: shift the relevant price-trace point to the new `condition_at` and adjust the surrounding trace so the threshold crossing lands at the right moment. This requires editing `stock_price_traces.json` alongside the scenario JSON.

### 1.5 Regeneration script — `scripts/randomize_condition_at.py`

Deterministic, one-shot. Steps per scenario:

1. Skip if `condition_at` absent (excludes the 10 dev scenarios).
2. Seed RNG deterministically with `hashlib.md5(scenario_id.encode()).hexdigest()[:8]` XORed with `SCENARIO_SEED`. Per-scenario-id hashing means adding a new scenario later doesn't reshuffle existing ones, and `hashlib` is version-stable (unlike Python's built-in `hash()`).
3. Draw `new_condition_at = round(uniform(MIN_CONDITION_AT, MAX_CONDITION_AT), 2)`.
4. Locate target event(s) — those with `time == old_condition_at`. If exactly 1, shift to `new_condition_at`. If 2 (the two outlier scenarios), shift both to `new_condition_at` keeping them together.
5. Shift distractor events to preserve relative order; **stretch distractor times proportionally** to fill `[0, event_timeline_end = 720.0]`. Target event(s) stay anchored at `new_condition_at`. Do not invent new distractor events.
6. Round all event times to 2 decimals. Write JSON back with `condition_at = new_condition_at`, `kill_at = 630.0`, `event_timeline_end = 720.0`, `duration` field removed.
7. For `microhood/orders-absolute-active`: script prints a warning with the new condition_at; price-trace edits are done manually.

Script is deterministic — re-running produces byte-identical output given the same seed + input scenarios.

### 1.6 Server code updates (narrow)

**Chunk A — already staged (int → float widening):**
- `server/session.py`: `simulation_time: int` → `float`, `duration: int` → `float`.
- `server/server.py`:
  - Line 379 — `async def advance(time: float)`.
  - Line 274 — `return float(session.events[idx]["time"])`.
  - Line 304 — `_advance_session(session, up_to_time: float)`.
  - Line 336 — `"simulation_time": round(_session.simulation_time, 2)`.
  - Line 321 — `elapsed = int(...)` is wall-clock elapsed; **leave as int** (integer-second tick counter, unrelated to scenario time).
- `server/schemas.py`: `EventPayload.time`, `InitPayload.duration`, `ConfigResponse.duration` widened to `float`.

**Post-PR #72 reconciliation (merged after Chunk A):**
- `server/schemas.py`: `InitPayload.condition_at: Optional[int]` → `Optional[float]`, `EvaluateResponse.{simulation_time, condition_at}: Optional[int]` → `Optional[float]`.
- `server/session.py`: `Session.condition_at: Optional[int]` → `Optional[float]`.

**Chunk B (still to do, paired with scenario JSONs):**
- `server/session.py`: rename `duration` → `event_timeline_end`. **No `kill_at` field** — the harness reads `kill_at` from scenario JSON directly and terminates the server via `os.killpg`. Nothing in the server reads `kill_at` at runtime, so storing it on `Session` would be dead state.
- `server/handlers/microhood.py:36`: `session.duration` → `session.event_timeline_end`.
- `server/schemas.py` (`InitPayload`, `ConfigResponse`): rename `duration` → `event_timeline_end`.

**Handler timestamp audit (for Phase 2 safety):** every handler that emits visible `timestamp` fields on user-facing rows (`micromail.py`, `microchat.py`, `microdin.py`) uses `datetime.utcnow()` — wall-clock, not sim-time. No handler renders `event["time"]` or `session.simulation_time` directly to the user. Only `microhood.py:36` reads `session.simulation_time` (as a ratio against `session.duration` for stock-price interpolation), which stays correct under any `speed_factor`. This is why Adam's "keep ticks real-time, re-schedule events" model won't produce future-posts artifacts here.

### 1.7 Harness updates

- `tests/test_eval_sql.py:87` — `advance_all()` changes from `/advance?time=999999` to `/advance?time=scenario["kill_at"]`.
- `tests/test_integration.py` — full review of each test's hardcoded advance times (30, 120, etc.). Some intermediate advances were "halfway through" checks that made sense when `condition_at` was always 300; those need re-examining per-test now that `condition_at` varies. Final `/advance` before `/evaluate` uses `scenario["kill_at"]` in every case.

### 1.8 Verification gates

- `python tests/test_eval_sql.py` → positive 32/32, negative 32/32.
- `pytest tests/test_integration.py -v` → 14/14.
- `python tests/test_frontend_wiring.py` → 44/44.
- Local `act` run → both CI jobs green.
- **New** `tests/test_scenario_schema.py` — for each benchmark scenario, assert:
  - `MIN_CONDITION_AT <= condition_at <= MAX_CONDITION_AT`
  - `kill_at == KILL_AT` and `event_timeline_end == EVENT_TIMELINE_END`
  - All event times are floats in `[0, event_timeline_end]`
  - At least one event has `time == condition_at`, except for the `microhood/orders-absolute-active` price-trace case (special-cased in the test).
- Manual spot-check: open 3–4 scenario JSONs, confirm `condition_at` values are distinct and spread across `[10, 600]`.

### 1.9 Documentation

- `SCENARIO_GEN.md` — new **"Time Dimension"** section documenting the constants in `timing.py`, the reasoning for each (why 10s lower bound, why 4× speedup ceiling, why the 30s reaction window is wall-clock-not-scaled), and the convention that target events fire at `condition_at`.
- `README.md` — refresh the example-scenario snippet to show floats and renamed fields.
- `CLAUDE.md` — note the rename in the ongoing-state section so future sessions don't reintroduce `duration`.

### 1.10 Prompt audit — already clean

Regex swept every benchmark scenario's `prompt` field for time-specific language (`minute`, `second`, `hour`, `am`/`pm`, clock times, "next N", "within N", "by N", `soon`, `now`). **Zero hits.** Prompts are already time-agnostic, so no prompt rewrites needed. Will include the regex in the new `test_scenario_schema.py` to block future drift.

---

## Phase 2 — `speed_factor` (follow-up PR, not in this branch)

**Model: re-schedule events at `/init`, ticks stay real-time.** The sim-clock does not "play faster"; we stretch the event schedule so a scenario-authored `time_sim = 300.0` fires at wall-clock `~450s` under `speed_factor = 1.5`. Posts/emails/DMs continue stamping `datetime.utcnow()` (see §1.6 handler audit), so nothing ever renders a future timestamp.

Rough shape:
- Harness (preferred over server) rewrites each event's time on init: `time_wall = time_sim * speed_factor`. The server sees only the rewritten timeline and never needs to know about `speed_factor`.
- `REACTION_WINDOW` stays in **wall-clock** — not scaled.
- `kill_at_wall = MAX_CONDITION_AT * speed_factor + REACTION_WINDOW` (harness schedules SIGKILL / `os.killpg` at this wall-clock deadline).
- `MIN_SPEED_FACTOR = 0.25` is the design floor; any faster and the 120s sim-time buffer runs out before the reaction window closes.

Phase 1's schema makes this purely a harness/server edit — no scenario JSONs change.

---

## Non-goals (explicit)

- **No server-side enforcement** of `kill_at`. Server stays a dumb state machine; harnesses respect the boundary and send `os.killpg` at the wall-clock deadline. `kill_at` lives in scenario JSON only, never on the `Session` dataclass.
- No changes to `eval_sql` queries, taxonomy dimensions, or distractor payloads.
- No new distractor events added to fill the buffer. Existing distractor tails extend into `[condition_at, event_timeline_end]`.
- No prompt rewrites — prompts are already time-agnostic per the audit in §1.10.
- Phase 2 scaling is not implemented in this PR.

---

## Resolved decisions

- **Microhood/orders price-trace**: edited manually — shift the DRNE threshold crossing in `data/catalogs/microhood/stock_price_traces.json` to land at the new `condition_at`.
- **Distractor strategy**: **stretch proportionally** to fill `[0, 720]`. Target event(s) anchored at `new_condition_at`.
- **Branch**: `time-scale-changes`. Stage after each chunk; wait for user review before the next chunk.

---

## Execution order

Each chunk below is a staging checkpoint — stage the relevant files, pause for user review, then proceed.

1. `git fetch origin && git checkout main && git pull && git checkout -b time-scale-changes`
2. **Chunk A** — `server/timing.py` + server code updates (§1.3, §1.6). Smallest surface, landable independently.
3. **Chunk B** — `scripts/randomize_condition_at.py` + run it across all 31 event-driven scenarios (§1.4, §1.5).
4. **Chunk C** — manual price-trace edit for `microhood/orders-absolute-active` (§1.4).
5. **Chunk D** — harness updates (§1.7).
6. **Chunk E** — new `tests/test_scenario_schema.py` with schema + prompt-language assertions (§1.8, §1.10).
7. **Chunk F** — run full verification gates (§1.8). Fix regressions inline.
8. **Chunk G** — documentation updates (§1.9).
9. Push, open PR referencing #70.

---

# ========== ORIGINAL FILE: FEATURE_AUDIT.md ==========

# Feature Audit — All Environments

Comprehensive comparison of each environment against the real product it replicates.

**Gap Legend:**
- **None** — Fully implemented (API + UI)
- **Missing API** — UI exists but no backend endpoint
- **Missing UI** — API exists but no UI button/element
- **Missing Both** — Neither API nor UI
- **Eval-only** — Intentionally server-only (bulk actions for eval harness)
- **UI-only** — UI present but changes don't persist to server

---

## 1. MicroMail (Outlook / Gmail)

**API Endpoints:** 7 total (1 GET, 4 POST mutations, 2 bulk actions)

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Core Email** |
| Inbox + 6 folders (sent, drafts, archive, junk, deleted, scheduled) | Yes | Yes | Yes | None |
| Mark read / unread | Yes | Yes | Yes | None |
| Flag / unflag | Yes | Yes | Yes | None |
| Move to folder | Yes | Yes | Yes | None |
| Delete (move to trash) | Yes | Yes | Yes | None |
| Archive | Yes | Yes | Yes | None |
| **Compose & Reply** |
| Compose new email | Yes | No | Yes (form, TODO) | Missing API |
| Reply / Reply All / Forward | Yes | No | Yes (form, TODO) | Missing API |
| CC / BCC fields | Yes | No | Yes (inputs) | Missing API |
| Save draft | Yes | No | Yes (button, TODO) | Missing API |
| **Bulk Operations** |
| Mark all read | Yes | Yes | Yes | None |
| Empty junk | Yes | Yes | Yes | None |
| Empty deleted items | Yes | Partial | No | Missing UI |
| Select multiple + act | Yes | Yes | Yes | None |
| **Search** |
| Search by subject/sender/body | Yes | No | Yes (client-side filter) | Missing API |
| **Attachments** |
| View attachment list | Yes | Yes | Yes | None |
| Download attachment | Yes | No | No | Missing Both |
| Attach file to compose | Yes | No | No | Missing Both |
| **Context Menu** |
| Delete / Archive / Flag / Read / Unread / Junk | Yes | Yes | Yes | None |
| **Missing Features** |
| Conversation threading | Yes | No | No | Missing Both |
| Sorting (by sender, subject, importance) | Yes | No | No | Missing Both |
| Snooze | Yes | No | No | Missing Both |
| Undo send | Yes | No | No | Missing Both |
| Signatures | Yes | No | No | Missing Both |
| Categories / labels / tags | Yes | No | No | Missing Both |
| Contacts / address book | Yes | No | No | Missing Both |
| Rich text formatting | Yes | No | Stub | Missing Both |

---

## 2. MicroChat (Teams / Slack)

**API Endpoints:** 5 GET, 4 POST mutations, 1 bulk action

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Core Messaging** |
| View conversations (direct, group, meeting) | Yes | Yes | Yes | None |
| Send message | Yes | No | Yes (local only) | Missing API |
| Edit message | Yes | No | Yes (local only) | Missing API |
| Delete message | Yes | No | Yes (local only) | Missing API |
| Message read status | Yes | Yes | Yes | None |
| Mark all as read | Yes | Yes | No | Missing UI |
| **Reactions** |
| Add / remove emoji reaction | Yes | Yes | Yes | None |
| Reaction counts | Yes | Yes | Yes | None |
| **Threading** |
| Reply in thread | Yes | Yes (replyToId) | Yes | UI-only (no persist) |
| Thread expansion | Yes | No | No | Missing Both |
| **Conversations & Teams** |
| Pin / favorite conversation | Yes | Yes | Yes | None |
| Mute conversation | Yes | Yes | No | Missing UI |
| Teams list with channels | Yes | Yes | Yes | None |
| Create / rename / delete channel | Yes | No | No | Missing Both |
| Add / remove members | Yes | No | No | Missing Both |
| **Calls** |
| View call history (incoming, outgoing, missed, group) | Yes | Yes | Yes | None |
| Initiate call (audio/video) | Yes | No | Yes (modal, simulated) | Missing API |
| **Calendar** |
| Calendar view (day/week/month) | Yes | Yes | Yes | None |
| Schedule meeting | Yes | No | Yes (local only) | Missing API |
| **Attachments** |
| Display attachments | Yes | Yes | Yes | None |
| Upload files / images | Yes | No | Yes (picker, local only) | Missing API |
| **Voice Messages** |
| Record & send voice message | Yes | No | Yes (local, waveform UI) | Missing API |
| **Status & Presence** |
| Online status (available/busy/dnd/away) | Yes | No | Yes (colored dot) | UI-only |
| **Missing Features** |
| Typing indicators | Yes | No | No | Missing Both |
| Bookmarks / saved messages | Yes | No | No | Missing Both |
| GIF / sticker support | Yes | No | No | Missing Both |
| Message pinning | Yes | No | No | Missing Both |
| Global search (server-side) | Yes | No | Yes (client-side) | Missing API |

---

## 3. MicroDin (LinkedIn)

**API Endpoints:** 5 GET, 5 POST mutations, 5 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Feed & Posts** |
| View feed with posts | Yes | Yes | Yes | None |
| Like a post | Yes | Yes | Yes | None |
| Comment on post | Yes | No | Yes (local only) | UI-only (no persist) |
| Share a post | Yes | No | Yes (local only) | UI-only (no persist) |
| Create / publish a post | Yes | No | Yes (composer) | Missing API |
| Save / bookmark post | Yes | No | Yes (UI) | Missing API |
| **Connections** |
| View pending connection requests | Yes | Yes | Yes | None |
| Accept / reject connection request | Yes | Yes | Yes | None |
| Send connection request | Yes | No | Yes (button) | Missing API |
| View my connections list | Yes | Yes | Yes | None |
| View mutual connections | Yes | Yes | Yes | None |
| Bulk accept all connections | Yes | Yes | No | Eval-only |
| **Profile** |
| View own / others' profiles | Yes | Yes | Yes | None |
| Profile fields (name, title, company, location, bio, experience, education, skills) | Yes | Yes | Yes | None |
| Edit profile sections | Yes | No | Yes (modal) | Missing API |
| **Messaging** |
| View conversations | Yes | Yes | Yes | None |
| Send a message | Yes | No | Yes (input) | Missing API |
| Mark conversation as read | Yes | Yes | Yes | None |
| Mark all messages read | Yes | Yes | No | Eval-only |
| **Jobs** |
| View job listings | Yes | Yes | Yes | None |
| View job detail | Yes | Yes | Yes | None |
| Apply to job | Yes | Yes | Yes | None |
| Save / bookmark job | Yes | No | Yes (UI) | Missing API |
| Bulk apply to all jobs | Yes | Yes | No | Eval-only |
| **Notifications** |
| View notifications (7 types) | Yes | Yes | Yes | None |
| Mark notification as read | Yes | Yes | Yes | None |
| Mark all notifications read | Yes | Yes | No | Eval-only |
| **Search** |
| Search people / posts / jobs | Yes | No | Yes (client-side) | Missing API |
| **Missing Features** |
| Endorsements / skills | Yes | No | No | Missing Both |
| Recommendations | Yes | No | No | Missing Both |
| Follow / unfollow people | Yes | No | No | Missing Both |
| Block / report user | Yes | No | No | Missing Both |
| Groups | Yes | No | Partial | Missing Both |
| Events | Yes | No | Partial | Missing Both |
| Company follow/unfollow | Yes | No | Yes | Missing API |

---

## 4. MicroFy (Spotify)

**API Endpoints:** 4 GET, 3 POST mutations, 5 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Playback** |
| Play song | Yes | Yes | Yes | None |
| Pause / skip / previous / seek | Yes | No | Yes (client-side) | Eval-only |
| Shuffle / repeat | Yes | No | Yes (client-side) | Eval-only |
| Volume control | Yes | No | Yes (slider) | Eval-only |
| Now playing bar | Yes | No | Yes | Eval-only |
| **Library** |
| Like / unlike track | Yes | Yes | Yes | None |
| Liked songs collection | Yes | Yes | Yes | None |
| Bulk like/unlike all | Yes | Yes | No | Eval-only |
| **Playlists** |
| Create playlist | Yes | Yes | Yes | None |
| Add track to playlist | Yes | Yes | Yes | None |
| View playlist | Yes | Yes | Yes | None |
| Remove track from playlist | Yes | No | No | Missing Both |
| Delete / rename playlist | Yes | No | No | Missing Both |
| Bulk delete all playlists | Yes | Yes | No | Eval-only |
| **Artists** |
| Artist page (info, popular tracks, discography) | Yes | Yes | Yes | None |
| Follow / unfollow artist | Yes | Yes | Yes | None |
| Related artists | Yes | Yes | Yes | None |
| Bulk follow/unfollow all | Yes | Yes | No | Eval-only |
| **Lyrics** |
| View lyrics (expand/collapse) | Yes | Yes | Yes | None |
| **Search** |
| Search songs / artists | Yes | No | Yes (client-side) | Missing API |
| **Missing Features** |
| Album page (as separate entity) | Yes | No | No | Missing Both |
| Queue management (add, reorder) | Yes | No | No | Missing Both |
| Podcasts / episodes | Yes | No | No | Missing Both |
| Collaborative playlists | Yes | No | No | Missing Both |
| Recently played (server-side) | Yes | No | Yes (client-side) | Missing API |
| Device selection / transfer | Yes | No | Yes (modal) | Missing API |
| Audio quality settings | Yes | No | No | Missing Both |

---

## 5. MicroGram (Instagram)

**API Endpoints:** 6 GET, 5 POST mutations, 5 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Feed** |
| Home feed with posts | Yes | Yes | Yes | None |
| Like / unlike post | Yes | Yes | Yes | None |
| Double-tap to like | Yes | Yes | Yes | None |
| Save / unsave post | Yes | Yes | Yes | None |
| Comment on post | Yes | Yes | Yes | None |
| Like count display | Yes | Yes | Yes | None |
| **Stories** |
| View stories | Yes | Yes | Yes | None |
| Story bar with avatars | Yes | Yes | Yes | None |
| Mark story viewed | Yes | Yes | Yes | None |
| Story auto-advance (5s) | Yes | No | Yes (client) | Eval-only |
| React / reply to story | Yes | No | No | Missing Both |
| Story highlights | Yes | No | No | Missing Both |
| **Profile** |
| View own / others' profiles | Yes | Yes | Yes | None |
| Bio, follower/following counts | Yes | Yes | Yes | None |
| Posts grid | Yes | Yes | Yes | None |
| Edit profile | Yes | No | Yes (modal) | Missing API |
| Verified badge | Yes | Yes | No | Missing UI |
| **Follow** |
| Follow / unfollow user | Yes | Yes | Yes | None |
| Bulk unfollow all | Yes | Yes | No | Eval-only |
| **Direct Messages** |
| View DM conversations | Yes | Yes | Yes | None |
| Send text message | Yes | No | Yes (input) | Missing API |
| Unread count badge | Yes | Yes | Yes | None |
| New DM creation | Yes | No | Yes (modal) | Missing API |
| **Activity / Notifications** |
| Like / comment / follow notifications | Yes | Yes | Yes | None |
| **Explore** |
| Explore / discover grid | Yes | Yes | Yes | None |
| Search users | Yes | Partial | Yes (client-side) | Eval-only |
| Search hashtags / locations | Yes | No | No | Missing Both |
| **Bulk Actions** |
| Unlike all / unsave all / unfollow all / delete comments / clear stories | Yes | Yes | No | Eval-only |
| **Missing Features** |
| Create post (upload, caption, tags) | Yes | No | No | Missing Both |
| Reels / video playback | Yes | Partial | Partial | Missing Both |
| Share post via DM | Yes | No | Yes (local only) | Missing API |
| Carousel posts | Yes | No | No | Missing Both |
| Mute / block / restrict user | Yes | No | No | Missing Both |
| Archive / delete post | Yes | No | No | Missing Both |

---

## 6. MicroHood (Robinhood)

**API Endpoints:** 4 GET, 2 POST mutations, 2 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Portfolio** |
| Portfolio overview (total value, gain/loss) | Yes | Yes | Yes | None |
| Portfolio chart (interactive, 7 timeframes) | Yes | Yes | Yes | None |
| Buying power / cash balance | Yes | Yes | Yes | None |
| **Trading** |
| Market order (buy/sell) | Yes | Yes | Yes | None |
| Limit order (buy/sell) | Yes | Yes | Yes | None |
| Order review before confirm | Yes | Yes | Yes | None |
| Order quantity input | Yes | Yes | Yes | None |
| **Positions** |
| Stock list / positions | Yes | Yes | Yes | None |
| Stock detail (price, stats, chart) | Yes | Yes | Yes | None |
| Current price (interpolated from traces) | Yes | Yes | Yes | None |
| **Watchlist** |
| Add / remove from watchlist | Yes | Yes | Yes | None |
| Watchlist display | Yes | Yes | Yes | None |
| **Search** |
| Stock search (by symbol / name) | Yes | Yes | Yes | None |
| **News** |
| News feed | Yes | Yes | Yes | None |
| **Bulk Actions** |
| Sell all positions | Yes | Yes | No | Eval-only |
| Clear watchlist | Yes | Yes | No | Eval-only |
| **Missing Features** |
| Order history / pending orders | Yes | No | UI-only (cosmetic) | Missing API |
| Cancel order | Yes | No | No | Missing Both |
| Price alerts | Yes | No | No | Missing Both |
| Deposit / withdraw funds | Yes | No | Yes (modal, local) | Missing API |
| Recurring investments | Yes | No | No | Missing Both |
| Dividends tracking | Yes | No | No | Missing Both |
| Crypto trading | Yes | No | Yes (nav, display only) | Missing API |
| Options trading | Yes | No | No | Missing Both |
| Earnings calendar | Yes | No | No | Missing Both |
| Notifications (server-side) | Yes | No | Yes (local mock) | Missing API |

---

## 7. MicroHub (GitHub)

**API Endpoints:** ~12 GET, ~8 POST mutations, 2 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Repository** |
| Repo page (README, metadata, topics) | Yes | Yes | Yes | None |
| Code browsing (file tree, file content) | Yes | Yes | Yes | None |
| Branch selection | Yes | Yes | Yes | None |
| Language breakdown | Yes | Yes | Yes | None |
| Star / unstar repo | Yes | Yes | Yes | None |
| Watch / unwatch repo | Yes | Yes | Yes | None |
| Fork repo | Yes | Yes | Yes | None |
| Clone URL (HTTPS) | Yes | Yes | Yes | None |
| **Issues** |
| Issue list (open/closed/all) | Yes | Yes | Yes | None |
| Create issue | Yes | Yes | Yes | None |
| Issue detail + commenting | Yes | Yes | Yes | None |
| Close issue | Yes | Yes | Yes | None |
| Reopen issue | Yes | Yes | No | Missing UI |
| Labels / assignees / milestones | Yes | Yes (data) | Display only | UI-only (no persist) |
| Bulk close all issues | Yes | Yes | No | Eval-only |
| **Pull Requests** |
| PR list (open/closed/merged) | Yes | Yes | Yes | None |
| Create PR | Yes | Yes | Yes | None |
| PR detail + commenting | Yes | Yes | Yes | None |
| Merge PR (multiple strategies) | Yes | Yes | Yes | None |
| PR review status / checks | Yes | Yes | Yes | None |
| PR diff view | Yes | No | No | Missing Both |
| Bulk merge all PRs | Yes | Yes | No | Eval-only |
| **Commits** |
| Commits list (by branch) | Yes | Yes | Yes | None |
| Commit detail / diff | Yes | No | No | Missing Both |
| **CI/CD** |
| Workflow runs list | Yes | Yes | Yes | None |
| Workflow run detail (jobs/steps) | Yes | Yes | Partial (no logs) | Missing UI |
| Re-run workflow | Yes | No | No | Missing Both |
| **Other** |
| Releases / tags | Yes | Yes | Yes | None |
| Wiki pages | Yes | Yes | Yes | None |
| Projects / boards | Yes | Yes | Yes | None |
| Security (Dependabot, code scanning) | Yes | Yes | Yes | None |
| User profile + follow | Yes | Yes | Yes | None |
| **Missing Features** |
| Search (code, issues, PRs) | Yes | No | No | Missing Both |
| Discussions | Yes | No | No | Missing Both |
| Branch management (create/delete) | Yes | No | No | Missing Both |
| Release creation | Yes | No | No | Missing Both |
| Wiki editing | Yes | No | No | Missing Both |
| SSH clone URL | Yes | No | No | Missing Both |

---

## 8. MicroLendar (Google Calendar)

**API Endpoints:** 2 GET, 5 POST mutations (CRUD), 3 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Views** |
| Month / week / day / schedule views | Yes | Yes | Yes | None |
| Year / 4-day views | No | Yes | Yes | Extra (fine) |
| Mini calendar sidebar | Yes | N/A | Yes | None |
| **Event CRUD** |
| Create event (title, date, time, location, description, color) | Yes | Yes | Yes | None |
| Edit event | Yes | Yes | Yes | None |
| Delete event | Yes | Yes | Yes | None |
| Drag to reschedule | Yes | Yes | Yes | None |
| **Attendees** |
| Display attendees (resolved names/avatars) | Yes | Yes | Yes | None |
| Add / edit attendees on event | Yes | No | No | Missing Both |
| RSVP (accept/maybe/decline) | Yes | No | Yes (cosmetic) | Missing API |
| **Tasks** |
| Create task (title, due date) | Yes | Yes | Yes | None |
| Complete / toggle task | Yes | Yes | Yes | None |
| Delete task | Yes | Yes | Yes | None |
| **Calendar Management** |
| Multiple calendars (show/hide, colors) | Yes | No | Yes (client filter) | UI-only |
| **Bulk Actions** |
| Delete all events / complete all tasks / delete all tasks | N/A | Yes | No | Eval-only |
| **Missing Features** |
| Recurring events | Yes | No | Form field (unused) | Missing API |
| All-day events | Yes | No | No | Missing Both |
| Resize event to change duration | Yes | No | No | Missing Both |
| Reminders / notification delivery | Yes | No | Yes (form) | Missing API |
| Time zones | Yes | No | No | Missing Both |
| Calendar sharing | Yes | No | No | Missing Both |
| Working hours / out of office | Yes | No | No | Missing Both |
| Quick add (natural language) | Yes | No | No | Missing Both |
| Search events (server-side) | Yes | No | Yes (client-side) | Missing API |
| Settings persistence | Yes | No | Yes (modal, 10+ options) | Missing API |

---

## 9. MicroScholar (Google Scholar)

**API Endpoints:** 3 GET, 3 POST mutations, 3 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Search** |
| Simple text search | Yes | Yes | Yes | None |
| Advanced search (7 fields) | Yes | Yes | Yes | None |
| Search result sorting (relevance/date/citations) | Yes | No | Yes (client-side) | Eval-only |
| **Results** |
| Paper display (title, authors, snippet, year, citations, source) | Yes | Yes | Yes | None |
| PDF link | Yes | Yes | Yes (link, no actual PDF) | Eval-only |
| **Citing** |
| Cite paper (MLA, APA, Chicago, Harvard, Vancouver) | Yes | Yes | Yes | None |
| Export BibTeX | Yes | Partial | Yes (copy) | UI-only |
| **Library** |
| Save / unsave paper | Yes | Yes | Yes | None |
| View saved papers | Yes | Yes | Yes | None |
| Clear all saved papers | Yes | Yes | Yes | None |
| Create labels / collections | Partial | No | Yes (local) | Missing API |
| **Alerts** |
| View alerts (citation, new_paper, keyword) | Yes | Yes | Yes | None |
| Mark alert as read | Yes | Yes | Yes | None |
| Mark all alerts read | Yes | Yes | Yes | None |
| Create / delete alert | Yes | No | Yes (form, no submit) | Missing API |
| **Author Profiles** |
| Author page (papers, citations, h-index, i10-index, affiliation) | Yes | Yes | Yes | None |
| Coauthors list | Yes | Yes | Yes | None |
| Author verification / homepage / ORCID | Yes | Yes (data) | No | Missing UI |
| Edit profile | Partial | No | Yes (modal) | Missing API |
| Follow author | Yes | No | No | Missing Both |
| **Missing Features** |
| Cited-by list (papers citing this one) | Yes | Count only | Count only | Missing API |
| Paper versions (different sources) | Yes | No | No | Missing Both |
| Citation graph (real data) | Partial | No | Placeholder | Missing Both |

---

## 10. MicroTube (YouTube)

**API Endpoints:** 5 GET, 7 POST mutations, 5 bulk actions

| Feature | Real Product | Our API | Our UI | Gap |
|---------|:---:|:---:|:---:|-----|
| **Feed & Discovery** |
| Home feed | Yes | Yes | Yes | None |
| Search videos | Yes | No | Yes (client-side) | Missing API |
| Trending / categories | Yes | No | Yes (nav items) | Eval-only |
| **Video Player** |
| Play / pause / seek | Yes | Yes | Yes (HTML5 video) | None |
| Fullscreen / theater mode | Yes | No | Yes (client) | Eval-only |
| Volume / mute | Yes | No | Yes (client) | Eval-only |
| Playback speed | Yes | No | Yes (menu) | UI-only |
| Quality selection | Yes | No | Yes (menu) | UI-only |
| Subtitles / CC toggle | Yes | No | Yes (button) | UI-only |
| **Video Interactions** |
| Like / dislike video | Yes | Yes | Yes | None |
| Save video (watch later) | Yes | Yes | Yes | None |
| Mark as watched | Yes | Yes | Yes | None |
| Share video | Yes | No | Yes (modal) | UI-only |
| Video description expand/collapse | Yes | Yes | Yes | None |
| Related / suggested videos | Yes | No | Yes (sidebar) | Eval-only |
| **Channels** |
| Subscribe / unsubscribe | Yes | Yes | Yes | None |
| Channel page (videos, playlists, community, about) | Yes | Yes | Yes | None |
| Channel info (subscribers, verification) | Yes | Yes | Yes | None |
| **Comments** |
| View comments | Yes | Yes | Yes | None |
| Post comment | Yes | Yes | Yes | None |
| Reply to comment | Yes | Yes | Yes | None |
| Like / dislike comment | Yes | No | Yes (client) | UI-only |
| **Playlists** |
| Create playlist | Yes | Yes | Yes | None |
| Add video to playlist | Yes | Yes | Yes | None |
| View playlists | Yes | Yes | Yes | None |
| Remove video from playlist | Yes | No | No | Missing Both |
| **Notifications** |
| View notifications (upload, live, comment, mention) | Yes | Yes | Yes | None |
| Mark as read / dismiss | Yes | Yes | Yes | None |
| **Shorts** |
| Browse shorts feed | Yes | Yes (isShort filter) | Yes | None |
| Play shorts (vertical layout) | Yes | Yes | Yes | None |
| Like / comment on shorts | Yes | Yes | Yes | None |
| Navigate shorts (up/down) | Yes | No | Yes (keys) | Eval-only |
| **Bulk Actions** |
| Unsubscribe channel / unlike video / add to playlist / post comment / clear notifications | N/A | Yes | No | Eval-only |
| **Missing Features** |
| Remove from playlist | Yes | No | No | Missing Both |
| Upload video (persistent) | Yes | No | Yes (modal) | Missing API |
| Picture-in-picture / mini player | Yes | No | No | Missing Both |
| Chapters / timestamps | Yes | No | No | Missing Both |
| Live chat | Yes | No | No | Missing Both |
| Creator studio / analytics | Yes | No | No | Missing Both |

---

## Summary by Environment

| Environment | None | Missing API | Missing UI | Missing Both | Eval-only | UI-only |
|-------------|:----:|:----------:|:----------:|:------------:|:---------:|:-------:|
| MicroMail | 18 | 5 | 1 | 10 | 0 | 0 |
| MicroChat | 14 | 7 | 2 | 6 | 0 | 3 |
| MicroDin | 16 | 6 | 0 | 6 | 4 | 2 |
| MicroFy | 12 | 3 | 0 | 7 | 9 | 0 |
| MicroGram | 16 | 4 | 1 | 8 | 4 | 1 |
| MicroHood | 13 | 4 | 0 | 7 | 2 | 0 |
| MicroHub | 22 | 0 | 2 | 9 | 3 | 1 |
| MicroLendar | 12 | 4 | 0 | 7 | 1 | 1 |
| MicroScholar | 15 | 3 | 1 | 3 | 3 | 1 |
| MicroTube | 20 | 2 | 0 | 5 | 7 | 5 |

## Top Priority Gaps (Missing API — UI exists but doesn't persist)

These are the most impactful to fix: users see a working button but clicks don't actually do anything server-side.

1. **MicroMail** — Compose / Reply / Forward / Save Draft (4 endpoints)
2. **MicroChat** — Send / Edit / Delete message (3 endpoints)
3. **MicroDin** — Send message, Create post, Send connection request (3 endpoints)
4. **MicroGram** — Send DM, New DM creation (2 endpoints)
5. **MicroFy** — Search (server-side) (1 endpoint)
6. **MicroHood** — Deposit/withdraw, Order history (2 endpoints)
7. **MicroLendar** — Recurring events, RSVP, Settings persistence (3 endpoints)
8. **MicroScholar** — Create/delete alert, Edit profile (2 endpoints)
9. **MicroTube** — Search (server-side), Upload video (2 endpoints)

---

# ========== ORIGINAL FILE: AUDIT_PROMPTS.md ==========

# Sentinel Environments Pre-Release Audit Prompts

Paste each prompt into a fresh Claude Code session (from the `sentinel_environments` directory).
Each targets a different area for maximum depth without context window overlap.

---

## PROMPT 1: Backend State Merging & API Response Integrity

```
I'm auditing the Sentinel Environments project before public release. The backend (server/) is the source of truth -- the frontend just polls it.

CRITICAL KNOWN ISSUE: The backend handlers store mutable state (isLiked, isRead, isSaved, isViewed, isSubscribed, userPlayCount, etc.) in session.*_states dicts, but the GET endpoints in server.py may not merge this state back into the JSON responses. Frontend TypeScript types expect these fields to be present.

Your task:
1. Read server/server.py FULLY -- find every GET /data/* endpoint
2. For EACH endpoint, trace the code path: does it call the handler's build_*_row() AND then merge session state into the response?
3. Read every handler in server/handlers/ -- identify which state fields each handler tracks
4. Read every frontend hook in frontend/src/hooks/ -- identify which fields the TypeScript types expect
5. For EACH environment, produce a table:
   - Backend state fields tracked
   - Whether server.py merges them into response
   - Frontend fields expected
   - VERDICT: MATCH / MISMATCH / MISSING

Also check: Does the frontend apply "optimistic UI overrides" (local state overlays) that might mask this issue? If so, which environments use optimistic overrides and which don't?

Finally: If state IS being merged somewhere I missed (middleware, response hooks, schema serialization), identify exactly where. I need to know definitively whether this is a real bug or handled elsewhere.
```

---

## PROMPT 2: Eval SQL Correctness & Scenario Completeness

```
I'm auditing Sentinel Environments eval_sql queries and scenario coverage before public release.

KNOWN ISSUE: microhub-browse-absolute-passive.json has eval_sql "SELECT (SELECT 1) >= 1" which always passes.

Your task -- be exhaustive:

PART A: EVAL SQL AUDIT
1. Read EVERY scenario JSON file under server/*/scenarios/*.json (there are 56 total)
2. For each scenario, extract the eval_sql query
3. Read server/scripts/build_db.py to understand the database schema for each environment
4. For each eval_sql:
   - Does it reference tables/columns that actually exist in the DB schema?
   - Is the query logically sound (could it ever return a meaningful pass/fail)?
   - Are there tautologies (always-true) or contradictions (always-false)?
   - Does the threshold make sense given the scenario's events?
5. Read tests/test_eval_sql.py -- check the NEEDS_USER_ACTION and NEGATIVE_EXEMPT sets. Are they correct?

PART B: SCENARIO COVERAGE GAPS
1. For each environment, list all task types and which timing/mode combinations exist
2. The naming pattern is {env}-{task}-{timing}-{mode}.json where timing is absolute|relative and mode is active|passive
3. Micromail has complete 4-way coverage. For all other environments, list exactly what's missing.
4. For each missing combination, assess: Is it impossible to define (e.g., relative timing doesn't make sense for this task)? Or is it simply not written yet?
5. Check if any handler supports event types that NO scenario uses. List them.

PART C: EVENT-TO-HANDLER ALIGNMENT
1. For each scenario, list every event type in its events array
2. Cross-reference with the handler -- does the handler have a code path for every event type?
3. Are there event payloads that reference catalog IDs? Verify those IDs exist in the corresponding JSONL/DB.

Produce a comprehensive spreadsheet-style report.
```

---

## PROMPT 3: Frontend-Backend Endpoint & Type Contract Audit

```
I'm auditing Sentinel Environments for data contract consistency before public release.

Architecture: Backend (Python/FastAPI in server/) serves data endpoints. Frontend (React/TypeScript in frontend/) polls those endpoints. Backend is source of truth.

Your task:

PART A: ENDPOINT MAPPING
1. Read server/server.py -- extract EVERY endpoint (method, path, handler function, response schema)
2. Read server/schemas.py -- extract every Pydantic response model and its fields
3. Read every frontend hook in frontend/src/hooks/ -- extract every fetch URL and the TypeScript interface it maps to
4. Produce a mapping: Frontend URL → Backend endpoint → Pydantic schema → TypeScript type
5. Flag any URL the frontend fetches that the backend doesn't serve, or vice versa

PART B: FIELD-LEVEL TYPE COMPARISON
For each environment's data types:
1. Extract the Pydantic model fields (names + types)
2. Extract the TypeScript interface fields (names + types)
3. Compare field-by-field:
   - Name mismatches (snake_case vs camelCase issues?)
   - Type mismatches (string vs number, optional vs required)
   - Extra fields in frontend not sent by backend
   - Extra fields from backend not declared in frontend

PART C: ACTION ENDPOINTS
1. Identify all POST/PUT/DELETE endpoints in server.py
2. For each, find the frontend code that calls it (grep for fetch/axios calls with matching URLs)
3. Verify the request body shape matches what the backend expects
4. Check error handling -- does the frontend handle 409 (no session), 404, etc.?

PART D: CONFIG ENDPOINT
1. Read the /data/config endpoint in server.py
2. Read how each hook consumes it (they all fetch /api/data/config first)
3. Verify the config response shape matches what hooks expect
4. Check the environment mismatch detection logic in each hook
```

---

## PROMPT 4: Asset Pipeline & Data Integrity

```
I'm auditing Sentinel Environments data pipeline integrity before public release.

KNOWN ISSUES:
- ~132 missing org image files (images/orgs/org-*.webp) referenced in entities.json
- MICROGRAM_SUGGESTIONS_CATALOG declared in build_db.py but not loaded in catalogs.py

Your task:

PART A: IMAGE/MEDIA ASSET AUDIT
1. Read data/catalogs/entities.json -- extract every avatarUrl and bannerUrl
2. Read data/catalogs/users.json -- extract every avatar URL
3. Grep ALL source code (handlers, frontend components, JSONL catalogs) for image path references
4. List every referenced image/media path
5. Check if each file actually exists in data/public/
6. Produce a report: referenced_path → exists (yes/no) → referenced_by (which files)

PART B: CATALOG COMPLETENESS
1. Read server/catalogs.py -- list every catalog dict that gets populated
2. Read server/scripts/build_db.py -- list every table created and JSONL file loaded
3. Cross-reference: is there a catalog dict for every DB table? Is there a DB table for every JSONL?
4. Check for orphaned data (built but never loaded) or missing data (loaded but never built)
5. Specifically verify microgram suggestions: is the table populated? Is the data accessible?

PART C: CROSS-ENVIRONMENT ID REFERENCES
1. Scenario events reference catalog IDs in their payloads (e.g., email_ids, track_ids, post_ids)
2. For EACH scenario, extract payload IDs
3. Verify each ID exists in the corresponding catalog JSONL file
4. Check: could a scenario reference an ID that build_db.py doesn't import?

PART D: DATABASE SCHEMA VALIDATION
1. Read the DDL in build_db.py for every table
2. Read how catalogs.py loads data from those tables
3. Verify column names match between DDL, catalog loading, and handler consumption
4. Check for any columns defined in DDL that are never read, or columns read that aren't in DDL
```

---

## PROMPT 5: Test Coverage & Harness Gaps

```
I'm auditing Sentinel Environments test infrastructure before public release.

KNOWN GAPS:
- Only MicroMail has an E2E Playwright test
- ~10 server endpoints have zero test coverage
- run_simulation.py is a manual harness, NOT the agent evaluation harness

Your task:

PART A: INTEGRATION TEST COVERAGE MATRIX
1. Read tests/test_integration.py completely
2. Read server/server.py to get the full endpoint list
3. Create a matrix: every server endpoint × whether test_integration.py tests it
4. For untested endpoints, assess risk: is this a critical path or a secondary feature?

PART B: EVAL SQL TEST ANALYSIS
1. Read tests/test_eval_sql.py completely
2. For each scenario it tests:
   - What user actions does it simulate?
   - Does the simulated action match what the scenario's prompt asks the user to do?
   - Could the test pass for wrong reasons (e.g., always-true eval_sql)?
3. Check the NEEDS_USER_ACTION set -- are any scenarios missing that should require actions?
4. Check NEGATIVE_EXEMPT -- verify each exemption is justified

PART C: FRONTEND WIRING TEST ANALYSIS
1. Read tests/test_frontend_wiring.py
2. Evaluate each check:
   - Is it still relevant given current architecture?
   - Are there new anti-patterns it should check for but doesn't?
3. Suggest additional static analysis checks for pre-release

PART D: E2E TEST GAP ANALYSIS
1. Read tests/micromail-e2e.spec.ts
2. For each of the 9 untested environments, describe:
   - What would a minimal E2E test look like?
   - What unique UI interactions does this environment have?
   - Priority ranking for adding E2E tests

PART E: SIMULATION HARNESS REVIEW
1. Read server/run_simulation.py
2. Does it test all 10 environments?
3. Does it handle error cases (network failure, bad scenario ID, etc.)?
4. What's missing for it to become a proper agent evaluation harness?
5. Is there any scoring/grading infrastructure? If not, what would be needed?
```

---

## PROMPT 6: Security, Deployment & Release Readiness

```
I'm auditing Sentinel Environments for security and deployment readiness before public release.

Your task:

PART A: SECURITY AUDIT
1. Read server/server.py -- check for:
   - SQL injection vectors (especially eval_sql execution)
   - Path traversal in image/file serving endpoints
   - CORS configuration
   - Session management vulnerabilities
   - Input validation gaps
2. Read SECURITY.md
3. Check if eval_sql queries from scenarios are executed safely (parameterized? sandboxed?)
4. Check the /data/images/ endpoint for directory traversal
5. Grep for any hardcoded secrets, API keys, or credentials in the codebase

PART B: DEPLOYMENT CONFIGURATION
1. Read frontend/vercel.json -- is the SPA rewrite correct?
2. Read frontend/wrangler.toml -- are Cloudflare bindings correct?
3. Read frontend/vite.config.ts -- is the proxy correct? Is publicDir correct?
4. Read frontend/package.json -- are all required dependencies listed? Any vulnerable versions?
5. Check if .gitignore properly excludes sensitive files (.env, .db, credentials)
6. Read .gitattributes -- are LFS patterns correctly tracking large files?

PART C: README & DOCUMENTATION
1. Read README.md -- does the setup guide work?
   - Are the build steps correct? (pip install, build_db.py, npm install, dev servers)
   - Are there missing steps?
2. Read data_generation/README.md, docs/COMPLIANCE.md, docs/REPRODUCTION.md
3. Is the license file (LICENSE) present and appropriate for public release?

PART D: RELEASE CHECKLIST
1. Are there any TODO/FIXME/HACK/XXX comments in the codebase?
2. Are there any console.log or print() debug statements that should be removed?
3. Are there any development-only features exposed in production? (e.g., admin panels, debug routes)
4. Check for any references to internal/private infrastructure (internal URLs, private repos, team names)
5. Check the dist/ folder -- should it be in git or gitignored? Is the built bundle up to date?
```

---

# ========== ORIGINAL FILE: AUDIT_RUNBOOK.md ==========

# Audit Runbook

Run Playwright visual audits for each environment. Each test initializes a scenario, advances all events, then exercises the full UI with screenshots.

## Prerequisites

Start both servers (in separate terminals or via tmux):

```bash
# Terminal 1 — API server
cd /home/user/projects/SentinelMigration/sentinel_environments
.venv/bin/uvicorn server.server:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend dev server
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend
npm run dev
```

Or use the tmux launcher:

```bash
cd /home/user/projects/SentinelMigration/sentinel_environments && ./start.sh
```

Wait for both servers to be ready before running tests.

---

## Run All Audits

```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/*-audit.spec.ts --reporter=list
```

---

## Run Individual Audits

### MicroMail (Outlook-like)
Scenario: `scenarios/micromail/inbox-relative-passive.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/micromail-audit.spec.ts --reporter=list
```

### MicroChat (Teams/Slack-like)
Scenario: `scenarios/microchat/unread-absolute-active.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microchat-audit.spec.ts --reporter=list
```

### MicroDin (LinkedIn-like)
Scenario: `scenarios/microdin/connections-absolute-passive.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microdin-audit.spec.ts --reporter=list
```

### MicroFy (Spotify-like)
Scenario: `scenarios/microfy/plays-absolute-passive.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microfy-audit.spec.ts --reporter=list
```

### MicroGram (Instagram-like)
Scenario: `scenarios/microgram/likes-absolute-passive.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microgram-audit.spec.ts --reporter=list
```

### MicroHood (Robinhood-like)
Scenario: `scenarios/microhood/orders-absolute-active.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microhood-audit.spec.ts --reporter=list
```

### MicroHub (GitHub-like)
Scenario: `scenarios/microhub/browse-absolute-passive.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microhub-audit.spec.ts --reporter=list
```

### MicroLendar (Google Calendar-like)
Scenario: `scenarios/microlendar/events-absolute-passive.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microlendar-audit.spec.ts --reporter=list
```

### MicroScholar (Google Scholar-like)
Scenario: `scenarios/microscholar/alert-absolute-passive.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microscholar-audit.spec.ts --reporter=list
```

### MicroTube (YouTube-like)
Scenario: `scenarios/microtube/notifications-absolute-active.json`
```bash
cd /home/user/projects/SentinelMigration/sentinel_environments/frontend && npx playwright test tests/microtube-audit.spec.ts --reporter=list
```

---

## Screenshots

Each audit saves screenshots to:
```
.cache/audit_screenshots/<env>/
```

For example, MicroMail screenshots land in `.cache/audit_screenshots/micromail/`.

## Tips

- Tests run headless by default. Add `--headed` to watch the browser.
- Add `--timeout=120000` if tests are timing out on slow machines.
- To debug a single test: `npx playwright test tests/micromail-audit.spec.ts -g "inbox list" --headed`
- Each test file re-initializes the scenario in `beforeAll`, so they can run independently in any order.

---

# ========== ORIGINAL FILE: PR_PLAN.md ==========

# PR Prep Plan — `cleaning-files` branch

Living checklist for the week. Working top-to-bottom; commit after each chunk.

## Done

- **Chunk A — scenarios moved to repo root** (WebArena-style)
  - `server/<env>/scenarios/*.json` → `scenarios/<env>/*.json` (42 files, `git mv` so history preserved)
  - Updated `server/server.py` `_SCENARIO_DIRS`, `server/eval_harness.py` `discover_tasks()`, `tests/test_eval_sql.py` `discover_scenarios()`, 11 frontend test specs, `README.md`, `server/run_simulation.py` example
  - `dev/` kept under `scenarios/`

- **Self-user backend-first refactor**
  - New canonical `frontend/src/types/selfUser.ts` — single `ApiSelfUser` interface matching the backend payload from `/api/data/config`
  - All 10 hooks (`useMicro*Data.ts`) now import it; deleted 7 narrow inline types + 2 duplicate local `ApiSelfUser` definitions
  - Deleted `deriveMicrofyHandle`, `deriveMicrohubUsername`, `deriveChatUsername`, inline `derivedUsername` blocks, `${username}@microchat.com` fake-email synthesis, `{name.toLowerCase().replace(' ','.')}@email.com` in MicroDin
  - Widened `Person` type in MicroDin to include `username?`/`email?`; `convertUserToPerson` maps them through
  - Principle: raw truth from backend; frontend fallbacks only as null-safe placeholders during loading

- **Backend naming cleanup** — `scholar` → `microscholar`, `social` → `microgram`
  - `data/catalogs/users.json` (25 scholar + 15 social blocks)
  - `server/server.py` (`/data/microgram-users`, `/data/microscholar-users` filters)
  - `server/handlers/microscholar.py` (author-details lookup)
  - `frontend/src/types/selfUser.ts` (`ScholarProfile` → `MicroscholarProfile`, `SocialProfile` → `MicrogramProfile`, field renames)
  - Hooks: `useMicroscholarData.ts`, `useMicrogramData.ts`, `useMicrodinData.ts` (ApiDinUser `scholar?` → `microscholar?`)
  - `frontend/src/environments/MicroScholar.tsx`, `MicroGram.tsx`, `MicroDin.tsx` — attribute accesses
  - Verified: `tsc --noEmit` clean, `pytest tests/` 14 pass

- **Chunk B — `audit_screenshots/` moved to `.cache/`**
  - `server/audit_screenshots/` (50MB, 0 tracked files) → `.cache/audit_screenshots/`
  - `.gitignore`: removed `audit_screenshots/` rule (redundant; `.cache/` already ignored)
  - 10 spec files `frontend/tests/*-audit.spec.ts` — `../server/audit_screenshots/<env>` → `../.cache/audit_screenshots/<env>`
  - `AUDIT_RUNBOOK.md` lines 105, 108 updated

- **Chunk C — drop env prefix from scenario filenames**
  - 32 scenario files renamed via `git mv`: `scenarios/<env>/<env>-<rest>.json` → `scenarios/<env>/<rest>.json` (e.g. `micromail/micromail-inbox-relative-passive.json` → `micromail/inbox-relative-passive.json`)
  - Scenario `id` field inside each JSON kept env-prefixed (`micromail-inbox-relative-passive`) — loader reads `id` from JSON content, not filename
  - Updated 11 Playwright spec `SCENARIO_PATH` constants (10 `*-audit.spec.ts` + `micromail-e2e.spec.ts`)
  - Updated `server/run_simulation.py` example path
  - Updated 10 `AUDIT_RUNBOOK.md` scenario references
  - NN-numbering scheme deferred — current flat naming makes gap analysis against the 8-per-env matrix easier
  - Verified: pytest 14/14, `tests/test_eval_sql.py` 32/32 positive + 32/32 negative, 11 spec `SCENARIO_PATH` refs resolve

- **Chunk D — lint/scripts/README hygiene**
  - `frontend/eslint.config.js` — added `tests/**/*.spec.ts` to `ignores` (Playwright specs, not app code)
  - `frontend/package.json` — removed 8 ghost scripts pointing at non-existent files: `check:exports`, `check:types`, `health-check`, `validate`, `test:all`, `test:security`, `test:integration`, `test:unit`
  - `README.md` — removed Vercel Website badge (link was to old deployment)

- **Chunk E — README rewrite for 8-per-env**
  - Dropped "20 task variants" / "5×2×2" framing; replaced with 8-per-env target (`4 cells × 2 targets per cell = 8 scenarios per env`, `80 total when fully populated`)
  - Rewrote Task Dimensions table: removed "Task Type (5 per environment)"; kept Criteria and Activity; added explicit list of the four cells with micromail example
  - Rewrote Example Scenario: concrete `junk-relative-passive` with real eval_sql, added explicit field-by-field docs for `condition_at` / `duration` / `events` / `eval_sql`
  - Durations section updated to mention both `condition_at` and `duration` (previously only "duration")
  - Dataset Splits table: columns renamed `Configurations` → `Scenarios`, numbers updated to 56/16/8 (7+2+1 envs × 8 scenarios each)
  - Example run output updated: `Found 56 tasks` → `Found 32 tasks`; scenario IDs updated to real post-rename names
  - Repository Structure tree rebuilt: added `scenarios/`, `data/catalogs/`, fixed missing `frontend/src/data/` (doesn't exist), clarified `server/<env>/` only has `.db` files now
  - Fixed stale `frontend/src/data/content/` reference in Synthetic Data section → `data/catalogs/<env>/`

- **Chunk F — test_integration pytest hygiene**
  - `scenarios/microscholar/search-absolute-active.json`: verified prompt already aligns with `eval_sql` (`isCited=1`) — active prompt says "cite it for me"; stale PR_PLAN instruction removed. `tests/test_eval_sql.py` confirms scenario passes.
  - `tests/test_integration.py`: converted 14 `return t` → `assert t.passed, t.report()` (eliminates `PytestReturnNotNoneWarning`); renamed `TestResult` → `IntegrationResult` (pytest was trying to collect it); removed broken `main()` / `__main__` block (referenced undefined `test_actions`).
  - Assertions surfaced pre-existing test drift vs. current scenarios — fixed in-scope:
    - `test_micromail`: advance time `120` → `scenario["duration"]`; expected email count now `len(scenario["events"])` instead of hard-coded `15`.
    - `test_microchat`: reordered to advance+evaluate BEFORE mutations (mark-as-read was reducing unread count below eval threshold).
    - `test_microscholar`: relaxed alerts assertion from `count > 0` to structure-only (`microscholar-search-absolute-passive` scenario doesn't preload alerts).
  - Verified: all 14 integration tests pass; `tests/test_eval_sql.py` 32 scenarios PASS.

- **Chunk G — CI workflow**
  - `.github/workflows/ci.yml` — two parallel jobs on push + PR to main, with heavy inline comments explaining how to extend.
  - `backend` job: setup-python 3.12 → install `server/requirements.txt` + pytest → build SQLite catalogs (`python -m server.scripts.build_db`) → run `tests/test_frontend_wiring.py` (static, fails fast) → boot `uvicorn` in background → poll `/status` for up to 30s → run `pytest tests/test_integration.py -v` → run `python tests/test_eval_sql.py` → stop server (always) → upload `server.log` on failure.
  - `frontend` job: setup-node 20 → `npm ci` → `npm run lint` → `npx tsc --noEmit --skipLibCheck` → `npm run build` (Vite prod). `defaults.run.working-directory: frontend` so steps don't repeat `cd frontend`.
  - `concurrency.cancel-in-progress: true` so rapidly-updated PRs don't queue redundant runs.
  - Playwright specs (`frontend/tests/*-audit.spec.ts`) deliberately excluded — they need both a live API and frontend, and belong in a dedicated e2e workflow later.
  - Verified locally: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `python tests/test_frontend_wiring.py` (44/44) all pass.

## Todo — remaining chunks

### Chunk H — fictional brand/institution scrub
Platforms are fake (`micromail`, `microgram`, ...) but seed content leaks real brands/institutions. Before publishing this will draw trademark complaints and contaminate LLM evals (models carry priors about real orgs).

Scope — one sweep across catalogs:
- `data/catalogs/users.json` — 24 scholar affiliations (Stanford, Berkeley, MIT, Cambridge, ETH Zurich, KAIST, ...) + 24 institutional email domains (`stanford.edu`, `berkeley.edu`, `mit.edu`, `ox.ac.uk`, ...) → fictional-but-plausible (e.g., "Westwood University" / `westwood.edu`, "Highland Institute of Technology" / `highland.edu`, "Aurora Research Labs" / `aurora.ai`)
- `data/catalogs/entities.json` — Stanford×2, Berkeley×2, MIT, Harvard, Princeton×2
- `data/catalogs/microscholar/papers.jsonl` — "Meta"×2 in titles/authors
- `data/catalogs/microhub/` — `issues.jsonl` (Google×3), `files.jsonl` (Google×3), `wiki.jsonl` (MIT), `repository.jsonl` (MIT), `insights.jsonl` (Google, Twitter)
- `data/catalogs/microtube/videos.jsonl` — Tesla reference

Keep deterministic: one fictional name per real org, apply globally (Stanford→Westwood everywhere). After sweep, rebuild `server/shared.db` via `.venv/bin/python -c "from server.scripts.build_db import build_shared_db; build_shared_db()"` (shared.db is gitignored; users.json edits only land via rebuild). Add a `data/catalogs/README.md` convention note: "no real brand/institution names; keep the sandboxed world consistent."

## Principles

- Commit after each chunk; user reviews before next chunk begins.
- No destructive git ops without explicit ask.
- Backend is source of truth for user data; frontend only displays / provides null-safe placeholders.
- Don't revert unrelated modifications in the worktree while working through these.

---

# ========== ORIGINAL FILE: RENAME_PROMPT.md ==========

# Directory Rename Task

Rename two top-level directories in this repo:

- `sentinel_api/` -> `server/`
- `sentinelbench/` -> `frontend/`

This is a Python package rename + frontend directory rename. Every reference must be updated atomically so nothing breaks. Do NOT change any logic -- this is purely a rename/find-replace.

## Step 1: Git move the directories

```
git mv sentinel_api server
git mv sentinelbench frontend
```

## Step 2: Fix Python imports (`sentinel_api` -> `server`)

Every `from sentinel_api.` and `import sentinel_api.` must become `from server.` / `import server.`.

Files with Python imports to fix (all under `server/` after the move):
- `server/server.py` -- ~13 import lines (`from sentinel_api.catalogs`, `from sentinel_api.handlers`, `from sentinel_api.schemas`, `from sentinel_api.session`)
- `server/handlers/micromail.py` -- 2 imports
- `server/handlers/microchat.py` -- 2 imports
- `server/handlers/microdin.py` -- 2 imports
- `server/handlers/microfy.py` -- 2 imports
- `server/handlers/microgram.py` -- 2 imports
- `server/handlers/microhood.py` -- 2 imports
- `server/handlers/microhub.py` -- 2 imports
- `server/handlers/microlendar.py` -- 2 imports
- `server/handlers/microscholar.py` -- 2 imports
- `server/handlers/microtube.py` -- 2 imports

## Step 3: Fix Python module references (`sentinel_api.xxx` in strings/commands)

These are `python -m sentinel_api.*` and `uvicorn sentinel_api.server:app` references:

- `server/server.py` -- `uvicorn.run("sentinel_api.server:app", ...)` -> `"server.server:app"`
- `server/eval_harness.py` -- comment: `python -m sentinel_api.eval_harness` -> `python -m server.eval_harness`
- `server/run_simulation.py` -- comment: `python -m sentinel_api.run_simulation` -> `python -m server.run_simulation`
- `README.md` -- multiple `uvicorn sentinel_api.server:app` and `python -m sentinel_api.*` commands (~6 occurrences)
- `frontend/package.json` -- `"dev:api"` script: `sentinel_api.server:app` -> `server.server:app`, also update `--app-dir` if needed
- `start.sh` -- uvicorn command and eval_harness comment (~2 lines)
- `tests/test_eval_sql.py` -- line with `uvicorn sentinel_api.server:app` in a print statement

## Step 4: Fix path references to `sentinel_api/`

These are filesystem paths in code and docs:

- `server/scripts/build_db.py` -- `API_DIR = ROOT / "sentinel_api"` -> `ROOT / "server"`, plus 3 comment lines mentioning `sentinel_api/`
- `server/server.py` -- comment mentioning "Docker sentinel_api"
- `tests/test_eval_sql.py` -- `Path("sentinel_api")` -> `Path("server")`
- `README.md` -- path references like `sentinel_api/<env>/scenarios/`, `sentinel_api/requirements.txt`, repository structure tree (~5 occurrences)
- `frontend/README.md` -- mentions `sentinel_api/` in description
- `AUDIT_PROMPTS.md` -- ~9 references to `sentinel_api/` paths throughout

## Step 5: Fix path references to `sentinelbench/`

- `README.md` -- `cd sentinelbench` -> `cd frontend`, repository structure tree, data path reference (~4 occurrences)
- `.gitignore` -- comment on line 182 and exception rule `!sentinelbench/public/**` -> `!frontend/public/**`
- `start.sh` -- `$ROOT/sentinelbench` -> `$ROOT/frontend`
- `tests/test_frontend_wiring.py` -- `Path("sentinelbench/src")` -> `Path("frontend/src")`
- `AUDIT_PROMPTS.md` -- ~7 references to `sentinelbench/` paths
- `frontend/package-lock.json` -- `"name": "sentinelbench"` entries (or just delete and regenerate with `cd frontend && npm install`)

## Step 6: Fix frontend test paths

These TypeScript test files reference `../sentinel_api/`:
- `frontend/tests/microfy-audit.spec.ts` -- `../sentinel_api/` -> `../server/` (2 lines: SCENARIO_PATH and SCREENSHOTS)
- `frontend/tests/micromail-audit.spec.ts` -- `../sentinel_api/` -> `../server/` (2 lines)
- `frontend/tests/micromail-e2e.spec.ts` -- `../sentinel_api/` -> `../server/` (2 lines)

## Step 7: Fix frontend environment components

All 10 Micro* TSX files have "no scenario initialized" help text showing `uvicorn sentinel_api.server:app` and `python -m sentinel_api.run_simulation` commands. Update all to use `server.server:app` and `server.run_simulation`:

- `frontend/src/environments/MicroMail.tsx` (2 lines)
- `frontend/src/environments/MicroChat.tsx` (2 lines)
- `frontend/src/environments/MicroDin.tsx` (2 lines)
- `frontend/src/environments/MicroFy.tsx` (2 lines)
- `frontend/src/environments/MicroGram.tsx` (2 lines)
- `frontend/src/environments/MicroHood.tsx` (2 lines)
- `frontend/src/environments/MicroHub.tsx` (2 lines)
- `frontend/src/environments/MicroLendar.tsx` (2 lines)
- `frontend/src/environments/MicroScholar.tsx` (2 lines)
- `frontend/src/environments/MicroTube.tsx` (2 lines)

## Verification

After all changes:
1. `cd /path/to/repo && python -m pytest tests/ -v` -- all 14 tests pass
2. `cd frontend && npx tsc --noEmit --skipLibCheck` -- no TS errors
3. `grep -r "sentinel_api" --include='*.py' --include='*.ts' --include='*.tsx' --include='*.md' --include='*.json' --include='*.sh' --exclude-dir=node_modules --exclude-dir=.venv` -- zero matches (except possibly package-lock.json which should be regenerated)
4. `grep -r "sentinelbench" --include='*.py' --include='*.ts' --include='*.tsx' --include='*.md' --include='*.json' --include='*.sh' --exclude-dir=node_modules --exclude-dir=.venv` -- zero matches (except possibly package-lock.json)
5. `SENTINEL_DEV=all python -m uvicorn server.server:app --port 8000` -- server starts and loads all environments

## Important notes

- The `__init__.py` files at `server/__init__.py` and `server/handlers/__init__.py` don't need content changes (they exist but don't reference the package name)
- Don't change any logic, function names, or variable names -- only file paths, import paths, and string references
- The `server/` directory contains subdirectories for each environment (e.g., `server/micromail/`, `server/microhood/`) -- these stay as-is
- `data/` directory is NOT renamed -- it stays at the repo root
- `tests/` directory is NOT renamed -- it stays at the repo root
