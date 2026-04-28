# Scenario Authoring Prompts

Nine self-contained prompts, one per environment. Each prompt briefs a fresh Claude session to enumerate what's in the env's handler, frontend, catalogs, and existing scenarios, then propose the missing scenarios needed to complete the 2-2-2-2 matrix (4 cells x 2 distinct targets = 8/env).

## How to use

1. Open a fresh Claude session at the repo root.
2. Copy **one** prompt block below (just the fenced block under `### Prompt N`), paste it, let it run.
3. The session appends its results to `/home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md` under a `## Micro<Env>` section.
4. Run sequentially to avoid the nine sessions racing on the shared output file. If you want to parallelize, edit the output path in each prompt to `SCENARIO_PROPOSALS_<env>.md` and merge later.

The prompts deliberately do NOT ask the model to write scenario JSON, modify handlers, or commit. They produce a planning document you then pick from.

## Reference: MicroMail is the canonical 2-2-2-2 template

MicroMail is the only env at full 8/8. Every prompt below tells the session to read these as exemplars before proposing anything:

| Cell | Scenarios |
|---|---|
| `passive-absolute` | `sender-absolute-passive.json`, `unread-absolute-passive.json` |
| `passive-relative` | `inbox-relative-passive.json`, `junk-relative-passive.json` |
| `active-absolute` | `attachment-name-absolute-active.json`, `body-keyword-absolute-active.json` |
| `active-relative` | `body-december-relative-active.json`, `cc-relative-active.json` |

Note the activity axis is content-driven: **active** targets are hidden past the list-view preview (attachment filename only visible on open; body keyword past the 140-char preview), while **passive** targets are resolvable from the list itself (sender, folder counts, unread counts).

Target name reuse is NOT allowed across envs -- Micro<Env> picks env-specific nouns.

## Per-proposal schema (every prompt below enforces this)

```
### <target>-<criteria>-<activity>

- **Scenario ID**: `<env>-<target>-<criteria>-<activity>`
- **Filename**: `scenarios/<env>/<target>-<criteria>-<activity>.json`
- **Cell**: passive-absolute | passive-relative | active-absolute | active-relative
- **Monitored target** (noun phrase): ...
- **Why this cell**: 1 sentence justifying both criteria and activity axes.
- **User-facing prompt** (natural language, single sentence, stops at the target condition -- no logout / sign-out / end-action, per CLAUDE.md): "..."
- **Event timeline outline** (sim-seconds; condition_at is randomized at regen time, use placeholder 300):
  - t=0: <event_type> -- catalog IDs: [...]
  - t=<pre-condition>: <event_type> -- payload summary
  - t=<post-condition>: <event_type> -- distractor
  - event_timeline_end: pull default from server/timing.py
- **Catalog IDs claimed** (every ID, verified against the jsonl; verified as unclaimed by existing scenarios in this env -- cite which scenarios you scanned):
  - <id_1>: short description
  - ...
- **Materialized DB fields the eval_sql reads**: table + column + handler file:line that writes them.
- **Draft eval_sql** (SQL, must reference real tables/columns):
  ```sql
  SELECT ...
  ```
- **Handler dependencies**: "No handler changes required." OR
  "Requires handler change: server/handlers/<env>.py must write `baseline_<X>` to session_meta at /init (see line NN where baselines A, B are written). Proposed 3-line addition: ..."
- **Distinctness from paired target**: 1 sentence on why this target is distinct from the other proposal in the same cell.
- **Distinctness from existing scenarios**: 1 sentence on non-overlap.
```

---

## Prompt 1 -- MicroChat

