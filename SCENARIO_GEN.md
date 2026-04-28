# Scenario Generation Guide

## What is Sentinel Environments?
Sentinel Environments is a benchmark for evaluating AI agents on **monitoring tasks** -- tasks where an agent must watch a simulated web application and detect when a condition is fulfilled. Each environment is a realistic clone of a real-world app (email client, music player, GitHub, etc.) with a time-based event system that gradually introduces new data. The agent being evaluated polls the environment, navigates the UI, and must recognize when a user-specified condition becomes true.

You are generating scenarios for this benchmark. A scenario defines: a natural-language prompt (what the user asks the agent to watch for), a timeline of simulated events, and an `eval_sql` query that determines pass/fail.

## Before You Start
Before generating scenarios for an environment, you **must read** these files to understand the data and constraints:

1. **Catalog JSONL files** (`data/catalogs/<environment>/*.jsonl`) -- these are the immutable data pools. Every event you fire must reference an existing catalog ID from these files. Read them fully to understand what data is available: field names, content, IDs, and crucially the **full text content** of each item (bodies, lyrics, descriptions, etc.) so you can verify keyword presence/absence and avoid overlap.
2. **Existing scenarios** (`server/<environment>/scenarios/*.json`) -- see what's already been implemented, what IDs have been claimed, and what patterns are used. Do not reuse the same catalog IDs across scenarios unless intentional.
3. **Handler code** (`server/handlers/<environment>.py`) -- understand what event types the handler supports (e.g., `new_email`, `new_track`, `new_post`), what fields get materialized to SQLite (this determines what `eval_sql` can query), and what baseline metrics are tracked for relative scenarios.
4. **Frontend component** (`frontend/src/environments/<environment>/*.tsx`) -- understand what's visible in the list/summary view vs. what requires clicking into a detail view. This is critical for correctly classifying scenarios as passive vs. active. Look for what fields are rendered in list items vs. what only appears in detail/modal views.

## Target
- 8 scenarios per environment (balanced 2/2/2/2 split across taxonomy)
- Conditions can be thresholds ("when there are 10 emails") or one-off events ("when John pings me") -- both are just "waiting for a condition to be fulfilled"
- Every scenario must require waiting for a future change in the environment. If the agent could finish the task immediately at t=0 by acting on preloaded state, it is not a valid Sentinel scenario.

## Taxonomy Dimensions
- **Absolute**: fixed condition (e.g., "when there are 10 emails", "when John messages me", "when a paper about quantum computing shows up")
- **Relative**: condition relative to baseline at session start (e.g., "when 5 MORE emails arrive", "when 3 more PRs get opened")
- **Passive**: agent can monitor from a single page/view without navigating into detail views
- **Active**: agent must navigate into detail views each poll cycle to check content not visible from the list/summary view

### Split per environment
| Count | Type |
|-------|------|
| 2 | Absolute / Passive |
| 2 | Absolute / Active |
| 2 | Relative / Passive |
| 2 | Relative / Active |

## Prompt Style
- **Natural language** -- write prompts as something a real end user would actually ask a monitoring agent today
- Write prompts as a direct user request, not roleplay or benchmark narration. Do not start with "You are using <app>" or "You are monitoring <app>".
- Every prompt must clearly be a waiting/monitoring request: "let me know when...", "keep an eye on...", "watch for...", "tell me if...".
- Do not narrate hidden benchmark mechanics to the agent. Avoid lines like "new messages will arrive during the session" or "a specific paper will appear after some time". The user should ask for an outcome, not explain the simulation.
- Agent actions are allowed only when monitoring is still the core task. The prompt may ask the agent to do something in response to future events, but it must not be completable immediately from the initial page state.
- **No "log out" / "sign out"** -- the agent just needs to meet the eval_sql condition
- Avoid jargon or UI-specific terms the user wouldn't know (e.g., don't say "urgent emails" when the UI shows a red arrow icon -- say something the user would naturally say)
- Good: "Let me know when I get an email from Kevin Lee."
- Good: "Watch until there's a new release of a song that mentions the United States in its lyrics."
- Good: "I'm expecting an email about platform scalability -- it might not be in the subject line, so you'll need to read through the emails."
- Good: "Keep an eye on this page and let me know if a paper titled 'Autonomous AI Agents' shows up."
- Good: "Watch for new videos from channels I already follow, and tell me when 3 of them have appeared."
- Bad: "Let me know when someone sends me a message about the quarterly report" (what quarterly report? which company? too vague)
- Bad: "Watch for a song that mentions the United States in its lyrics" (mentions where? this could mean title, description, or lyrics -- be specific about what the agent needs to check)
- Bad: "Monitor the inbox. When there are at least 20 emails in the inbox, log out."
- Bad: "Tell me when there are 5 urgent emails." (what does "urgent" mean to a user? the UI shows a red arrow icon but a user wouldn't use that term)
- Bad: "You are using MicroFy. Like at least 10 songs to build your personalized music library." (not a monitoring request; the agent can do it immediately)
- Bad: "Search for papers on MicroScholar. A specific paper about 'Autonomous AI Agents' will appear in the search results after some time. Wait until it appears in the search results." (sounds synthetic and exposes benchmark internals)
- Bad: "You are monitoring MicroTube. Wait until you see at least 3 channels that you are subscribed to." (implausible world model unless the agent is actively subscribing to channels)

## Scenario Invariants
- `condition_at` is required for every non-dev scenario. It marks the earliest second when the success condition can become true.
- Before `condition_at`, `eval_sql` must still be false. If the task can already be satisfied at t=0, the scenario is invalid.
- Monitoring must be load-bearing. A valid scenario requires the agent to wait for external changes over time, not just inspect or manipulate static preload data.
- Agent-created state is allowed only if it is gated by future events. Example: liking new tracks as they arrive can be valid; "like 10 existing tracks" is not.
- Preloads are for context and baselines, not for sneaking in completion. Do not preload enough state that the agent can win on the first poll cycle.
- The condition must make sense for that product's world model. New emails, notifications, listings, uploads, papers, and price moves are plausible things to wait for. Counts of subscriptions, likes given, views already watched, or orders placed do not normally increase on their own.
- Relative scenarios still need true waiting semantics: establish the baseline at t=0, then ensure the required delta only becomes reachable after later events.

### Quick Rejection Test
Reject the scenario if any answer is "yes":
- Could a fast agent finish this on its first poll cycle without waiting for later events?
- Does the prompt sound like benchmark narration rather than a normal user request?
- Does the success condition rely on a user-owned state magically changing on its own in a way the product would not naturally support?
- Could the agent satisfy the task by doing generic actions immediately on preload data?
- For active scenarios, could the agent satisfy the target by opening a single detail view at t=0 and camping there without ever returning to the list? If yes, the scenario is a one-time drill-in disguised as active. See the "What 'Active' Means" section for how to widen or sequence the target.

## Event Timing
- **Author new scenarios against `condition_at: 300`** and lay events out on a 0-600s timeline. This is a drafting convention, not the shipped value.
- **Do not set `event_timeline_end` or `kill_at` by hand.** After authoring, run `python scripts/randomize_condition_at.py` -- it rewrites `condition_at` to a deterministic per-scenario value in `[10, 600]` (seeded by `scenario_id`), stretches events piecewise-linearly, and stamps in `event_timeline_end: 720.0` and `kill_at: 630.0` from `server/timing.py`. The old `duration: 600` field is dropped by the script.
- The randomization exists so a single sleep-then-check strategy cannot win the suite. Never re-introduce a fixed `condition_at` across scenarios.
- Event times may be floats (e.g., `99.05`); the script rounds to 2 decimals. Int times are still fine when you hand-author.
- Events arrive gradually before `condition_at`, building toward the threshold or delivering the target event.
- **Exactly one event (or one tight bundle) at `t == condition_at`** delivers the target. The script anchors any event whose `time == old_condition_at` to the new randomized value; all other events are treated as distractors and scaled. If two events need to fire together at the target, give them the same time -- both will move together.
- The last event/opportunity needed for success should land at `condition_at`. Before that point, the agent may make progress but must still be unable to complete the task.
- For scenarios that include agent actions, later events must create the opportunities the agent acts on. Do not make the entire task solvable by acting only on items that were present at t=0.
- **Events must keep firing after `condition_at`** -- the world doesn't stop when the condition is met. Add trailing filler events out to ~600s so the simulation feels realistic; the script will stretch them into `(condition_at, 720]`.
- Example (as authored): task is "wait for 10 messages", `condition_at: 300`; messages 1-9 spread across 0-280s, message 10 at 300s, messages 11-15 at 350s-550s. After running the script the same scenario might land at `condition_at: 396.19` with messages scaled accordingly.
- **Price-waypoint targets (MicroHood)**: if the target condition is a stock price crossing a threshold, author it with `price_waypoints` inside a `preload_stocks` event (see the MicroHood section below). The script rescales waypoint times along with event times, so a waypoint placed at `condition_at: 300` anchors to the new randomized `condition_at` automatically.

## Completion
- No "log out" or terminal action in the prompt
- Agent just needs to meet the `eval_sql` condition
- Harness calls `POST /evaluate` after agent exits

## Quality Bar
- Prompts must be realistic (something a real user would ask an agent for that specific website)
- `eval_sql` must unambiguously verify success
- The prompt, event timeline, and `eval_sql` must all agree on the same future condition. If the wording suggests "wait for something to appear" but the SQL really checks "did the agent click 5 things", the scenario is incoherent.
- The monitored condition must be product-plausible. Do not write scenarios where the only way the condition changes is via unexplained magic or by the agent immediately grinding actions.

### Events must come from existing catalogs
- **Every event payload must reference an ID that exists in the environment's JSONL catalog files** (`data/catalogs/<environment>/*.jsonl`). Never invent IDs.
- Read the JSONL files before generating scenarios. You need to know the full content of each item (body text, sender, keywords, attachments, etc.) to pick appropriate targets and fillers.
- For active scenarios, verify that the target content is truly hidden from the list view and only visible in the detail view. Read the frontend component to confirm. Examples of what to check per environment:
  - **MicroMail**: is the keyword past the 140-char body preview? is it in the CC list or attachment name (not shown in list)?
  - **MicroFy**: is the target phrase in the lyrics (only visible after clicking into a track)?
  - **MicroHub**: is the condition in a PR review comment, commit diff, or issue body (not shown in the issues/PRs list)?
  - **MicroScholar**: is the keyword in the paper abstract (only visible after clicking into the paper)?
  - **MicroGram**: is the content in a post's comments or caption details (not the feed thumbnail)?
  - In general: if the agent could detect the condition by just looking at the list/summary view without clicking into anything, it's passive, not active.

### No confusing filler events
Filler events fired before `condition_at` must not mislead the agent into thinking the condition is already met. The agent should not encounter items that are semantically similar or topically related to the target condition before the real target arrives.

**Verification steps before finalizing a scenario:**
- For keyword-based conditions: search the full catalog for the target keyword (and close synonyms/substrings). Verify that no filler item contains it in any field the agent could see.
- For author/sender-based conditions: search the catalog for all items by that person. Do not fire any of them as filler.
- For content-detail conditions (attachments, lyrics, abstracts, comments): verify no filler items have titles, previews, or summaries that suggest the target content.
- For threshold conditions: filler items should be clearly distinct from items that count toward the threshold.

**Examples across environments:**

Bad -- topically confusing filler (MicroMail):
- Task: "wait for an email with the finance report attached"
- Filler includes an email with subject "Q4 Finance Summary"
- Why it's bad: the agent sees a finance-related email, opens it, finds no matching attachment, and gets confused

Bad -- author appears in filler (MicroHub):
- Task: "let me know when there's a new PR from alice"
- Filler includes an older PR also authored by alice
- Why it's bad: the agent sees alice's name in the PR list before `condition_at` and reports success prematurely

Bad -- topically similar filler (MicroFy):
- Task: "watch for a song that mentions 'California' in its lyrics"
- Filler includes a track titled "California Dreamin'"
- Why it's bad: the agent sees "California" in the track title on the list view and may report early without checking lyrics

Good -- unrelated filler (MicroMail):
- Task: "wait for an email with the mobile app mockups attached"
- Filler attachment emails have subjects like "Design Assets" and "Presentation Deck" -- completely different topics, no mention of "mobile" anywhere
- Why it's good: filler is plausible (other attachment emails exist) but doesn't hint at the target

Good -- unrelated filler (MicroScholar):
- Task: "let me know when a paper about quantum computing shows up"
- Filler papers are about machine learning, genomics, climate science -- no overlap with "quantum"
- Why it's good: papers keep arriving but none touch the target topic

## Anti-Examples From Current Repo
These phrases come from current scenarios and should not be reused as-is:

Bad -- no real waiting, can be completed immediately:
- "Play at least 5 different songs to explore the music library."
- "Like at least 10 songs to build your personalized music library."
- "Follow at least 5 artists you enjoy."
- "Like at least 10 posts in your feed."
- "View at least 10 stories."
- "Follow at least 5 users."
- "Place at least 3 stock orders (buy or sell)."
- "Browse the repository."
- "Add a comment to any open issue."
- "Watch new videos as they arrive until you have watched at least 5 additional videos."
- Why they're bad: these read like direct action tasks, not monitoring tasks. The agent can often make immediate progress or finish without any meaningful waiting.

Bad -- implausible world model:
- "Wait until you see at least 3 channels that you are subscribed to."
- Why it's bad: the number of channels the user is subscribed to is normally user-owned state. It does not drift upward over time unless the agent is actively subscribing, so this is not a sensible monitoring request.

Bad -- synthetic prompt wording:
- "A specific paper about 'Autonomous AI Agents' will appear in the search results after some time. Wait until it appears in the search results."
- "A new paper about 'Autonomous AI Agents' will appear in the search results. Wait for it to appear."
- Why they're bad: the prompt tells the agent that a target paper "will appear" later, which sounds like benchmark scaffolding rather than something a real user would say. Rewrite these as direct requests to keep watching for the paper.

Bad -- benchmark narration instead of user language:
- "You are using MicroChat."
- "You are using MicroDin."
- "You are monitoring MicroTube."
- "New messages will arrive during the session."
- "New connection requests will arrive during the session."
- "New job listings will appear during the session."
- "New notifications will arrive during the session."
- Why they're bad: these phrases explain the simulation or force roleplay instead of stating the user's monitoring goal in normal language.

## What "Active" Means
- Agent must navigate into detail views / click into individual items to check content not visible from the list view
- The agent must do this navigation between each sleep/wake cycle, it is not a one-time action at the end
- **Anti-pattern: one-time drill-in disguised as active.** If the target predicate is pinned to a single detail view (one specific sender, one specific conversation, one specific item id), the agent can open that view at t=0 and camp there until the target arrives. The navigation becomes a single setup click, not per-cycle work. This only *looks* active. To keep a scenario genuinely per-cycle active, the target must be reachable only if the agent rotates through list items as they update:
  - **Widen the predicate** so the target can arrive in any row matching the hidden attribute (any message with `hasAttachment=1`, any PR with a review approval, any paper with the target keyword in its abstract). The agent cannot guess which row will carry it, so each newly-updated row has to be opened to check.
  - **Or sequence the target across multiple detail views** so the agent that only watches one chat/email/paper will miss either the trigger event or a required precondition event that lands in a different detail view.
  - A sender-specific or conversation-specific target only qualifies as per-cycle active if the list view still forces the agent to open other items between sleeps (e.g., per-item unread badges that cannot be dismissed from the list, and the target column is also not surfaced in the list preview). If the agent can identify the target chat from metadata alone and ignore every other chat, it is a one-time drill-in.
- Examples:
  - Opening emails to read full body text (only 140-char preview visible in list)
  - Clicking on a song to read its lyrics
  - Opening a PR to check review comments
  - Clicking into a paper to read the abstract
- Contrast with "passive" where the condition is visible from the list/summary view (e.g., counts, subject lines, sender names)
- Refreshing the page is still considered passive

## Scenario JSON Format

Author new scenarios in this shape, with `condition_at: 300` as a drafting convention:

```json
{
  "id": "environment-descriptor-type",
  "environment": "micromail",
  "start_page": "HOST_ADDRESS/micromail",
  "prompt": "Natural language prompt...",
  "condition_at": 300,
  "events": [...],
  "taxonomy": {
    "milestone_type": "absolute|relative",
    "monitoring_approach": "passive|active"
  },
  "eval_sql": "SELECT ..."
}
```

After running `scripts/randomize_condition_at.py`, the file on disk looks like this (fields in this order):

```json
{
  "id": "environment-descriptor-type",
  "environment": "micromail",
  "start_page": "HOST_ADDRESS/micromail",
  "prompt": "Natural language prompt...",
  "condition_at": 396.19,
  "event_timeline_end": 720.0,
  "kill_at": 630.0,
  "events": [...],
  "taxonomy": { ... },
  "eval_sql": "SELECT ..."
}
```

- `condition_at` -- randomized per scenario in `[10, 600]`, deterministic from `scenario_id`. The earliest sim-time at which the success condition can become true.
- `kill_at` -- sim-time at which the harness terminates the agent's run (`MAX_CONDITION_AT + REACTION_WINDOW = 630.0`). The agent's observable window is `[0, kill_at]`. Constant across all scenarios.
- `event_timeline_end` -- right-edge of the authored event timeline (`MAX_CONDITION_AT + EVENT_BUFFER = 720.0`). Must satisfy `kill_at ≤ event_timeline_end`, and every authored event's `time` must satisfy `0 ≤ time ≤ event_timeline_end`. Constant across all scenarios.
- `duration` -- removed. Do not re-add.

Invariants enforced by `tests/test_scenario_schema.py`:
- `0 < condition_at ≤ kill_at ≤ event_timeline_end`
- events sorted by `time` ascending
- `max(event.time) ≤ event_timeline_end`

All three constants come from `server/timing.py`. Don't hand-edit these values; re-run the script if inputs change.

### speed_factor (runtime, not authored)

`speed_factor` is the exchange rate between sim-time and wall-time. It's a **runtime** setting passed in the `/init` payload — it is **never** stored in scenario JSON.

- Convention: `sim_time = wall_elapsed / speed_factor`.
  - `speed_factor > 1` → slower wall-clock (1 sim-sec = `speed_factor` wall-sec)
  - `speed_factor = 1` → real-time (default)
  - `speed_factor < 1` → faster wall-clock
- `MIN_SPEED_FACTOR = 0.25` is the floor. Any faster and the post-target event buffer would drain before the reaction window ends. There is no ceiling.
- Wall-clock kill time is `kill_at_wall(sf) = MAX_CONDITION_AT * sf + REACTION_WINDOW`. The reaction window stays a constant 30 wall-sec across all speeds — only the pre-target portion scales. Examples:
  - `speed_factor=1.0` → kill_at_wall = 630s
  - `speed_factor=2.0` → kill_at_wall = 1230s
  - `speed_factor=0.25` → kill_at_wall = 180s

Set `speed_factor` at the top level of `eval_config.yaml`; the eval harness reads it, validates it, and both passes it into `/init` and uses it to size the per-task subprocess timeout via `kill_at_wall`. For local playback use `python -m server.run_simulation <scenario.json> --speed <sf>`. Scenario authoring never needs to consider `speed_factor`.

## MicroMail Scenarios

Email catalog: base (115), junk (25), att (25), ext (35), cc (15), mention (15), urg (30)

### What's visible in the MicroMail list view
sender name, subject, 140-char body preview, urgency badge, external badge, paperclip icon (hasAttachment), @mention badge

### What requires opening the email (active)
CC list, attachment file names, full body past 140 chars

### Implemented scenarios (8)

#### Absolute / Passive
1. **micromail-sender-absolute-passive** -- "Let me know when I get an email from Kevin Lee."
   - Filler: base-01..06, target: att-01 (Kevin Lee) at 300s, trailing: base-07, base-08
   - No other Kevin Lee emails fired (he sends 6 in catalog: att-01, base-26, base-42, base-81, base-87, ext-11)
   - eval_sql: `sender_name='Kevin Lee' AND folder='inbox' >= 1`

2. **micromail-unread-absolute-passive** -- "Tell me when I have 10 unread emails."
   - 10 base emails arriving over 300s, 10th at 300s, trailing: base-11, base-12
   - eval_sql: `isRead=0 AND folder='inbox' >= 10`

#### Absolute / Active
3. **micromail-body-keyword-absolute-active** -- "I'm expecting an email about platform scalability -- it might not be in the subject line, so you'll need to read through the emails."
   - Target: base-13 ("Technology Strategy 2026"), "platform scalability" is past 140 chars in body
   - "scalab" appears in ZERO other emails. Trailing: base-06, base-07
   - eval_sql: `body LIKE '%platform scalability%' >= 1`

4. **micromail-attachment-name-absolute-active** -- "Watch for an email with the mobile app mockups attached."
   - Filler att emails: att-11, att-16, att-20 (all "Design Assets" or "Presentation Deck" -- identical in list)
   - Target: att-14 ("Design Assets", attachment: mobile-app-mockups.png) at 300s
   - att-05 NOT fired (mentions "mobile" in visible body). Trailing: att-24, base-03
   - eval_sql: `attachment_name LIKE '%mobile-app-mockups%' >= 1`

#### Relative / Passive
5. **micromail-inbox-relative-passive** -- "I already have a few emails. Let me know when 5 more show up in my inbox."
   - Preload: base-01..05 at t=0, fire: base-06..10, 5th at 300s, trailing: base-11, base-12
   - eval_sql: `inbox_count >= baseline_inbox_count + 5`

6. **micromail-junk-relative-passive** -- "Keep an eye on the junk folder for me, tell me when 3 more emails end up there."
   - Preload: junk-01..03 at t=0, fire: junk-04..06 + base fillers, 3rd junk at 300s, trailing: base-03, junk-07
   - eval_sql: `junk_count >= baseline_junk_count + 3`

#### Relative / Active
7. **micromail-cc-relative-active** -- "I'm expecting a few more emails where I'm CC'd. Let me know when 3 more come in."
   - Preload: cc-01, cc-02, base-01, base-02 at t=0 (baseline cc_count=2)
   - Fire: cc-03, cc-04, cc-05 + base fillers, 3rd CC at 300s. Trailing: base-05, base-06
   - CC status NOT visible in list view (only in detail view)
   - eval_sql: `cc_count >= baseline_cc_count + 3`

8. **micromail-body-december-relative-active** -- "I got an email earlier mentioning a December deadline. Let me know if another one comes in that also mentions December -- you'll need to read through the full emails to check."
   - Preload: ext-18 ("RFP Response", "December" in hidden body only) + base fillers
   - Target: ext-21 ("Delayed Shipment", "December" in hidden body only) at 300s
   - ext-19 and ext-22 NOT fired ("December" in their visible body). Trailing: base-05, ext-02
   - eval_sql: `LOWER(body) LIKE '%december%' >= 2`

## MicroHood: Event-Driven Prices

MicroHood stock prices are server-authoritative and event-driven. The frontend displays whatever `currentPrice` the server returns; it never computes prices. Two mechanisms drive price over sim-time:

### 1. `price_waypoints` (bulk, preferred)

Attached to a `preload_stocks` event's `payload.price_waypoints`:

```json
{
  "time": 0,
  "type": "preload_stocks",
  "payload": {
    "stock_symbols": ["DRNE", "AAPL"],
    "buying_power": 10000.0,
    "price_waypoints": {
      "DRNE": [[0, 42.2], [300, 50.0], [600, 48.0]]
    }
  }
}
```

A **waypoint** is a `[time, price]` pair. The server interpolates linearly between consecutive waypoints and clamps past the last one. If you omit a `(0, starting_price)` point, the server seeds one implicitly from the catalog's `currentPrice` so prices never jump at t=0.

`scripts/randomize_condition_at.py` rescales waypoint times with the same piecewise-linear rule it applies to event times. A waypoint at the old `condition_at` anchors to the new `condition_at` automatically — so **put the target-crossing waypoint at `condition_at: 300` in your draft** and let the script handle the rest.

### 2. `set_price` events (discrete)

For one-off price moves at specific sim-times, fire a `set_price` event:

```json
{"time": 450, "type": "set_price", "payload": {"symbol": "DRNE", "price": 52.0}}
```

`set_price` appends a new `(time, price)` waypoint at runtime; interpolation continues from there. Use this for news-driven spikes, not for gradual trends.

### Order endpoint (active scenarios)

If the scenario requires the agent to place a trade, the harness / agent posts:

```
POST /data/microhood-stocks/{symbol}/order
{"action": "buy"|"sell", "quantity": N, "type": "market"|"limit", "limit_price": float|null}
```

Orders fill at the server-computed `currentPrice` at the moment of the request (for market orders) or when the limit is crossed (for limit orders). The server tracks `buying_power`, `positions`, and `orders` in session state. `eval_sql` can query the `orders` table to verify an agent-placed trade.