```
You are authoring scenario proposals for the MicroChat environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks: the agent polls a simulated web app and must detect when a user-specified condition becomes true. Each env's scenario set should span a 2x2 matrix of {passive, active} x {absolute, relative}, with 2 distinct target nouns per cell = 8 scenarios per env. MicroChat is the team messaging env (channels, DMs, threads, mentions, read receipts, notifications). It currently ships 2 scenarios.

REQUIRED READING (read fully before proposing anything; cite line numbers in proposals).
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md -- authoring guide.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microchat/ -- all jsonl files; read content, not just schemas, so keyword-based eval_sql can be verified against real strings.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter entries by the `microchat` key to see the user set.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microchat.py -- every event type dispatched, every SQLite table and column materialized, every baseline written to session_meta at /init.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroChat.tsx -- what is visible in the list/channel view (passive) vs detail/message view (active). Crucial for classifying activity axis.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroChatData.ts -- which endpoints the frontend polls.
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microchat/*.json -- every shipped scenario. Note existing target names and catalog IDs already claimed.
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py -- timing constants (condition_at range, default event_timeline_end).
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py -- evaluator runner pattern.

REFERENCE. MicroMail is fully populated 2-2-2-2 -- read every file under /home/user/projects/SentinelMigration/sentinel_environments/scenarios/micromail/ except dev.json before proposing. Note how active targets (attachment-name, body-keyword) require content past the list-view preview, and how relative targets (inbox, junk, body-december, cc) count deltas against a baseline captured at /init.

CELL DEFINITIONS.
- passive: condition resolvable from the list/channel/summary view without opening any message.
- active: condition requires opening a specific message or thread (message body, reaction list past summary, thread replies, attachment filename, etc).
- absolute: fixed threshold or keyword known up-front.
- relative: threshold is delta from baseline captured at /init; requires handler to write baseline_<field> to session_meta.

INVENTORY STEP (do this before writing any proposal; include inline in your output as a collapsible or labelled block titled "MicroChat inventory"):
1. Endpoints this env exposes -- list each route path + method + shape.
2. Event types the handler dispatches -- grep the handler's dispatch (look for `event["type"]` or a dict lookup).
3. SQLite tables and columns the handler writes -- names + the handler line that writes each.
4. baseline_* fields written to session_meta at /init -- list names + line numbers. If a cell needs a baseline that doesn't exist, you'll flag a handler change.
5. Current scenario distribution by cell -- classify the 2 shipped scenarios into the 2x2, note which cells have 0 and which have 1.

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under a `## MicroChat` section. If the file does not exist, create it with `# Scenario Proposals` as the H1.

For each cell not already filled with 2 distinct targets, propose EXACTLY 2 scenarios using this schema per proposal:

### <target>-<criteria>-<activity>
- **Scenario ID**: microchat-<target>-<criteria>-<activity>
- **Filename**: scenarios/microchat/<target>-<criteria>-<activity>.json
- **Cell**: passive-absolute | passive-relative | active-absolute | active-relative
- **Monitored target**: noun phrase
- **Why this cell**: 1 sentence on both axes.
- **User-facing prompt**: single sentence, ends at the target condition (no logout / sign-out / end-action per CLAUDE.md).
- **Event timeline outline** (sim-seconds; use 300 as condition_at placeholder):
  - t=0: <event_type> -- catalog IDs: [...]
  - t=<pre>: <event_type> -- payload summary
  - t=<post>: <event_type> -- distractor
  - event_timeline_end: <value from server/timing.py>
- **Catalog IDs claimed**: list every ID with a short description; verify absence in existing scenarios and cite which scenario files you scanned.
- **Materialized DB fields eval_sql reads**: table.column + handler file:line.
- **Draft eval_sql**: real tables/columns only.
- **Handler dependencies**: "No handler changes required." OR exact file:line + proposed diff for a baseline_<X> addition.
- **Distinctness from paired target**: 1 sentence.
- **Distinctness from existing scenarios**: 1 sentence.

CRITIQUE (mandatory, at the bottom of your MicroChat section):
### Critique of existing scenarios
- `<scenario-id>`: issue (cell overlap, stale prompt, target collision with a proposal above, eval_sql referencing unwritten columns, overlap with another shipped scenario's target, etc).
Flag 1-3 issues. Specific things to check in MicroChat: both existing scenarios target `unread`; see whether that's a real 2-cell use of the same noun or whether one should be renamed to a distinct target.

PROCESS RULES (non-negotiable).
1. Read the required files fully before proposing. Cite line numbers.
2. Every event type must be in the handler's dispatch. Cite the line.
3. Every catalog ID must exist in the jsonl. Verify before claiming.
4. Every eval_sql column must be written by the handler. Cite the line.
5. If a relative-* cell needs a baseline the handler does not emit, propose it anyway and spell out the handler change (file, line, 3-line diff). The user wants the full matrix gap visible, handler work included.
6. Do NOT write scenario JSON files. Do NOT modify handlers. Do NOT commit. Output only the append to SCENARIO_PROPOSALS.md.
7. Target nouns must be distinct within a cell AND across shipped scenarios in this env.
8. If fewer than 2 genuinely distinct targets exist for a cell in MicroChat's data, say so explicitly -- do not force a weak second proposal.
```

---

## Prompt 2 -- MicroDin

```
You are authoring scenario proposals for the MicroDin environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. Each env should span 2x2 {passive, active} x {absolute, relative} with 2 distinct targets per cell = 8/env. MicroDin is the professional network env (posts, comments, connections, jobs, notifications, messages, company pages). It currently ships 3 scenarios.

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microdin/ -- all jsonl files.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by the `microdin` key.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microdin.py -- event types, materialized tables, baselines.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroDin.tsx -- list view vs detail view split.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroDinData.ts -- endpoints polled.
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microdin/*.json -- shipped scenarios.
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail is fully 2-2-2-2; read every file in /home/user/projects/SentinelMigration/sentinel_environments/scenarios/micromail/ except dev.json before proposing. Active targets require content past the list preview (attachment filename, body keyword past 140-char preview); relative targets count deltas vs a baseline captured at /init.

CELL DEFINITIONS.
- passive: condition from list/feed/summary view.
- active: condition requires opening a post/comment thread/job listing/message (post body, comment replies, job description full text, message thread content).
- absolute: fixed threshold or keyword.
- relative: threshold is delta from baseline captured at /init.

INVENTORY STEP (include as a labelled block in your output):
1. Endpoints this env exposes.
2. Event types the handler dispatches.
3. SQLite tables and columns the handler writes.
4. baseline_* fields written at /init.
5. Current scenario distribution by cell.

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroDin`. Create the file with `# Scenario Proposals` H1 if needed.

For each cell not already filled with 2 distinct targets, propose EXACTLY 2 scenarios using this schema:

### <target>-<criteria>-<activity>
- **Scenario ID**: microdin-<target>-<criteria>-<activity>
- **Filename**: scenarios/microdin/<target>-<criteria>-<activity>.json
- **Cell**: ...
- **Monitored target**: ...
- **Why this cell**: 1 sentence.
- **User-facing prompt**: single sentence, stops at target condition.
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0, t=<pre>, t=<post>, event_timeline_end
- **Catalog IDs claimed**: every ID, verified, with sources cited.
- **Materialized DB fields eval_sql reads**: table.column + handler file:line.
- **Draft eval_sql**.
- **Handler dependencies**: none, or exact file:line + 3-line diff.
- **Distinctness from paired target**: 1 sentence.
- **Distinctness from existing scenarios**: 1 sentence.

CRITIQUE (mandatory).
### Critique of existing scenarios
Flag 1-3 issues in the 3 shipped scenarios. Check for cell overlap (e.g., is any cell already at 2 with distinct targets, or is it 2-of-one?), stale logout/sign-out phrasing (CLAUDE.md notes this was cleaned up repo-wide; verify), eval_sql touching unwritten columns, target collision with proposals.

PROCESS RULES (non-negotiable).
1. Read fully before proposing; cite line numbers.
2. Events must be handler-dispatched types.
3. Catalog IDs must exist and be uncollided.
4. eval_sql columns must be handler-written.
5. Missing baselines: propose anyway, spell out handler change.
6. No JSON, no handler edits, no commits.
7. Distinct targets per cell and vs shipped scenarios.
8. If a cell has fewer than 2 viable distinct targets in MicroDin's data, say so -- do not force a weak second.
```

---

## Prompt 3 -- MicroFy

```
You are authoring scenario proposals for the MicroFy environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. 2x2 matrix, 2 targets per cell = 8/env. MicroFy is the music streaming env (tracks, albums, playlists, plays, likes, followers, lyrics, artists). It currently ships 3 scenarios.

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microfy/ -- all jsonl; read track lyrics / descriptions in full since active targets depend on content past the list preview.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by the `microfy` key.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microfy.py
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroFy.tsx -- pay attention to where lyrics become visible (detail view only = active), where play counts and follower totals are shown (list view = passive).
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroFyData.ts
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microfy/*.json
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail is 2-2-2-2; read its scenario files before proposing.

CELL DEFINITIONS. Same as other envs. For MicroFy specifically: "active" targets are things like lyric keywords, track descriptions past preview, artist bios, playlist descriptions, album liner notes -- anything not visible in the track-list row. "passive" is play counts, follower counts, likes counts, track presence in a playlist.

INVENTORY STEP (include as labelled block):
1. Endpoints.
2. Event types dispatched (e.g., new_track, new_play, new_like, new_follower, update_playlist -- verify from handler).
3. SQLite tables + columns written.
4. baseline_* fields at /init.
5. Current 3 scenarios classified into the 2x2.

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroFy`.

For each cell not already filled with 2 distinct targets, propose EXACTLY 2 scenarios using the schema (Scenario ID / Filename / Cell / Monitored target / Why this cell / User-facing prompt / Event timeline outline / Catalog IDs claimed / Materialized DB fields / Draft eval_sql / Handler dependencies / Distinctness from paired target / Distinctness from existing).

CRITIQUE (mandatory).
### Critique of existing scenarios
Flag 1-3 issues across `followers-absolute-active`, `likes-absolute-passive`, `plays-absolute-passive`. In particular, note that `followers-absolute-active` is an unusual pairing -- follower count is usually visible in the list view (passive); confirm whether the scenario actually requires a detail-view drilldown or whether its axis is mis-labelled. Also check whether both `likes` and `plays` occupy `passive-absolute` -- if so, the cell is "2 targets" technically but both are engagement-metric variants; note if the pairing feels redundant.

PROCESS RULES. Read fully before proposing; cite line numbers. Handler-dispatched event types only. Catalog IDs must exist and be uncollided. eval_sql columns must be handler-written. Missing baselines: propose + handler diff. No JSON, no edits, no commits. Distinct targets. Thin cells: say so.
```

---

## Prompt 4 -- MicroGram

```
You are authoring scenario proposals for the MicroGram environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. 2x2 matrix, 2 targets per cell = 8/env. MicroGram is the photo-sharing env (posts, stories, activity feed, follows, likes, comments, direct messages). It currently ships 3 scenarios.

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microgram/ -- all jsonl; read post captions, comment threads, story text in full.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by `microgram`.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microgram.py
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroGram.tsx -- clarify list view (feed grid, counts) vs detail view (single post with full caption, comment thread, story content). Active targets live in detail.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroGramData.ts
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microgram/*.json
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail's 2-2-2-2 layout; read its scenario files.

CELL DEFINITIONS. passive: feed/profile counts (follower count, like count, post count). active: content behind a post click (caption keyword, comment thread reply, story content, DM thread body). absolute: fixed threshold/keyword. relative: delta vs baseline.

INVENTORY STEP (labelled block):
1. Endpoints exposed (note there is a /data/microgram-users endpoint per memory).
2. Event types dispatched (new_post, new_story, new_follow, new_like, new_comment, new_message -- verify).
3. SQLite tables + columns (check how stories are materialized -- do they have their own table?).
4. baseline_* fields at /init.
5. Current 3 scenarios classified.

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroGram`.

For each unfilled cell, EXACTLY 2 proposals using the schema.

CRITIQUE (mandatory). Flag 1-3 issues across `follows-absolute-active`, `likes-absolute-passive`, `stories-absolute-passive`. `follows-absolute-active` is suspicious -- follow count is usually list-view-visible. Check whether the scenario prompt is really about an active-view-only detail (e.g., who specifically started following, visible only in notifications/detail), or whether it's mis-axised. Also consider whether `stories-absolute-passive` conflicts activity-wise if stories require tap-to-view.

PROCESS RULES. Read fully; cite lines. Handler-dispatched event types only. Catalog IDs must exist + be uncollided. eval_sql columns must be handler-written. Missing baselines: propose + diff. No JSON, no edits, no commits. Distinct targets. Thin cells: say so explicitly.
```

---

## Prompt 5 -- MicroHood

```
You are authoring scenario proposals for the MicroHood environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. 2x2 matrix, 2 targets per cell = 8/env. MicroHood is the stock trading env (portfolio holdings, price traces, orders, watchlist, alerts, news). It currently ships 2 scenarios. It is a text-only JSONL env (no synthetic images).

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microhood/ -- all jsonl.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by `microhood`.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microhood.py -- pay close attention to `preload_stocks` which now inlines `price_waypoints` (per CLAUDE.md / recent time-scale changes). Understand how waypoints drive price at each sim-second, because any price-threshold relative scenario needs the right waypoint shape.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroHood.tsx -- list view (portfolio, watchlist, order list) vs detail view (single stock with news, analyst notes, full order history).
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroHoodData.ts
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microhood/*.json -- note `orders-absolute-active` uses inlined waypoints; your proposals should follow the same inline-waypoint convention (no external price-trace files).
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail's 2-2-2-2 layout; read before proposing.

CELL DEFINITIONS. passive: portfolio totals, watchlist counts, order status visible in list. active: per-stock news item, analyst note body, individual order detail that requires drilling in. absolute: price reaches $X, portfolio value reaches $Y, N new orders filled. relative: portfolio value grows by X% vs baseline at /init, watchlist count grows by N, holdings in sector Z gain vs baseline.

INVENTORY STEP (labelled block):
1. Endpoints exposed.
2. Event types dispatched. `preload_stocks` (with inline waypoints), and anything else -- verify from handler dispatch.
3. SQLite tables + columns (stocks, orders, watchlist, news -- names may differ; verify).
4. baseline_* at /init. Portfolio value at t=0 is the most likely useful baseline; confirm it's actually written.
5. Current 2 scenarios classified.

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroHood`.

For each unfilled cell, EXACTLY 2 proposals using the schema.

Special note for MicroHood: when proposing a price-based scenario, the event timeline MUST include the inlined `price_waypoints` with explicit (time, price) pairs that shape the price curve past the condition threshold. Describe the waypoint list in the event timeline outline.

CRITIQUE (mandatory). Flag 1-3 issues across `orders-absolute-active`, `portfolio-absolute-passive`. Most important: check whether the handler writes `baseline_portfolio_value` -- if not, every relative scenario here needs a handler change and you should flag it as the single biggest blocker. Also check whether `orders-absolute-active` actually requires a detail-view drilldown or whether order status is visible in the list (which would make it passive).

PROCESS RULES. Read fully; cite lines. Handler-dispatched event types only. Catalog IDs must exist + be uncollided. eval_sql columns must be handler-written. Missing baselines: propose + diff. No JSON, no edits, no commits. Distinct targets. Thin cells: say so.
```

---

## Prompt 6 -- MicroHub

```
You are authoring scenario proposals for the MicroHub environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. 2x2 matrix, 2 targets per cell = 8/env. MicroHub is the code-hosting env (repositories, issues, pull requests, commits, releases, wiki, CI runs, activity feed). It currently ships 2 scenarios. Text-only JSONL env.

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microhub/ -- all jsonl: issues.jsonl, files.jsonl, wiki.jsonl, repository.jsonl, insights.jsonl, and any others. Read body text fully; active scenarios depend on content hidden past the issue/PR title.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by `microhub`.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microhub.py
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroHub.tsx -- list view (issue list with title + labels + counts; PR list; commit feed; releases) vs detail view (issue body, PR review comments, commit diff, release notes, wiki page body). Active targets live in detail.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroHubData.ts
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microhub/*.json
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail's 2-2-2-2 layout; read before proposing.

CELL DEFINITIONS. passive: issue count, PR count, star count, open issues with label X, commits on default branch (all visible as counts or lists). active: issue body keyword, PR review comment, commit message keyword past abbreviation, release notes body, wiki page content. absolute: fixed threshold/keyword. relative: delta vs baseline (e.g., open-issue count grows by N, stars grow by N).

INVENTORY STEP (labelled block):
1. Endpoints exposed -- there's a /data/microhub-users endpoint per memory; verify.
2. Event types dispatched (new_issue, new_pr, new_commit, new_release, new_comment, new_wiki, new_run -- verify).
3. SQLite tables + columns materialized. Handler resolves author avatars and adds fields per memory; trace which fields.
4. baseline_* at /init. Star count, open-issue count, PR count, commit count -- which are written?
5. Current 2 scenarios classified (`browse-absolute-passive`, `contribute-absolute-active`).

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroHub`.

For each unfilled cell, EXACTLY 2 proposals using the schema.

CRITIQUE (mandatory). Flag 1-3 issues across `browse-absolute-passive` and `contribute-absolute-active`. In particular: `browse` and `contribute` are both quite generic target names for MicroHub -- check whether they actually map to specific monitored nouns (which count? which content type?) or whether they're umbrella labels that your proposals should carve into something more specific. If they're umbrellas, your proposals in the remaining 6 slots may benefit from the same specificity.

PROCESS RULES. Read fully; cite lines. Handler-dispatched event types only. Catalog IDs must exist + be uncollided. eval_sql columns must be handler-written. Missing baselines: propose + diff. No JSON, no edits, no commits. Distinct targets. Thin cells: say so.
```

---

## Prompt 7 -- MicroLendar

```
You are authoring scenario proposals for the MicroLendar environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. 2x2 matrix, 2 targets per cell = 8/env. MicroLendar is the calendar env (events, tasks, reminders, attendees, invitations). It currently ships 3 scenarios. Text-only JSONL env.

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microlendar/ -- all jsonl; read event descriptions and task notes in full.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by `microlendar`.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microlendar.py -- attendee resolution returns `[{id, name, avatarUrl}]` per memory; trace how attendees materialize to SQLite so you know which column to query.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroLendar.tsx -- list view (agenda, day/week grid, task list) vs detail view (event body, attendee list, task notes).
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroLendarData.ts
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microlendar/*.json
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail's 2-2-2-2 layout; read before proposing.

CELL DEFINITIONS. passive: event count, task count (open/done), reminder count -- all visible in agenda or task list. active: event description keyword, attendee name in per-event detail, task notes keyword, meeting-link field, recurring rule text. absolute: fixed threshold or keyword. relative: delta vs baseline (e.g., open tasks grow by N, events on a given day grow by N).

INVENTORY STEP (labelled block):
1. Endpoints exposed.
2. Event types dispatched (new_event, new_task, new_reminder, update_task, rsvp_response -- verify).
3. SQLite tables + columns (events, tasks, reminders, attendees -- verify).
4. baseline_* at /init.
5. Current 3 scenarios classified (`events-absolute-passive`, `tasks-absolute-passive`, `work-relative-active`).

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroLendar`.

For each unfilled cell, EXACTLY 2 proposals using the schema.

CRITIQUE (mandatory). Flag 1-3 issues across the 3 shipped scenarios. Check: do `events-absolute-passive` and `tasks-absolute-passive` both occupy the same cell? If yes, the cell is "filled" but both targets are count-based -- is that sufficiently distinct, or does one need repositioning? `work-relative-active` occupies `active-relative` -- what is the "work" target exactly, and is there a clear second target for this cell?

PROCESS RULES. Read fully; cite lines. Handler-dispatched event types only. Catalog IDs must exist + be uncollided. eval_sql columns must be handler-written. Missing baselines: propose + diff. No JSON, no edits, no commits. Distinct targets. Thin cells: say so.
```

---

## Prompt 8 -- MicroScholar

```
You are authoring scenario proposals for the MicroScholar environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. 2x2 matrix, 2 targets per cell = 8/env. MicroScholar is the academic-search env (papers, citations, coauthors, abstracts, alerts, saved searches). It currently ships 3 scenarios. Text-only JSONL env.

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microscholar/ -- all jsonl, especially papers.jsonl; read abstracts fully for keyword verification.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by `microscholar`.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microscholar.py -- per memory, the handler adds `authorDetails` to papers and resolves coauthor names; trace which columns actually land in SQLite.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroScholar.tsx -- list view (search results with title + author + citation count) vs detail view (abstract, full author list, bibliography). Active targets live in detail.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroScholarData.ts
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microscholar/*.json
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail's 2-2-2-2 layout; read before proposing.

CELL DEFINITIONS. passive: search-result count, alert count, citation count for a tracked paper (visible in list). active: abstract keyword, coauthor in author list past truncation, paper venue in detail, saved-search result filtering that needs detail view. absolute: paper titled X appears, citations reach N, alert for author X fires. relative: new citations since baseline, new papers in saved search since baseline.

INVENTORY STEP (labelled block):
1. Endpoints exposed -- /data/microscholar-users per memory; verify.
2. Event types dispatched (new_paper, new_citation, new_alert, update_citation_count -- verify).
3. SQLite tables + columns (papers, citations, alerts, saved_searches -- verify names).
4. baseline_* at /init. Note per CLAUDE.md there is a known ambiguity in `microscholar-search-absolute-active` -- re-read the scenario to understand the edge case before proposing.
5. Current 3 scenarios classified (`alert-absolute-passive`, `search-absolute-active`, `search-absolute-passive`).

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroScholar`.

For each unfilled cell, EXACTLY 2 proposals using the schema.

CRITIQUE (mandatory). Flag 1-3 issues across the 3 shipped scenarios. Required: surface the known ambiguity in `microscholar-search-absolute-active` (CLAUDE.md flags that the current evaluator checks "paper appears in search results" but the product intent may be "click Cite" -- document which interpretation your proposals are compatible with). Also note whether both `search-absolute-active` and `search-absolute-passive` share the same target noun ("search") -- that's the same noun across cells, which is acceptable only if the monitored field genuinely differs (e.g., result-count vs abstract-keyword).

PROCESS RULES. Read fully; cite lines. Handler-dispatched event types only. Catalog IDs must exist + be uncollided. eval_sql columns must be handler-written. Missing baselines: propose + diff. No JSON, no edits, no commits. Distinct targets. Thin cells: say so.
```

---

## Prompt 9 -- MicroTube

```
You are authoring scenario proposals for the MicroTube environment in the Sentinel Environments benchmark. Your output is a planning document; do NOT write scenario JSON, modify handlers, or commit.

CONTEXT. Sentinel Environments evaluates AI agents on monitoring tasks. 2x2 matrix, 2 targets per cell = 8/env. MicroTube is the video platform env (videos, subscribers, notifications, views, comments, playlists, channels). It currently ships 3 scenarios.

REQUIRED READING.
- /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_GEN.md
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/microtube/ -- all jsonl, especially videos.jsonl; read descriptions and comment threads fully.
- /home/user/projects/SentinelMigration/sentinel_environments/data/catalogs/users.json -- filter by `microtube`.
- /home/user/projects/SentinelMigration/sentinel_environments/server/handlers/microtube.py
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/environments/MicroTube.tsx -- list view (video grid with thumbnails, titles, view counts, subscriber counts) vs detail view (video description past fold, comments, chapter markers, transcript). Active targets are in detail.
- /home/user/projects/SentinelMigration/sentinel_environments/frontend/src/hooks/useMicroTubeData.ts
- /home/user/projects/SentinelMigration/sentinel_environments/scenarios/microtube/*.json
- /home/user/projects/SentinelMigration/sentinel_environments/server/timing.py
- /home/user/projects/SentinelMigration/sentinel_environments/tests/test_eval_sql.py

REFERENCE. MicroMail's 2-2-2-2 layout; read before proposing.

CELL DEFINITIONS. passive: subscriber count, video count, view total on a tracked channel, notification count (visible in list/channel view). active: video description keyword past fold, comment thread content, chapter marker text, transcript keyword, pinned-comment text. absolute: fixed threshold/keyword. relative: delta vs baseline (e.g., subscribers grow by N, views on a specific video grow by N).

INVENTORY STEP (labelled block):
1. Endpoints exposed.
2. Event types dispatched (new_video, new_subscriber, new_view, new_comment, new_notification -- verify).
3. SQLite tables + columns (videos, subscribers, views, comments, notifications -- verify).
4. baseline_* at /init.
5. Current 3 scenarios classified (`notifications-absolute-active`, `subscribers-absolute-passive`, `views-relative-active`).

DELIVERABLE. Append to /home/user/projects/SentinelMigration/sentinel_environments/SCENARIO_PROPOSALS.md under `## MicroTube`.

For each unfilled cell, EXACTLY 2 proposals using the schema.

CRITIQUE (mandatory). Flag 1-3 issues across the 3 shipped scenarios. Check: `notifications-absolute-active` -- notifications are usually a list-view item, so why "active"? Verify the monitored field is genuinely detail-view-only. `views-relative-active` -- does the handler write `baseline_views` for the specific video being tracked, or just aggregate views? If it's aggregate, the scenario's semantics may not match the eval_sql. `subscribers-absolute-passive` -- straightforward, but confirm subscriber count is actually in the list view the agent would poll.

PROCESS RULES. Read fully; cite lines. Handler-dispatched event types only. Catalog IDs must exist + be uncollided. eval_sql columns must be handler-written. Missing baselines: propose + diff. No JSON, no edits, no commits. Distinct targets. Thin cells: say so.
```

---

## After all 9 runs

- `SCENARIO_PROPOSALS.md` at the repo root should have 9 sections (`## MicroChat` ... `## MicroTube`), each with an inventory block, up to 8 proposals (2 per cell that needed filling), and a critique block.
- Expected total: somewhere around 40-55 new proposals, depending on how many cells each env already fills. You then pick which to implement (target: get each env to 8, cell-balanced), and convert each picked proposal to a scenario JSON file plus any flagged handler changes.
- If any prompt flags a `Requires handler change: ...`, queue those handler edits before writing the scenario JSON -- `test_eval_sql.py` will fail on day one otherwise.
- Re-run `python -m server.scripts.randomize_condition_at` after adding scenario files so `condition_at` gets its seeded randomization.
