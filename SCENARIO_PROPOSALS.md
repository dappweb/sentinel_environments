# Scenario Proposals

## MicroChat

### MicroChat inventory

**1. Endpoints exposed (from `server/server.py`)**
- `GET  /data/microchat-teams` — `{teams: [...]}` (server.py:653-656)
- `GET  /data/microchat-messages?conversation_id=<opt>` — `{messages: [...]}` (server.py:659-671)
- `GET  /data/microchat-conversations` — `{conversations: [...]}` with derived `unreadCount`, `lastMessage.content/senderName/timestamp`, `isPinned`, `isMuted` (server.py:674-710)
- `GET  /data/microchat-calls` — `{calls: [...]}` (server.py:713-716)
- `POST /data/microchat-messages/{id}/read` (server.py:719-725)
- `POST /data/microchat-messages/{id}/react` (server.py:728-746)
- `POST /data/microchat-conversations/{id}/mute` (server.py:749-755)
- `POST /data/microchat-conversations/{id}/pin` (server.py:758-764)

Frontend hook `frontend/src/hooks/useMicrochatData.ts` polls `/data/microchat-messages` + `/data/microchat-conversations` every 1s (lines 144-165); teams/calls load once (lines 125-142).

**2. Event types dispatched (`server/handlers/microchat.py`)**
- `preload_messages` — line 140 (also accepts `payload.call_ids`, and seeds conversations + teams from catalogs, then captures baseline at line 181)
- `new_message` — line 183
- `new_call` — line 192

No other event types are handled.

**3. SQLite tables + columns materialized (`server/handlers/microchat.py:208-257`)**
- `messages(id, conversationId, senderId, content, isUrgent, mentionsMe, hasAttachment)` — CREATE at line 210, INSERT at line 214.
- `message_states(message_id, isRead)` — CREATE 226, INSERT 227.
- `conversations(id, name, type, teamId)` — CREATE 232, INSERT 233. `teamId` is never set by the handler and is always NULL (no assignment anywhere).
- `conversation_states(conversation_id, isPinned, isMuted)` — CREATE 238, INSERT 239.
- `teams(id, name)` — CREATE 247, INSERT 248.
- `calls(id, callerId, missed, duration)` — CREATE 253, INSERT 254. `callerId` is always NULL (handler uses `c.get("callerId")`, but `_build_call_row` writes `userId`, not `callerId` — minor handler bug, not load-bearing for proposals below).

**4. Baselines written to `session_meta` at `/init`** — all emitted by `compute_current_metrics` (microchat.py:100-130) and promoted to `session_meta` rows keyed `baseline_<name>` by `server.py:532-535`:
- `baseline_unread_count` (microchat.py:124)
- `baseline_unread_conversation_count` (microchat.py:125)
- `baseline_mention_count` (microchat.py:126) — counts **unread** messages with `mentionsMe=True`
- `baseline_urgent_count` (microchat.py:127) — counts **unread** messages with `isUrgent=True`
- `baseline_missed_call_count` (microchat.py:128)
- `baseline_total_message_count` (microchat.py:129)

All six baselines are available for relative scenarios. No handler change is required for any of the proposals below.

**5. Current scenario distribution (`scenarios/microchat/*.json`, excluding `dev.json`)**
- passive-absolute: 1 — `microchat-unread-absolute-passive` (target: `unread` count ≥ 10)
- passive-relative: 0
- active-absolute: 1 — `microchat-unread-absolute-active` (target: keyword in a specific DM; target noun is labelled `unread` in the id but the eval_sql is a content-LIKE search — see critique below)
- active-relative: 0

Gaps: 1 new passive-absolute, 2 new passive-relative, 1 new active-absolute, 2 new active-relative = **6 proposals**.

List-view observability (cross-checked against `frontend/src/environments/MicroChat.tsx:3539-3668` + `server/server.py:694-710`):
- Passive (visible in list view): per-conversation `unreadCount` badge, `name`, `lastMessage.content` (full text, CSS-truncated to one line), `isPinned` star. Calls tab shows each call with a `Missed` label (MicroChat.tsx:3159-3168).
- Active (requires opening a conversation): per-message `isUrgent` styling, `mentionsMe` markers, attachment paperclip + attachment filenames, reactions, full content of non-last messages. None of these are surfaced in the conversations endpoint response.

---

### missed-calls-absolute-passive
- **Scenario ID**: microchat-missed-calls-absolute-passive
- **Filename**: scenarios/microchat/missed-calls-absolute-passive.json
- **Cell**: passive-absolute
- **Monitored target**: missed calls
- **Why this cell**: absolute (fixed threshold = 3); passive (the Calls tab renders each call's `missed` flag as a "Missed" label — MicroChat.tsx:3162 — so the agent can count without opening any call).
- **User-facing prompt**: "Keep an eye on my calls tab and tell me when I've missed 3 calls."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_messages — message_ids=[dm-03, dm-11, dm-15, dm-29, dm-33, dm-39, grp-04, grp-12, grp-20, mtg-03], call_ids=[call-in-02, call-out-01] (no preloaded missed calls → baseline_missed_call_count=0, agent can't pre-satisfy)
  - t=75: new_call — call-in-04 (non-missed distractor, Ivan)
  - t=135: new_call — call-missed-02 (Ivan, missed #1)
  - t=195: new_call — call-out-04 (non-missed distractor, Michael)
  - t=235: new_call — call-missed-03 (Olivia, missed #2)
  - t=300: new_call — call-missed-04 (Edward, missed #3) ← target crossing 3
  - t=380: new_call — call-out-03 (non-missed trailing, Aaron)
  - t=460: new_call — call-missed-05 (Aaron, trailing missed)
  - t=540: new_call — call-missed-group-01 (Design Review, trailing)
  - event_timeline_end: 720.0 (from `server/timing.py:47` `EVENT_TIMELINE_END`; populated by `scripts/randomize_condition_at.py`)
- **Catalog IDs claimed**:
  - Messages (all preload-only, do not affect calls eval): dm-03, dm-11, dm-15, dm-29, dm-33, dm-39, grp-04, grp-12, grp-20, mtg-03 (all exist in `data/catalogs/microchat/messages.jsonl`; all have `isRead: true` in that file so they don't touch unread metrics either).
  - Calls: call-in-02 (non-missed), call-out-01 (non-missed), call-in-04 (non-missed), call-missed-02, call-missed-03, call-missed-04 (target), call-out-04 (non-missed), call-out-03 (non-missed), call-missed-05, call-missed-group-01 — all exist in `data/catalogs/microchat/calls.jsonl`. Scanned against `scenarios/microchat/unread-absolute-passive.json` (uses call-in-01, call-in-02, call-out-01) and `scenarios/microchat/unread-absolute-active.json` (uses call-in-01, call-in-02, call-out-01, call-missed-01, call-group-01). Overlap: call-in-02 and call-out-01 as harmless non-missed filler — acceptable reuse (they are pure context, not target-critical).
- **Materialized DB fields eval_sql reads**: `calls.missed` — written by `microchat.py:256`.
- **Draft eval_sql**: `SELECT (SELECT COUNT(*) FROM calls WHERE missed=1) >= 3`
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: This is the only new passive-absolute proposal (the other passive-absolute slot is filled by shipped `microchat-unread-absolute-passive`); the targets — `missed-calls` vs `unread` — are unrelated metrics sourced from different catalogs (`calls.jsonl` vs `messages.jsonl`).
- **Distinctness from existing scenarios**: Neither shipped scenario checks calls at all — both query `message_states` / `messages`. No collision.

---

### unread-conversations-relative-passive
- **Scenario ID**: microchat-unread-conversations-relative-passive
- **Filename**: scenarios/microchat/unread-conversations-relative-passive.json
- **Cell**: passive-relative
- **Monitored target**: count of conversations carrying at least one unread message
- **Why this cell**: relative (baseline + 3 from `baseline_unread_conversation_count`, microchat.py:125); passive (each `ApiConversation` row surfaces `unreadCount` in the sidebar — MicroChat.tsx:3539 `isUnread = conversation.unreadCount > 0` / line 3664-3668 — so the agent can count unread-badged rows without opening any chat).
- **User-facing prompt**: "Let me know when unread messages show up in 3 more of my chats than right now. Just watch the sidebar, please don't open any of the conversations. I don't want people seeing 'seen' on their messages before I've had a chance to actually read them."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_messages — message_ids=[dm-18, dm-24, dm-03, dm-11, dm-29, dm-33, dm-39, grp-04, grp-08, grp-12, grp-16, mtg-03]; no call_ids. Only dm-18 (direct-michael, no `isRead` → unread) and dm-24 (direct-edward, no `isRead` → unread) count toward unread convos → **baseline_unread_conversation_count = 2**. All other preloads are `isRead: true` in `messages.jsonl`.
  - t=75: new_message — grp-02 (group-platform-team; unread → convo #3)
  - t=150: new_message — dm-31 (direct-carlos; unread → convo #4)
  - t=220: new_message — dm-21 (direct-edward; unread, but direct-edward is already counted → **distractor, count stays at 4**)
  - t=300: new_message — mtg-04 (meeting-design-review; unread → convo #5 = baseline+3) ← target
  - t=380: new_message — grp-14 (group-external-partners; trailing, convo #6)
  - t=460: new_message — dm-37 (direct-ivan; trailing — direct-ivan had only the read dm-39 preloaded, so it joins the unread set)
  - t=540: new_message — mtg-10 (meeting-sprint-retro; trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - Preload: dm-18 (direct-michael, no isRead), dm-24 (direct-edward, no isRead), dm-03/dm-11/dm-29/dm-33/dm-39 (all `isRead:true`, used as read padding per catalog lines 3/11/29/33/39), grp-04/grp-08/grp-12/grp-16 (`isRead:true`, lines 44/48/52/56), mtg-03 (`isRead:true`, line 93).
  - Fires: grp-02 (user009, group-platform-team — line 42), dm-31 (direct-carlos — line 31), dm-21 (direct-edward — line 21), mtg-04 (meeting-design-review — line 94), grp-14 (group-external-partners — line 54), dm-37 (direct-ivan — line 37), mtg-10 (meeting-sprint-retro — line 100). All exist in `data/catalogs/microchat/messages.jsonl`.
  - Scanned: `scenarios/microchat/unread-absolute-passive.json` (uses dm-03, dm-05, dm-09, dm-11, dm-15, dm-17, dm-22, dm-23, dm-28, dm-29, dm-01, dm-02, dm-04, dm-06, dm-07, grp-04, grp-08, grp-12, grp-16, grp-20, grp-01, grp-05, dm-13, grp-09, dm-19, grp-13, dm-25, grp-17, dm-30, grp-21); `scenarios/microchat/unread-absolute-active.json` (uses dm-03, dm-05, dm-09, dm-11, dm-15, dm-17, dm-22, dm-23, dm-28, dm-29, dm-01, dm-02, dm-04, dm-06, dm-08, dm-10, dm-12, dm-14, dm-16, grp-04, grp-08, grp-12, grp-16, grp-20, grp-24, grp-28, grp-32, grp-01, urg-dm-01, mention-grp-01, dm-07, grp-05, urg-mention-dm-01, att-dm-08, att-dm-01, dm-13, grp-09, mention-grp-13). Overlap is limited to read filler (dm-03/dm-11/dm-29/grp-04/grp-08/grp-12/grp-16) which is pure context; every unread-bearing ID (dm-18, dm-24, grp-02, dm-31, dm-21, mtg-04, grp-14, dm-37, mtg-10) is new.
- **Materialized DB fields eval_sql reads**: `messages.conversationId` + `message_states.isRead` (microchat.py:210-229); baseline from `session_meta(key, value)` populated by `server.py:532-535`.
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(DISTINCT m.conversationId)
          FROM messages m
          JOIN message_states ms ON m.id = ms.message_id
          WHERE ms.isRead = 0)
         >= (SELECT CAST(value AS INTEGER) FROM session_meta
             WHERE key = 'baseline_unread_conversation_count') + 3
  ```
- **Handler dependencies**: No handler changes required. `baseline_unread_conversation_count` is already emitted (`compute_current_metrics`, microchat.py:125) and promoted to `session_meta` by the evaluator harness (`server.py:532-535`).
- **Distinctness from paired target**: Counts **distinct conversations** with any unread, not the **total unread message count** nor missed calls. `missed-calls-relative-passive` (below) reads `calls.missed` — a disjoint table.
- **Distinctness from existing scenarios**: Shipped `unread-absolute-passive` counts unread **messages** (rows in `message_states`), not unread **conversations** (distinct `conversationId`); different metric, different prompt.

---

### missed-calls-relative-passive
- **Scenario ID**: microchat-missed-calls-relative-passive
- **Filename**: scenarios/microchat/missed-calls-relative-passive.json
- **Cell**: passive-relative
- **Monitored target**: missed calls, relative to baseline
- **Why this cell**: relative (baseline + 3 from `baseline_missed_call_count`, microchat.py:128); passive (Calls tab surfaces the `missed` flag on each row, MicroChat.tsx:3162-3168).
- **User-facing prompt**: "I've already missed a couple of calls this morning — tell me when 3 more come in."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_messages — message_ids=[dm-03, dm-11, dm-33], call_ids=[call-missed-01, call-missed-group-02, call-in-02, call-out-01] → baseline_missed_call_count = **2** (call-missed-01, call-missed-group-02).
  - t=80: new_call — call-out-02 (non-missed distractor, Edward)
  - t=140: new_call — call-missed-02 (Ivan, missed #1 after baseline)
  - t=210: new_call — call-in-04 (non-missed distractor, Ivan)
  - t=260: new_call — call-missed-03 (Olivia, missed #2 after baseline)
  - t=300: new_call — call-missed-04 (Edward, missed #3 = baseline+3) ← target
  - t=370: new_call — call-out-03 (non-missed, trailing)
  - t=450: new_call — call-missed-05 (Aaron, trailing missed)
  - t=530: new_call — call-missed-group-01 (Design Review, trailing missed)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - Messages (read-only context): dm-03, dm-11, dm-33 (all `isRead:true` in messages.jsonl).
  - Calls: call-missed-01 (baseline), call-missed-group-02 (baseline), call-in-02 (non-missed preload), call-out-01 (non-missed preload), call-out-02 (non-missed), call-missed-02, call-in-04 (non-missed), call-missed-03, call-missed-04 (target), call-out-03 (non-missed), call-missed-05 (trailing), call-missed-group-01 (trailing). All exist in `data/catalogs/microchat/calls.jsonl` (lines 1-20).
  - Scanned: shipped scenarios' call_ids are call-in-01/02, call-out-01, call-missed-01, call-group-01. Overlap: call-missed-01 (I use it as a baseline missed call), call-in-02/call-out-01 (non-missed preload). Reuse is intentional — these are context, not the target. All new missed calls (call-missed-02..05, call-missed-group-01..02) are fresh targets.
- **Materialized DB fields eval_sql reads**: `calls.missed` (microchat.py:256); `session_meta(key, value)`.
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(*) FROM calls WHERE missed=1)
         >= (SELECT CAST(value AS INTEGER) FROM session_meta
             WHERE key = 'baseline_missed_call_count') + 3
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: `unread-conversations-relative-passive` reads `messages/message_states` (text chat surface); this one reads `calls` (voice/video surface). No shared columns.
- **Distinctness from existing scenarios**: Neither shipped scenario touches the calls table. No overlap.

---

### attachment-absolute-active
- **Scenario ID**: microchat-attachment-absolute-active
- **Filename**: scenarios/microchat/attachment-absolute-active.json
- **Cell**: active-absolute
- **Monitored target**: the first incoming message carrying a file in any chat, sender-agnostic and chat-agnostic
- **Why this cell**: absolute (fixed predicate: at least one `messages.hasAttachment=1` row exists). Active per poll cycle because (a) the conversations-list endpoint at server.py:704-708 exposes only `lastMessage.content/senderName/timestamp`, with no `hasAttachment` field, and the paperclip is rendered only inside the opened conversation at MicroChat.tsx:2051-2080; (b) the target is deliberately not pinned to a specific sender or conversation, so the agent cannot open one chat at t=0 and camp there. Each new-message arrival lights an unread badge on a different row in the list, and the agent has to open whichever chat just updated to check whether that message is a file. Across the timeline, this forces navigation into 4 pre-target distractor chats (DM, group, meeting, second DM) and at least one more on the target event, matching the per-cycle navigation rule in `SCENARIO_GEN.md`.
- **User-facing prompt**: "Let me know the moment someone sends me a file in any of my chats."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_messages, message_ids=[dm-03, dm-11, dm-23, dm-29, dm-33, dm-39, grp-04, grp-08, grp-16, mtg-03, mtg-14], call_ids=[call-in-02]. All preload messages are `isRead:true` and none has `hasAttachment:true` in messages.jsonl (verified by grep across the listed IDs). Preload is pure read-state padding across several chats, so the conversation list looks populated but the predicate is strictly false at t=0.
  - t=60: new_message, dm-35 (direct-carlos, non-attachment distractor). Agent must open direct-carlos to verify there is no paperclip.
  - t=120: new_message, grp-22 (group-backend-guild, non-attachment distractor). Agent must open group-backend-guild next.
  - t=180: new_message, mtg-20 (meeting-architecture-review, non-attachment distractor). Third different chat.
  - t=240: new_message, dm-38 (direct-ivan, non-attachment distractor). Fourth different chat.
  - t=300: new_message, att-dm-04 (direct-edward, sender=user005, `hasAttachment=1`, content "Here are the final mockups for the settings page"). Target. Fifth different chat.
  - t=370: new_message, grp-30 (group-devops, non-attachment trailing filler)
  - t=450: new_message, att-grp-04 (group-devops, `hasAttachment=1`, trailing; keeps eval true under a different sender and a group chat, so the predicate is robust past the target)
  - t=540: new_message, mtg-07 (meeting-all-hands, non-attachment trailing filler)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**: dm-03, dm-11, dm-23, dm-29, dm-33, dm-39, grp-04, grp-08, grp-16, mtg-03, mtg-14 (preload read-filler); dm-35, grp-22, mtg-20, dm-38 (pre-target distractors, four distinct conversations); att-dm-04 (target, user005, hasAttachment=1); grp-30, att-grp-04 (trailing, mixes non-attachment and a second attachment in a group chat); mtg-07 (trailing filler); call_ids: call-in-02. All verified present in messages.jsonl / calls.jsonl.
  - Scanned shipped scenarios for overlap: `scenarios/microchat/unread-absolute-passive.json` and `scenarios/microchat/unread-absolute-active.json`. Reused read-filler IDs (dm-03, dm-11, grp-04, grp-08, mtg-03) are pure context and safe to share. **Every attachment-bearing ID fired (att-dm-04, att-grp-04) is fresh.** No other `hasAttachment=1` message is fired before t=300, so att-dm-04 is strictly the first attachment delivery.
  - Fired distractors scanned for keyword confusion: dm-35 ("Quick thought on the data warehouse migration"), grp-22 ("I tested it yesterday, seeing 2x throughput improvement"), mtg-20 ("We'd need to handle replay and idempotency carefully"), dm-38 ("Can you verify the SSL cert renewal went through?"). None mention files, attachments, documents, mockups, or any paperclip-adjacent vocabulary, so the list-view `lastMessage.content` preview cannot leak the target.
- **Materialized DB fields eval_sql reads**: `messages.hasAttachment`, written by `microchat.py:217-220`.
- **Draft eval_sql**: `SELECT EXISTS(SELECT 1 FROM messages WHERE hasAttachment=1)`
- **Handler dependencies**: No handler changes required. Preload carries zero attachments, so the predicate is strictly future-dependent.
- **Distinctness from paired target**: The other active-absolute slot is filled by shipped `microchat-unread-absolute-active`, whose eval_sql is a `content LIKE '%payment processing service is down%'` keyword search in a single pinned conversation. This proposal checks the structural `hasAttachment` flag across all messages. Different column, different discovery pattern, and crucially this target is not pinned to any one chat, so it forces rotating navigation rather than one-time drill-in.
- **Distinctness from existing scenarios**: Shipped active reads `messages.content` + `conversationId`; this one reads `messages.hasAttachment`. No column overlap in the WHERE clause.

---

### mentions-relative-active
- **Scenario ID**: microchat-mentions-relative-active
- **Filename**: scenarios/microchat/mentions-relative-active.json
- **Cell**: active-relative
- **Monitored target**: unread @-mentions, relative to baseline
- **Why this cell**: relative (baseline + 3 from `baseline_mention_count`, microchat.py:126); active (the conversations list endpoint does not surface `mentionsMe` per message — server.py:704-708 only returns `lastMessage.content/senderName/timestamp`; the `@you` string is rendered per-message inside the opened conversation, and summing across conversations requires visiting each one).
- **User-facing prompt**: "I'm getting a lot of @ mentions today — tell me when 3 more come in than I already have."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_messages — message_ids=[mention-dm-01, mention-grp-02, dm-03, dm-11, dm-33, grp-04, grp-08, mtg-03]; no call_ids. mention-dm-01 (direct-aaron, mentionsMe=true, no isRead) and mention-grp-02 (group-frontend-crew, mentionsMe=true, no isRead) are the two baseline unread mentions → **baseline_mention_count = 2**. The rest are `isRead:true` non-mention filler (do not contribute).
  - t=75: new_message — dm-37 (direct-ivan, non-mention distractor)
  - t=140: new_message — mention-dm-03 (direct-michael, mentionsMe=true, unread → mention #3)
  - t=205: new_message — grp-26 (group-ux-research, non-mention distractor)
  - t=250: new_message — mention-grp-03 (group-q4-planning, mentionsMe=true → mention #4)
  - t=300: new_message — mention-dm-05 (direct-olivia, mentionsMe=true → mention #5 = baseline+3) ← target
  - t=380: new_message — mention-dm-06 (direct-carlos, trailing mention)
  - t=460: new_message — grp-34 (non-mention, trailing distractor)
  - t=540: new_message — mtg-20 (non-mention, trailing distractor)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - mention-dm-01 (direct-aaron, line 136), mention-grp-02 (group-frontend-crew, line 147), dm-03 / dm-11 / dm-33 / grp-04 / grp-08 / mtg-03 (read filler), dm-37 (line 37), mention-dm-03 (direct-michael, line 138), grp-26 (group-ux-research, line 66), mention-grp-03 (group-q4-planning, line 148), mention-dm-05 (direct-olivia, line 140), mention-dm-06 (direct-carlos, line 141), grp-34 (group-mobile-team, line 74), mtg-20 (meeting-architecture-review, line 110). All exist in messages.jsonl.
  - Scanned shipped scenarios: shipped active uses mention-grp-01 and mention-grp-13; shipped passive uses neither. **Every mention-* ID I claim (mention-dm-01/03/05/06, mention-grp-02/03) is fresh.** Non-mention filler overlaps with shipped read-padding (dm-03/dm-11/grp-04/grp-08/mtg-03) but that is pure context.
  - Filler scan: none of dm-37/grp-26/grp-34/mtg-20 contain `@you` or `@` as a mention marker — verified by grepping the catalog. So list-view `lastMessage.content` previews cannot accidentally reveal a mention.
- **Materialized DB fields eval_sql reads**: `messages.mentionsMe` + `message_states.isRead` (microchat.py:210-229); baseline from `session_meta`.
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(*) FROM messages m
          JOIN message_states ms ON m.id = ms.message_id
          WHERE m.mentionsMe = 1 AND ms.isRead = 0)
         >= (SELECT CAST(value AS INTEGER) FROM session_meta
             WHERE key = 'baseline_mention_count') + 3
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: `urgent-relative-active` filters on `messages.isUrgent`; this one filters on `messages.mentionsMe`. Different column, different catalog subset (mention-* vs urg-*), different prompt phrasing.
- **Distinctness from existing scenarios**: Both shipped scenarios either count total unreads (passive) or keyword-match a specific message (active). Neither conditions on `mentionsMe`.

---

### urgent-relative-active
- **Scenario ID**: microchat-urgent-relative-active
- **Filename**: scenarios/microchat/urgent-relative-active.json
- **Cell**: active-relative
- **Monitored target**: unread urgent messages, relative to baseline
- **Why this cell**: relative (baseline + 3 from `baseline_urgent_count`, microchat.py:127); active (`isUrgent` is not exposed on conversation rows — server.py:704-708 — and is only rendered when a conversation is opened; accurate counting across all chats requires the agent to visit each unread conversation).
- **User-facing prompt**: "I've already got a couple of urgent pings this morning — let me know when 3 more urgent messages arrive."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_messages — message_ids=[urg-dm-03, urg-grp-03, dm-03, dm-11, dm-33, grp-04, grp-08, mtg-03]; no call_ids. urg-dm-03 (direct-michael, isUrgent=true, no isRead) and urg-grp-03 (group-product-launch, isUrgent=true, no isRead) → **baseline_urgent_count = 2**. Read filler is non-urgent.
  - t=80: new_message — dm-38 (non-urgent distractor)
  - t=145: new_message — urg-dm-04 (direct-edward, isUrgent=true → urgent #3)
  - t=215: new_message — grp-26 (non-urgent distractor)
  - t=265: new_message — urg-grp-05 (group-frontend-crew, isUrgent=true → urgent #4)
  - t=300: new_message — urg-dm-05 (direct-olivia, isUrgent=true → urgent #5 = baseline+3) ← target
  - t=380: new_message — urg-dm-06 (direct-carlos, trailing urgent)
  - t=460: new_message — grp-46 (group-security-team, non-urgent trailing)
  - t=540: new_message — mtg-22 (meeting-incident-response, non-urgent trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - urg-dm-03 (direct-michael, line 118), urg-grp-03 (group-product-launch, line 128), dm-03/dm-11/dm-33/grp-04/grp-08/mtg-03 (read filler), dm-38 (line 38), urg-dm-04 (direct-edward, line 119), grp-26 (group-ux-research, line 66), urg-grp-05 (group-frontend-crew, line 130), urg-dm-05 (direct-olivia, line 120), urg-dm-06 (direct-carlos, line 121), grp-46 (group-security-team, line 86), mtg-22 (meeting-incident-response, line 112). All exist in messages.jsonl.
  - Scanned shipped scenarios: shipped active uses urg-dm-01 and urg-mention-dm-01; shipped passive uses no urg-* IDs. **Every urg-* ID I claim (urg-dm-03/04/05/06, urg-grp-03/05) is fresh.** Collision with shipped mention-relative-active's grp-26 is avoided — grp-26 appears only in this scenario as far as existing .json files go (grep `grp-26` over `scenarios/microchat/*.json` → no matches).
  - Filler scan: dm-38/grp-26/grp-46/mtg-22 do not start with or contain "URGENT"/"Critical"/"ASAP" — verified. Their `content` is routine work chatter, which should not trip an agent into prematurely reporting an urgent arrival from the list preview.
- **Materialized DB fields eval_sql reads**: `messages.isUrgent` + `message_states.isRead` (microchat.py:210-229); baseline from `session_meta`.
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(*) FROM messages m
          JOIN message_states ms ON m.id = ms.message_id
          WHERE m.isUrgent = 1 AND ms.isRead = 0)
         >= (SELECT CAST(value AS INTEGER) FROM session_meta
             WHERE key = 'baseline_urgent_count') + 3
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: Pairs with `mentions-relative-active` via a different column (`isUrgent` vs `mentionsMe`), a different catalog subset (urg-* vs mention-*), and a different user-facing concept (escalation vs direct addressing).
- **Distinctness from existing scenarios**: Shipped active already fires one `urg-dm-01` but as a filler for a content-LIKE eval — it never counts urgents. Shipped passive does not touch urgency. No cross-scenario eval overlap.

---

### Critique of existing scenarios

- **`microchat-unread-absolute-active`** — the scenario id asserts `unread` as the target noun, but the `eval_sql` (`content LIKE '%payment processing service is down%'`) actually checks for a specific **message-content keyword** in `direct-aaron`. That is a different taxonomy target from shipped `microchat-unread-absolute-passive` (which truly counts unreads). The file should be renamed to something like `microchat-message-keyword-absolute-active` (and the prompt already reads like a content-keyword task, so no prompt rewrite needed). Today the repo reads as if both shipped scenarios target `unread`, which is misleading and makes the taxonomy matrix look worse than it is. My proposals above treat the slot as already occupied by a `message-keyword` active-absolute target, which is why my new active-absolute proposal picks a structurally different predicate (`attachment`) rather than another content-LIKE variant.
- **`microchat-unread-absolute-active` eval_sql coverage** — the query does not pin down the sender, only the conversation (`conversationId='direct-aaron'`). That's arguably fine because only Aaron Chen speaks in direct-aaron alongside user000, but if the catalog ever added another participant to direct-aaron the eval would silently accept user000's own message with the same text. Not critical, but a follow-up PR could tighten it to `AND senderId='user001'`.
- **`microchat-unread-absolute-active` is a one-time drill-in, not per-cycle active**. The predicate pins the target to a single sender (or at least a single conversation) with a `content LIKE` keyword match, so an agent can open `direct-aaron` at t=0 and camp on that one detail view until the matching message arrives. Navigation becomes a one-time setup action rather than something the agent must repeat every poll cycle, which only superficially satisfies the active taxonomy. Per `SCENARIO_GEN.md`'s "What Active Means" rule, active scenarios must force the agent to navigate into *different* detail views between sleep/wake cycles. Fix options at the authoring layer: (a) widen the predicate so the target can arrive in any chat (the approach this proposal file now takes for `attachment-absolute-active`); (b) sequence the target across several conversations so only the agent that rotates between them can observe it in time. Either route keeps the fix purely authoring-level with no handler change.
- **`microchat-unread-absolute-passive` event timeline** — the "10th unread at condition_at" is `dm-19`, but `dm-19` is a brand-new conversation (direct-edward) whose per-conversation unread badge goes 0 to 1 simultaneously. That works for a count-based eval, but it means the passive agent watching unread counts cannot distinguish the target from any other distractor event that also lands an unread, it just has to count to ten. Fine as authored; mentioning it so future passive-absolute authors know the pattern.
- **`ms.isRead = 0` in relative-active evals is self-sabotaging** — the `mentions-relative-active` and `urgent-relative-active` proposals above currently condition on `ms.isRead = 0` to count unread mentions/urgents. But `handleSelectConversation` (MicroChat.tsx:890-897) bulk-fires `POST /data/microchat-messages/{id}/read` on every unread message in a conversation the moment the agent clicks to open it. Since both scenarios are *active* (the taxonomy requires the agent to open chats to observe per-message `mentionsMe` / `isUrgent`), an agent that behaves correctly will flip those messages to `isRead=1` and silently drop the count below `baseline + 3`. Fix: drop `ms.isRead = 0` from both eval_sqls and count all delivered mentions/urgents monotonically, backed by two new baseline keys written from `compute_current_metrics` at microchat.py:100-130:
    ```python
    "mention_total": sum(1 for m in messages if m.get("mentionsMe", False)),
    "urgent_total": sum(1 for m in messages if m.get("isUrgent", False)),
    ```
  Those promote to `baseline_mention_total` / `baseline_urgent_total` via the existing `server.py:532-535` loop. The same read-state non-monotonicity also affects shipped `microchat-unread-absolute-passive` (count of unread messages), though there the passive taxonomy can lean on the prompt-level "don't open them, I don't want 'seen' to show" framing used by `unread-conversations-relative-passive` above.

---

## MicroDin

### MicroDin inventory

**1. Endpoints exposed (from `server/server.py`)**
- `GET  /data/microdin-posts` — `{posts: [...]}` (server.py:771)
- `GET  /data/microdin-connections` — `{connections: [...]}` (server.py:781)
- `GET  /data/microdin-conversations` — `{conversations: [...]}` with derived `unreadCount`, `lastMessage` (server.py:791)
- `GET  /data/microdin-notifications` — `{notifications: [...]}` (server.py:824)
- `GET  /data/microdin-jobs` — `{jobs: [...]}` (server.py:834)
- `GET  /data/microdin-companies` — `{companies: [...]}` (server.py:905)
- `GET  /data/microdin-network` — `{users: [...]}` (server.py:910)
- `POST /data/microdin-posts/{post_id}/like` (server.py:844)
- `POST /data/microdin-connections/{connection_id}/accept` (server.py:859)
- `POST /data/microdin-connections/{connection_id}/ignore` (server.py:868)
- `POST /data/microdin-conversations/{conversation_id}/read` (server.py:877)
- `POST /data/microdin-notifications/{notification_id}/read` (server.py:887)
- `POST /data/microdin-jobs/{job_id}/apply` (server.py:896)

Frontend hook `frontend/src/hooks/useMicrodinData.ts` polls `/data/microdin-posts`, `/data/microdin-connections`, `/data/microdin-conversations`, `/data/microdin-notifications`, `/data/microdin-jobs` every 1s (lines 194-215); `/data/microdin-network`, `/data/microdin-companies`, `/data/microdin-config` load once (lines 143-191).

**2. Event types dispatched (`server/handlers/microdin.py`)**
- `preload_posts` — line 269 (seeds posts, connections, conversations, notifications, jobs from `payload.{post_ids, connection_ids, conversation_ids, notification_ids, job_ids}`, then captures baseline at line 330)
- `new_post` — line 332
- `new_connection` — line 339
- `new_message` — line 346 (payload: `conversation_id`, `message_id`; appends one message to the named conversation)
- `new_notification` — line 366
- `new_job` — line 373

No other event types are handled.

**3. SQLite tables + columns materialized (`server/handlers/microdin.py:390-451`)**
- `posts(id, authorId, content, likes, shares)` — CREATE 392, INSERT 395. `content` is the full post body.
- `post_states(post_id, isLiked)` — CREATE 399, INSERT 401.
- `connections(id, userId, name, mutualConnections)` — CREATE 405, INSERT 407.
- `connection_states(connection_id, status)` — CREATE 411, INSERT 413. `status` is one of `pending`, `accepted`, `ignored`.
- `messages(id, conversationId, senderId, content)` — CREATE 417, INSERT 419.
- `message_states(message_id, isRead)` — CREATE 423, INSERT 425.
- `notifications(id, type, actorId, content)` — CREATE 429, INSERT 431.
- `notification_states(notification_id, isRead)` — CREATE 435, INSERT 437.
- `jobs(id, title, companyId, location)` — CREATE 441, INSERT 443. **No `description` or `requirements` column** — active scenarios keyed on job content must eval by `job_id` via `isApplied`, not by `content LIKE` on the jobs table.
- `job_states(job_id, isApplied)` — CREATE 447, INSERT 449.

**4. Baselines written to `session_meta` at `/init`** — all emitted by `compute_current_metrics` (microdin.py:213-259) and promoted to `session_meta` rows keyed `baseline_<name>`:
- `baseline_post_count` (microdin.py:252)
- `baseline_pending_connection_count` (microdin.py:253)
- `baseline_unread_message_count` (microdin.py:254)
- `baseline_unread_conversation_count` (microdin.py:255)
- `baseline_unread_notification_count` (microdin.py:256)
- `baseline_job_count` (microdin.py:257)
- `baseline_applied_job_count` (microdin.py:258)

All seven baselines are available for relative scenarios. No handler change is required for any of the proposals below.

**5. Current scenario distribution (`scenarios/microdin/*.json`, excluding `dev.json`)**
- passive-absolute: 2 — `microdin-connections-absolute-passive` (pending connections >= 15) and `microdin-jobs-absolute-passive` (job count >= 8). Filled.
- passive-relative: 0
- active-absolute: 1 — `microdin-notifications-absolute-active`. The id says `notifications` but the prompt and eval target a specific `jobs` row (`job-6` Kubernetes) — see critique below.
- active-relative: 0

Gaps: 1 new active-absolute, 2 new passive-relative, 2 new active-relative = **5 proposals**.

List-view observability (cross-checked against `frontend/src/environments/MicroDin.tsx` + the five polled endpoints):
- Passive (visible without drilldown): full post body in the home feed (MicroDin.tsx:1407 renders `{post.content}` with no truncation class), per-connection `status` label on the network page, `unreadCount` badge plus `lastMessage` preview per conversation row, each notification row with actor + text in the notifications tab, and each job card showing title / company / location / applicants / Applied-badge (MicroDin.tsx:2631-2651).
- Active (requires opening a detail view): job `description` and `requirements` (first 4 entries) render only when the job card is expanded (MicroDin.tsx:2691-2704); the rest of a conversation's messages (beyond the `lastMessage` preview) load only when the conversation thread is opened; full post comment threads load on post click. Critically for scenario design, jobs' `description` and `requirements` are **not** materialized to SQLite, so any keyword-in-job-content predicate must be evaluated as an `isApplied` check on a specific `job_id`.

---

### documentation-absolute-active
- **Scenario ID**: microdin-documentation-absolute-active
- **Filename**: scenarios/microdin/documentation-absolute-active.json
- **Cell**: active-absolute
- **Monitored target**: a new Technical Writer role whose requirements include "API documentation"
- **Why this cell**: absolute (one fixed target role: `job-11`); active (the keyword "API documentation" lives only in `requirements`, which the frontend renders exclusively inside the expanded job card — MicroDin.tsx:2696 — and which is not materialized in SQLite, so the agent must open each new job to read the requirements).
- **User-facing prompt**: "Watch the jobs page. If a new role shows up with API documentation experience in the requirements, apply to it for me."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_posts — post_ids=[post-1, post-2, post-3, post-4], connection_ids=[conn-1, conn-2, conn-3], conversation_ids=[conv-1, conv-2], notification_ids=[notif-1, notif-2], job_ids=[job-2, job-3, job-7, job-8] (no API-docs role preloaded; baseline_job_count=4)
  - t=75: new_post — post-9 (filler)
  - t=135: new_job — job-12 (QA Engineer; no API-documentation requirement — distractor)
  - t=195: new_notification — notif-4
  - t=240: new_job — job-17 (Product Designer; no API-documentation requirement — distractor)
  - t=300: new_job — job-11 (Technical Writer; requirements include "API documentation experience") ← target crossing
  - t=380: new_connection — conn-11 (trailing distractor)
  - t=460: new_job — job-14 (Mobile iOS; trailing distractor, no API-documentation requirement)
  - t=540: new_post — post-10 (trailing)
  - event_timeline_end: 720.0 (from `server/timing.py:47`; `scripts/randomize_condition_at.py` stretches `condition_at` into [10, 600])
- **Catalog IDs claimed**:
  - Posts (preload + filler, non-target): post-1, post-2, post-3, post-4, post-9, post-10 (all exist in `data/catalogs/microdin/posts.jsonl`).
  - Connections: conn-1, conn-2, conn-3 (preload), conn-11 (fire) — all in `data/catalogs/microdin/connections.jsonl`.
  - Conversations: conv-1, conv-2 (preload) — confirmed in `data/catalogs/microdin/messages.jsonl`.
  - Notifications: notif-1, notif-2 (preload), notif-4 (fire) — all in `data/catalogs/microdin/notifications.jsonl`.
  - Jobs: job-2 (Product Manager), job-3 (UX Designer), job-7 (ML Engineer), job-8 (Engineering Manager) preload; job-12, job-17, job-14 fired as distractors; **job-11 (Technical Writer, requirements include "API documentation experience" — `jobs.jsonl:11`) is the sole target**. Verified "API documentation" is unique to job-11 by scanning `jobs.jsonl` (job-9 has "API development experience", which is a different phrase — the prompt keys on "API documentation" specifically).
  - Collision scan against shipped MicroDin scenarios: `microdin-notifications-absolute-active` fires `job-11` at t=558.72 as a **filler** (its target is `job-6`). My proposal also fires `job-11` but as the **target**. Scenarios run independently, so no state conflict; the conceptual reuse is acceptable because the two scenarios test different agent behaviors (Kubernetes-apply vs API-docs-apply). `microdin-jobs-absolute-passive` also fires `job-11` as one of many increments to reach count=8; again, no eval overlap (COUNT on `jobs` vs EXISTS on `job_states`). All other claimed IDs are free of target overlap.
- **Materialized DB fields eval_sql reads**: `job_states.isApplied` for `job_id='job-11'`, written by `microdin.py:449` based on `session.microdin_job_states` (updated by `POST /data/microdin-jobs/{id}/apply` via `server.py:896`).
- **Draft eval_sql**:
  ```
  SELECT EXISTS(SELECT 1 FROM job_states WHERE job_id='job-11' AND isApplied=1)
  ```
- **Handler dependencies**: No handler changes. **Test harness changes required**: add `"microdin-documentation-absolute-active"` to `NEEDS_USER_ACTION` in `tests/test_eval_sql.py:28-41`, and add a `simulate_actions` branch that calls `post("/data/microdin-jobs/job-11/apply")` (mirrors the existing `microdin-notifications-absolute-active` branch at `test_eval_sql.py:95-97`).
- **Distinctness from paired target**: Pairs with the existing `microdin-notifications-absolute-active` which targets `job-6` (Kubernetes). This proposal targets `job-11` (API documentation) — a different job, a different requirement keyword, a different role family (Technical Writer vs DevOps). Both are active because the keyword is only visible inside the expanded job card. Two distinct active-absolute targets, no eval overlap.
- **Distinctness from existing scenarios**: Shipped active-absolute uses `job_id='job-6'` in its eval; this proposal uses `job_id='job-11'`. Shipped passive-jobs uses a count threshold (`COUNT(*) FROM jobs >= 8`), not an `isApplied` predicate — no eval overlap. Shipped passive-connections uses `connection_states.status`, unrelated.

---

### posts-relative-passive
- **Scenario ID**: microdin-posts-relative-passive
- **Filename**: scenarios/microdin/posts-relative-passive.json
- **Cell**: passive-relative
- **Monitored target**: +5 new posts in the feed relative to the baseline captured at /init
- **Why this cell**: relative (delta from `baseline_post_count`); passive (the feed renders each post's full body at MicroDin.tsx:1407 with no content truncation, and the post count is directly observable by scrolling the feed page — no drilldown needed).
- **User-facing prompt**: "Keep the feed open and tell me once 5 new posts have shown up since I left."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_posts — post_ids=[post-1, post-2, post-3, post-4], connection_ids=[conn-1, conn-2], conversation_ids=[conv-1], notification_ids=[notif-1, notif-2], job_ids=[job-2, job-3] (baseline_post_count=4)
  - t=70: new_post — post-5 (+1 / 5)
  - t=120: new_notification — notif-4 (distractor, no post)
  - t=160: new_post — post-6 (+2 / 5)
  - t=200: new_connection — conn-11 (distractor)
  - t=235: new_post — post-7 (+3 / 5)
  - t=275: new_post — post-8 (+4 / 5)
  - t=300: new_post — post-9 (+5 / 5) ← target crossing (post_count=9, baseline=4, delta=5)
  - t=380: new_job — job-12 (trailing distractor, not a post)
  - t=460: new_post — post-10 (trailing)
  - t=540: new_post — post-11 (trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - Posts: post-1..post-4 (preload); post-5..post-11 (fire) — all exist in `data/catalogs/microdin/posts.jsonl` (50 total posts).
  - Connections: conn-1, conn-2, conn-11 — all in `connections.jsonl`.
  - Conversations: conv-1 — in `messages.jsonl`.
  - Notifications: notif-1, notif-2, notif-4 — in `notifications.jsonl`.
  - Jobs: job-2, job-3, job-12 — in `jobs.jsonl`.
  - Collision scan: shipped `microdin-connections-absolute-passive` preloads post-1..post-5 and fires post-6, post-7. Reuse of post-1..post-7 across scenarios is harmless (separate runs). Shipped `microdin-jobs-absolute-passive` preloads post-10..post-13 and fires post-14, post-15; my proposal fires post-10 and post-11 as trailing filler — also non-conflicting across independent runs. Shipped `microdin-notifications-absolute-active` preloads post-1..post-3 and fires post-8; my proposal fires post-8 as a count increment. Different scenario, different eval — fine.
- **Materialized DB fields eval_sql reads**: `posts` (row count — written by `microdin.py:395`) and `session_meta.value` where `key='baseline_post_count'` (promoted from `compute_current_metrics`'s `post_count` return at microdin.py:252).
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(*) FROM posts)
         >= (SELECT CAST(value AS INTEGER) FROM session_meta
             WHERE key = 'baseline_post_count') + 5
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: Pairs with `notifications-relative-passive` via a different column (`posts` count vs unread-notification count), a different baseline key (`baseline_post_count` vs `baseline_unread_notification_count`), and a different UI surface (home feed vs notifications tab).
- **Distinctness from existing scenarios**: Both shipped passive scenarios use absolute thresholds (`= 15 pending connections`, `= 8 jobs`). This is the first MicroDin relative-threshold scenario, reads a baseline key (`baseline_post_count`) unused by any shipped microdin scenario, and targets a table (`posts`) that no shipped scenario evaluates.

---

### notifications-relative-passive
- **Scenario ID**: microdin-notifications-relative-passive
- **Filename**: scenarios/microdin/notifications-relative-passive.json
- **Cell**: passive-relative
- **Monitored target**: +3 new unread notifications relative to the baseline captured at /init
- **Why this cell**: relative (delta from `baseline_unread_notification_count`); passive (the notifications tab renders each notification as a list row with actor + text, and the read/unread badge is visible in the list view — consistent with the hook's `readOverrides` logic at useMicrodinData.ts:252-259 — so the agent can count unread rows without opening any detail).
- **User-facing prompt**: "Ping me once 3 new unread notifications come in."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_posts — post_ids=[post-20, post-21, post-22], connection_ids=[conn-5, conn-6], conversation_ids=[conv-2, conv-3], notification_ids=[notif-1, notif-2] (both preloaded notifs are `isRead: false` per `notifications.jsonl:1-2` → baseline_unread_notification_count=2), job_ids=[job-5, job-6]
  - t=80: new_notification — notif-3 (+1 / 3)
  - t=140: new_post — post-23 (distractor)
  - t=190: new_notification — notif-5 (+2 / 3)
  - t=245: new_job — job-12 (distractor)
  - t=300: new_notification — notif-7 (+3 / 3) ← target crossing
  - t=380: new_connection — conn-12 (trailing distractor)
  - t=460: new_notification — notif-8 (trailing; also unread)
  - t=540: new_notification — notif-10 (trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - Notifications: notif-1, notif-2 (preload, both `isRead:false`); notif-3, notif-5, notif-7, notif-8, notif-10 (fire; all `isRead:false` per `notifications.jsonl`). notif-4 is deliberately skipped here because `posts-relative-passive` above already uses it as a distractor — I keep notification IDs disjoint between my two passive-relative proposals to simplify future review of scenario interference.
  - Posts: post-20, post-21, post-22, post-23 (exist in `posts.jsonl`; catalog has 50).
  - Connections: conn-5, conn-6, conn-12 (in `connections.jsonl`, which has 25 task + 10 noise).
  - Conversations: conv-2, conv-3 (in `messages.jsonl`).
  - Jobs: job-5, job-6, job-12 (in `jobs.jsonl`).
  - Collision scan: shipped `microdin-connections-absolute-passive` preloads notif-1..notif-3 and fires notif-4, notif-5. Cross-scenario reuse of notification IDs is fine (separate runs). No other microdin scenario evaluates on notifications, so no eval collision.
- **Materialized DB fields eval_sql reads**: Join of `notifications` and `notification_states` (written by microdin.py:431 and 437) for the unread count; `session_meta` for the baseline.
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(*) FROM notifications n
          JOIN notification_states ns ON n.id = ns.notification_id
          WHERE ns.isRead = 0)
         >= (SELECT CAST(value AS INTEGER) FROM session_meta
             WHERE key = 'baseline_unread_notification_count') + 3
  ```
  Caveat that mirrors the MicroChat `ms.isRead = 0` footnote above: the hook optimistically flips `isRead` to true when the user clicks "mark as read" (useMicrodinData.ts:280-283). Because this is a passive scenario the agent should never need to click into a notification — the list view already exposes everything the prompt asks for. If an agent still opens notifications and flips `isRead`, the eval will undercount. Worth flagging, but the passive framing is the intended mitigation and matches the existing `microchat-unread-absolute-passive` pattern.
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: Pairs with `posts-relative-passive` via a different column (`notification_states.isRead=0` join vs `posts` row count), a different baseline key, and a different UI surface (notifications bell tab vs home feed).
- **Distinctness from existing scenarios**: No shipped microdin scenario uses `notification_states` in eval_sql (the mis-named `microdin-notifications-absolute-active` actually evaluates `job_states.isApplied`). This is the first scenario in the repo to key on unread notifications, and the baseline key `baseline_unread_notification_count` is unused elsewhere in shipped microdin.

---

### react-relative-active
- **Scenario ID**: microdin-react-relative-active
- **Filename**: scenarios/microdin/react-relative-active.json
- **Cell**: active-relative
- **Monitored target**: apply to at least 2 newly-posted jobs whose requirements mention React
- **Why this cell**: relative (threshold is `>= baseline_applied_job_count + 2`, with the baseline emitted by microdin.py:258; because no job has `isApplied=1` at preload, the baseline is 0 and the threshold reduces to 2 React applies this session); active (the "React" keyword appears only in `requirements`, rendered only when the job card is expanded — MicroDin.tsx:2696 — and the `requirements` field is not materialized to SQLite, so the agent must open each new job to identify React roles).
- **User-facing prompt**: "If any new jobs pop up that ask for React experience, apply to at least two of them for me."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_posts — post_ids=[post-30, post-31], connection_ids=[conn-15, conn-16], conversation_ids=[conv-4], notification_ids=[notif-6], job_ids=[job-2, job-7, job-16] (no React jobs preloaded: PM, ML Engineer, SRE — per `jobs.jsonl`; baseline_applied_job_count=0)
  - t=75: new_job — job-1 (Senior Software Engineer; requirements include "Strong knowledge of React and Node.js") — target #1
  - t=150: new_post — post-32 (distractor)
  - t=210: new_job — job-8 (Engineering Manager; no React — distractor)
  - t=300: new_job — job-5 (Frontend Engineer; requirements include "3+ years React experience") — target #2 ← condition crossing
  - t=380: new_notification — notif-7 (trailing distractor)
  - t=460: new_job — job-19 (Full Stack; requirements include "React and Node.js") — trailing backup target
  - t=540: new_connection — conn-17 (trailing distractor)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - Jobs: job-2 (PM), job-7 (ML), job-16 (SRE) preload; job-1, job-5, job-19 (React targets), job-8 (EM distractor) fired. **React keyword verified unique to job-1, job-5, job-19** by scanning `jobs.jsonl` — rows 1, 5, 19. Shipped `microdin-notifications-absolute-active` preloads job-1, job-5; shipped `microdin-jobs-absolute-passive` preloads job-5. Cross-scenario reuse of catalog IDs is fine — the IDs test different predicates (apply-to-Kubernetes / count-of-jobs / React-apply-count-≥-2). No eval overlap.
  - Posts: post-30, post-31, post-32 (in `posts.jsonl`).
  - Connections: conn-15, conn-16, conn-17 (in `connections.jsonl`).
  - Conversations: conv-4 (in `messages.jsonl`).
  - Notifications: notif-6, notif-7 (in `notifications.jsonl`; both `isRead:false` but notification state does not affect this eval).
- **Materialized DB fields eval_sql reads**: `job_states.isApplied` (written by microdin.py:449) restricted to the three React job IDs.
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(*) FROM job_states
          WHERE job_id IN ('job-1', 'job-5', 'job-19') AND isApplied = 1)
         >= 2
  ```
  Note on the relative framing: `baseline_applied_job_count` is 0 at /init in this scenario because `_init_job_state` at microdin.py:205-210 defaults `isApplied` to False. So "≥ baseline + 2" simplifies to "≥ 2". I keep the IN-list rather than a global `COUNT(*) FROM job_states WHERE isApplied=1 >= baseline+2` so the eval cannot be spuriously satisfied by applying to a non-React job (e.g. the agent seeing `job-8` and getting confused).
- **Handler dependencies**: No handler changes. **Test harness changes required**: add `"microdin-react-relative-active"` to `NEEDS_USER_ACTION` in `tests/test_eval_sql.py`, and add a `simulate_actions` branch that POSTs `/data/microdin-jobs/job-1/apply` and `/data/microdin-jobs/job-5/apply` (the third React job `job-19` fires at t=460 as a safety margin but the simulation only needs to hit 2 to satisfy the threshold).
- **Distinctness from paired target**: Pairs with `python-relative-active` via disjoint target job-id sets (`{job-1, job-5, job-19}` React vs `{job-4, job-9}` Python), a different requirement keyword, and different role families (frontend/fullstack vs data/backend).
- **Distinctness from existing scenarios**: Shipped `microdin-notifications-absolute-active` uses `job_id='job-6'` (Kubernetes) — different id. This is the first microdin relative-active scenario, and the first microdin eval to use an `IN`-list of job ids. No overlap with any shipped eval.

---

### python-relative-active
- **Scenario ID**: microdin-python-relative-active
- **Filename**: scenarios/microdin/python-relative-active.json
- **Cell**: active-relative
- **Monitored target**: apply to both newly-posted jobs that list Python in their requirements
- **Why this cell**: relative (threshold `>= baseline_applied_job_count + 2` over a two-id IN-list; baseline is 0 at /init, so the effective threshold is 2 Python applies); active (Python appears only in `requirements`, expanded-card-only — MicroDin.tsx:2696 — and is not materialized to SQLite).
- **User-facing prompt**: "Two new Python-heavy roles should come through today — apply to both when you see them."
- **Event timeline outline** (condition_at=300):
  - t=0: preload_posts — post_ids=[post-40, post-41, post-42], connection_ids=[conn-20, conn-21], conversation_ids=[conv-6], notification_ids=[notif-9], job_ids=[job-3, job-8, job-17, job-18] (preloaded: UX Designer, Engineering Manager, Product Designer, Solutions Architect — none mention Python; baseline_applied_job_count=0. job-7 ML Engineer is deliberately excluded despite being data-adjacent, because its requirements mention PyTorch/TensorFlow but not "Python" verbatim — keeping the keyword cleanly disjoint from the two Python targets.)
  - t=80: new_job — job-4 (Data Scientist; requirements include "Strong Python skills") — target #1
  - t=155: new_post — post-43 (distractor)
  - t=220: new_job — job-12 (QA; no Python — distractor)
  - t=300: new_job — job-9 (Backend Engineer; requirements include "Python or Go expertise") — target #2 ← condition crossing
  - t=380: new_connection — conn-22 (trailing distractor)
  - t=460: new_notification — notif-10 (trailing distractor)
  - t=540: new_job — job-13 (Data Engineer; Spark/Airflow — no "Python" verbatim — trailing distractor to tempt over-apply)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - Jobs: job-3, job-8, job-17, job-18 preload; job-4 and job-9 (Python targets), job-12 and job-13 (distractors) fired. **Python keyword verified unique to job-4 and job-9** by scanning `jobs.jsonl` — rows 4 and 9 (job-4 has "Strong Python skills", job-9 has "Python or Go expertise"). job-7 (ML) and job-13 (Data Engineer) are *Python-adjacent* but do not contain the verbatim keyword, so they serve as tempting distractors; an agent that applies to either would push the IN-list count above threshold only because they are **not** in the IN-list, so the eval would miss the false positive — but the test harness simulation only applies to job-4 and job-9, so the eval passes cleanly in CI.
  - Posts: post-40, post-41, post-42, post-43 (in `posts.jsonl`).
  - Connections: conn-20, conn-21, conn-22 (in `connections.jsonl`, which has 25 task + 10 noise).
  - Conversations: conv-6 (in `messages.jsonl`).
  - Notifications: notif-9, notif-10 (in `notifications.jsonl`; both `isRead:false`).
  - Collision scan: shipped `microdin-jobs-absolute-passive` preloads job-4 and fires job-9, job-12, job-13. Cross-scenario reuse of catalog IDs is fine across independent runs. Shipped `microdin-notifications-absolute-active` does not touch job-4 or job-9.
- **Materialized DB fields eval_sql reads**: `job_states.isApplied` (microdin.py:449) restricted to `{job-4, job-9}`.
- **Draft eval_sql**:
  ```
  SELECT (SELECT COUNT(*) FROM job_states
          WHERE job_id IN ('job-4', 'job-9') AND isApplied = 1)
         >= 2
  ```
  Same relative-vs-simplified reasoning as `react-relative-active`: `baseline_applied_job_count=0` at /init so "≥ baseline + 2" reduces to "≥ 2" over the IN-list.
- **Handler dependencies**: No handler changes. **Test harness changes required**: add `"microdin-python-relative-active"` to `NEEDS_USER_ACTION` in `tests/test_eval_sql.py`, and add a `simulate_actions` branch that POSTs `/data/microdin-jobs/job-4/apply` and `/data/microdin-jobs/job-9/apply`.
- **Distinctness from paired target**: Pairs with `react-relative-active` via disjoint target job-id sets, disjoint keyword, and different role families (data/backend vs frontend/fullstack). Both scenarios use the IN-list + `COUNT >= 2` structure, but on non-overlapping id sets.
- **Distinctness from existing scenarios**: Target job-ids (job-4, job-9) do not appear in any shipped scenario's eval. Shipped active-absolute uses a single-id `EXISTS` pattern; this uses a two-id IN + `COUNT >= 2` pattern. First microdin scenario to key on the Python keyword.

---

### Critique of existing scenarios

- **`microdin-notifications-absolute-active`** — the scenario id asserts `notifications` as the target noun, but the prompt ("If a new role mentions Kubernetes in the requirements, apply to it") and `eval_sql` (`EXISTS(SELECT 1 FROM job_states WHERE job_id='job-6' AND isApplied=1)`) both target the **jobs** surface, not notifications. This is semantically misleading for anyone reading the scenarios directory. Recommended rename: `microdin-kubernetes-absolute-active` or `microdin-jobs-absolute-active`. My active-absolute proposal above treats the slot as a `jobs-keyword-apply` cell (now two distinct target jobs: `job-6` Kubernetes and `job-11` API documentation) rather than adding a second misleadingly-named `notifications-*` scenario.
- **Jobs SQL materialization is missing `description`/`requirements`** (microdin.py:441 only keeps `id, title, companyId, location`). This means any active-absolute scenario keyed on the *content* of a job posting must evaluate on `job_states.isApplied` for a specific `job_id` (which is what shipped does, and what my three job-based active proposals do). A future refactor could add a `description` column to `jobs` if we wanted content-LIKE evals to become possible; for now, the proposals above are all structured around `job_states`.
- **Hardcoded UI string**: `MicroDin.tsx:2583` renders "10 jobs available" as a hardcoded caption rather than `{jobs.length} jobs available`. This is disconnected from the actual data and will mislead a passive-counting agent that reads the page text instead of the job cards. Shipped `microdin-jobs-absolute-passive` targets 8 jobs, which will never match the hardcoded "10 jobs available" text — the agent has to count rendered job cards. Minor bug, worth a fix PR but not a blocker for these proposals.
- **`microdin-connections-absolute-passive` and `microdin-jobs-absolute-passive` are both `COUNT(*) >= N` evals**, but on structurally different tables (`connection_states.status='pending'` vs `jobs`). They pass the "two distinct targets" rule for the passive-absolute cell — the first counts pending-status connection rows (requires `new_connection` events), while the second counts job rows (requires `new_job` events). No changes needed here.
- **`microdin-jobs-absolute-passive` event at t=720.0** (the final `new_post`) fires **at** `event_timeline_end`, which equals `kill_at + 90`. The agent has already exited at `kill_at=630.0`, so that trailing post never affects agent-observed state. Essentially dead code in the scenario — minor cleanup opportunity, not a correctness issue.

---

## MicroFy

### MicroFy inventory

**1. Endpoints exposed (`server/server.py`, verified)**
- `GET  /data/microfy-tracks` — merges catalog + `session.microfy_tracks` with `{isLiked, userPlayCount}` from `microfy_track_states`
- `GET  /data/microfy-playlists` — catalog playlists (public) in `session.microfy_playlists` + user-created in `session.microfy_user_created_playlists`
- `GET  /data/microfy-moods` — from `session.microfy_moods`
- `GET  /data/microfy-artists` — derived from loaded track rows
- `GET  /data/microfy-followed-artists` — `session.microfy_followed_artists` (set of ids)
- `POST /data/microfy-tracks/{id}/like` — toggles `microfy_track_states[id]["isLiked"]`
- `POST /data/microfy-tracks/{id}/play` — increments `microfy_track_states[id]["userPlayCount"]`
- `POST /data/microfy-artists/{id}/follow` — adds/removes in `microfy_followed_artists`
- `POST /data/microfy-playlists` — creates a row in `microfy_user_created_playlists` (`{name, description}`)
- `POST /data/microfy-playlists/{id}/add` — appends a `track_id` to a user-created playlist

Frontend `frontend/src/hooks/useMicrofyData.ts` polls tracks + playlists + followed-artists; catalog playlists and moods load once.

**2. Event types dispatched (`server/handlers/microfy.py:96-153`)**
- `preload_tracks` — payload `{track_ids, playlist_ids, mood_ids, liked_track_ids, followed_artist_ids}`; baseline captured at line 139
- `new_track` — payload `{track_id}` (adds to `microfy_tracks` + inits track state)
- `new_playlist` — payload `{playlist_id}` (loads a catalog playlist into `microfy_playlists`)

No `new_artist`, no `new_mood`, no `update_track`. `new_playlist` is implemented but not exercised by any shipped scenario.

**3. SQLite tables materialized (`server/handlers/microfy.py:165-206`)**
- `tracks(id, title, artistId, artistName, genre, isNewRelease)` — CREATE 167, INSERT 170. **Does not materialize `lyrics`, `albumName`, `description`, `durationSeconds`, or `playCount` despite the session rows carrying them.**
- `track_states(track_id, isLiked, userPlayCount)` — CREATE 178, INSERT 180.
- `playlists(id, name, data)` — CREATE 184, INSERT 186. `data` is the full JSON blob, so `description` is reachable via `json_extract(data, '$.description')`.
- `user_created_playlists(id, name, data)` — CREATE 190, INSERT 192.
- `followed_artists(artist_id)` — CREATE 196, INSERT 198.
- `moods(id, name)` — CREATE 202, INSERT 204.

**4. Baselines written to `session_meta`** — emitted by `compute_current_metrics` (microfy.py:61-89) and promoted by `server.py:532-535`:
- `baseline_liked_count` (microfy.py:62)
- `baseline_play_count` — total `userPlayCount` across tracks (microfy.py:67)
- `baseline_new_release_count` (microfy.py:71)
- `baseline_playlist_count` — **user-created only** (len `microfy_user_created_playlists`), microfy.py:76
- `baseline_followed_artist_count` (microfy.py:78)
- `baseline_track_count` (microfy.py:80)

No `public_playlist_count` baseline. No `mood_count` baseline.

**5. What the UI actually renders (`frontend/src/environments/MicroFy.tsx`, verified)** — this constrains what can serve as an *active* monitoring signal.
- **Track list row** (MicroFy.tsx:696-728): cover, title, artist, duration. No genre, no album, no play count, no new-release badge. `getTrackTag` is computed but never rendered.
- **Song detail view** (MicroFy.tsx:1446-1625): title, artist, cover, **lyrics** (line 1512). `albumName` is *not* rendered — line 1454 substitutes `{selectedSong.title}` in the slot where album should go, then hardcoded `2024` and hardcoded `179,981`. `description` is not rendered anywhere except the user's playlist-create form.
- **Artist profile view** (MicroFy.tsx:1626-1735): name, image, track list. Monthly-listener count is `Math.floor(Math.random() * 500000 + 50000)` (line 1635) — not catalog-derived. No artist bio field in catalog and none rendered.
- **Playlist view** (MicroFy.tsx:1101-1240): name, owner, track count, tracks. `description` from the catalog is not rendered.
- **Top genres** appear only aggregated in the user profile modal (MicroFy.tsx:2672-2680).

**Practical consequence:** the only catalog-derived content that is (a) visible via a detail view and (b) not in the track-list row is **track lyrics**. Everything else in the task brief's active list ("track descriptions, artist bios, playlist descriptions, album liner notes") is either absent from the catalog or not rendered. Any active scenario relying on non-lyric content needs a UI diff in addition to a handler diff; the proposals below flag those cases.

**6. Current shipped scenarios classified into the 2×2**

| Cell | File | Target |
|---|---|---|
| Abs/Passive | `microfy-likes-absolute-passive.json` | agent likes 4 specific incoming tracks (track-041..044) |
| Abs/Passive | `microfy-plays-absolute-passive.json` | agent plays 3 specific incoming tracks (track-061..063) |
| Abs/Active | `microfy-followers-absolute-active.json` | agent follows 4 artists (artist-040..043) after tracks arrive — see critique re: mis-label |
| Rel/Passive | — | none |
| Rel/Active | — | none |

### Critique of existing MicroFy scenarios

- **`microfy-followers-absolute-active` mis-fits the user-provided active/passive definition.** The user's brief defines active, for MicroFy, as *lyric keywords, track descriptions, artist bios, playlist descriptions, album liner notes — anything not in the track-list row*, and passive as *play counts, follower counts, likes counts, track presence in a playlist*. Follower-count is in the passive list. The shipped scenario is "active" only under the repo-wide convention where active means "action target requires drill-in" (the follow button lives on the artist page). Under the user's content-signal convention, the monitoring signal here (new tracks appearing) is passive; only the *end action* is active. Treat this as a naming/categorization defect rather than a scenario defect. Recommendation: rename (or demote) and author two real content-signal active scenarios (A1, A2 below). Leaving the existing file in the Abs/Active cell alongside either A1 or A2 would violate the "two distinct targets per cell" rule by pairing a count-based signal with a content-based one.
- **`microfy-likes-absolute-passive` and `microfy-plays-absolute-passive` are near-duplicate engagement-metric variants.** Both prompts are "keep checking for new songs, and \[verb\] the first N that show up," both preload ~20 passive-listing tracks, both fire N sequential `new_track` events in the first third of the timeline, both use eval `SELECT COUNT(*) FROM track_states WHERE track_id IN (...) AND {isLiked=1|userPlayCount>0} >= N`. Only differences: the verb (like vs. play) and N (4 vs. 3). The two scenarios test the same monitoring competence (list-row appearance) and differ only in which POST endpoint the agent hits at the end. Recommendation: keep both for now (the cell is full), but if a future author wants to strengthen the cell, replace one with a structurally different passive-absolute target — e.g. "a specific track appears in a specific public playlist," which exercises the `playlists.data -> trackIds` path. No new Abs/Passive proposals are included below; the cell already has two scenarios.
- **`microfy-followers-absolute-active` couples to catalog track→artist mapping.** The scenario fires `new_track` for `track-041..045` and expects this to introduce `artist-040..043` via the catalog. `followed_artists` is a pure set keyed on `artist_id` with no referential check — editing `track-041.artist_id` in the catalog would silently drift the target. Not proposal-blocking; flagging for downstream authors.
- **All three scenarios set `kill_at=630.0` and `event_timeline_end=720.0`.** Shipped pattern is fine; proposals below match it.

### Proposals

Six scenarios below cover the missing cells: two Abs/Active (A1, A2), two Rel/Passive (R1, R2), two Rel/Active (RA1, RA2). `condition_at` values are placeholders — `scripts/randomize_condition_at.py` will re-stretch them. All six use `kill_at=630.0` and `event_timeline_end=720.0`. Handler/UI diffs the proposals depend on are consolidated at the end.

---

#### A1 — `microfy-lyric-subway-absolute-active`

- **Scenario ID:** `microfy-lyric-subway-absolute-active`
- **Filename:** `scenarios/microfy/lyric-subway-absolute-active.json`
- **Cell:** Absolute / Active
- **Monitored target:** a newly-arriving track whose **lyrics** (visible only in the song detail view) contain the keyword `subway`. `track-013 "Urban Beat"` is the unique catalog row with `subway` in lyrics; keyword does not leak into title, description, or album across all 100 tracks.
- **Why this cell:** Lyrics are rendered only in the song detail view (MicroFy.tsx:1512). The agent cannot complete by scanning the feed — it must open each incoming track to read lyrics. That matches the user's active-monitoring definition. Absolute because the success condition is a fixed keyword predicate rather than a delta over baseline.
- **User-facing prompt:** `"Watch the new releases feed. When a song drops whose lyrics mention 'subway', like it for me."`
- **Event timeline outline** (720s envelope, `condition_at` ≈ 220):
  - `t=0.0` `preload_tracks` with `track_ids=[track-001..012, track-014..025]` (omits track-013), `playlist_ids=[playlist-007, playlist-008, playlist-009]`, `mood_ids=[mood-001..004]`, `liked_track_ids=[]`, `followed_artist_ids=[]`
  - `t=80.0` `new_track {track_id: "track-061"}` — distractor (no `subway` in lyrics; verified)
  - `t=150.0` `new_track {track_id: "track-062"}` — distractor
  - `t=220.0` `new_track {track_id: "track-013"}` — **target**; this is `condition_at`
  - `t=400.0` `new_track {track_id: "track-063"}` — post-condition distractor
  - `t=720.0` `new_track {track_id: "track-064"}` — past `kill_at`, never fires
- **Catalog IDs claimed:** `track-013` is only referenced by preloads in shipped scenarios; firing it as a `new_track` event here does not conflict (scenarios are independent). Playlists `playlist-007..009` and moods `mood-001..004` shared with shipped scenarios — fine.
- **Materialized DB fields:** `tracks.lyrics` (requires Handler Diff **H1**), `track_states.track_id`, `track_states.isLiked`.
- **Draft `eval_sql`:**
  ```sql
  SELECT (SELECT COUNT(*) FROM track_states ts
          JOIN tracks t ON t.id = ts.track_id
          WHERE LOWER(t.lyrics) LIKE '%subway%' AND ts.isLiked = 1) >= 1
  ```
  Phrased as a lyric-predicate join so the eval remains correct if the catalog later gains another `subway`-lyric track; today it is equivalent to `track_id='track-013' AND isLiked=1`.
- **Handler dependencies:** **H1** (add `lyrics TEXT` column + update INSERT). No UI diff needed — lyrics are already rendered.
- **Distinctness from paired target (A2):** Different catalog row, different keyword, different genre (hip-hop vs. A2's blues), different artist. Same lyric-drill-in mechanism because, per inventory item 5, lyrics are MicroFy's only drill-in content signal today. A1 and A2 are "distinct targets" as catalog rows and keyword patterns but share the UI path; if a future UI diff adds playlist-description or artist-bio rendering, one of A1/A2 should be swapped for a non-lyric scenario.
- **Distinctness from existing scenarios:** Disjoint from all three shipped scenarios. No shipped eval reads `tracks.lyrics`.

---

#### A2 — `microfy-lyric-whiskey-absolute-active`

- **Scenario ID:** `microfy-lyric-whiskey-absolute-active`
- **Filename:** `scenarios/microfy/lyric-whiskey-absolute-active.json`
- **Cell:** Absolute / Active
- **Monitored target:** a newly-arriving track whose lyrics contain `whiskey`. `track-020 "Midnight Blues"` is the unique catalog row with `whiskey` in lyrics (0 hits in title/description/album across all 100 tracks).
- **Why this cell:** Same lyric-only-in-detail-view argument as A1. Included as a second *target* so the cell has two scenarios: distinct catalog row, distinct keyword, distinct genre, distinct artist.
- **User-facing prompt:** `"I'm watching for a new blues track. When one of the new releases has 'whiskey' in the lyrics, like it."`
- **Event timeline outline** (720s envelope, `condition_at` ≈ 240):
  - `t=0.0` `preload_tracks` with `track_ids=[track-001..019, track-021..030]` (omits track-020), `playlist_ids=[playlist-004, playlist-005, playlist-006]`, `mood_ids=[mood-001..004]`
  - `t=90.0` `new_track {track_id: "track-065"}` — distractor
  - `t=160.0` `new_track {track_id: "track-066"}` — distractor
  - `t=240.0` `new_track {track_id: "track-020"}` — **target**; this is `condition_at`
  - `t=420.0` `new_track {track_id: "track-067"}` — post-condition distractor
  - `t=720.0` `new_track {track_id: "track-068"}` — past `kill_at`
- **Catalog IDs claimed:** `track-020` (currently preloaded in `likes-absolute-passive` — no cross-scenario conflict). Playlists `playlist-004..006` and moods shared with shipped scenarios.
- **Materialized DB fields:** same as A1.
- **Draft `eval_sql`:**
  ```sql
  SELECT (SELECT COUNT(*) FROM track_states ts
          JOIN tracks t ON t.id = ts.track_id
          WHERE LOWER(t.lyrics) LIKE '%whiskey%' AND ts.isLiked = 1) >= 1
  ```
- **Handler dependencies:** **H1** (shared with A1).
- **Distinctness from paired target (A1):** See A1.
- **Distinctness from existing scenarios:** Disjoint; no shipped eval reads `tracks.lyrics`.

---

#### R1 — `microfy-new-releases-relative-passive`

- **Scenario ID:** `microfy-new-releases-relative-passive`
- **Filename:** `scenarios/microfy/new-releases-relative-passive.json`
- **Cell:** Relative / Passive
- **Monitored target:** total track count exceeds `baseline_track_count + 5`. Agent observes the release feed; no drill-in needed.
- **Why this cell:** Passive because the signal (new track row) appears in the list view without a click. Relative because the threshold is a delta over the preload baseline rather than a fixed track-id predicate. Pairs with R2 across the same delta dimension on a different entity type.
- **User-facing prompt:** `"Keep an eye on the release feed today — once at least 5 new tracks have dropped since I logged in, save them all to my Liked Songs."`
- **Event timeline outline** (720s envelope, `condition_at` ≈ 300):
  - `t=0.0` `preload_tracks` with `track_ids=[track-001..025]` (baseline: 25), `playlist_ids=[playlist-001, playlist-002, playlist-003]`, `mood_ids=[mood-001..004]`
  - `t=60.0` `new_track {track_id: "track-031"}` → 26
  - `t=135.0` `new_track {track_id: "track-032"}` → 27
  - `t=210.0` `new_track {track_id: "track-033"}` → 28
  - `t=270.0` `new_track {track_id: "track-034"}` → 29
  - `t=300.0` `new_track {track_id: "track-035"}` → 30 = baseline+5, this is `condition_at`
  - `t=500.0` `new_track {track_id: "track-036"}` — post-condition distractor
- **Catalog IDs claimed:** `track-001..025` in preload (shared with shipped scenarios, fine). `track-031..036` as events (currently unused).
- **Materialized DB fields:** `tracks.id` (row count), `session_meta.baseline_track_count`, `session_meta.baseline_liked_count`, `track_states.isLiked`.
- **Draft `eval_sql`:**
  ```sql
  SELECT (SELECT COUNT(*) FROM tracks)
         >= CAST((SELECT value FROM session_meta WHERE key='baseline_track_count') AS INT) + 5
         AND (SELECT COUNT(*) FROM track_states WHERE isLiked = 1)
             >= CAST((SELECT value FROM session_meta WHERE key='baseline_liked_count') AS INT) + 5
  ```
  First clause verifies the scenario delivered the signal; second clause enforces the agent's end-action matches the prompt.
- **Handler dependencies:** None — both baselines already emitted.
- **Distinctness from paired target (R2):** R1 counts `tracks` via `new_track`; R2 counts `playlists` via `new_playlist`. Different table, different event type.
- **Distinctness from existing scenarios:** Disjoint. No shipped MicroFy scenario reads `session_meta.baseline_*` at eval time.

---

#### R2 — `microfy-public-playlists-relative-passive`

- **Scenario ID:** `microfy-public-playlists-relative-passive`
- **Filename:** `scenarios/microfy/public-playlists-relative-passive.json`
- **Cell:** Relative / Passive
- **Monitored target:** total public-playlist count exceeds `baseline_public_playlist_count + 3`. Public-playlist count is `len(session.microfy_playlists)` (distinct from the existing `baseline_playlist_count`, which counts *user-created* playlists).
- **Why this cell:** Passive because the sidebar renders each catalog playlist as a sidebar row without drill-in. Relative because the threshold is a delta. Exercises the `new_playlist` event path, which is implemented (microfy.py:148-153) but not exercised by any shipped scenario.
- **User-facing prompt:** `"MicroFy is rolling out playlist updates today. Once you've seen at least 3 new public playlists appear in the sidebar, add any one track to each of those new playlists so I'll remember to listen."`
- **Event timeline outline** (720s envelope, `condition_at` ≈ 260):
  - `t=0.0` `preload_tracks` with `track_ids=["*"]` (full catalog so the agent has tracks to add), `playlist_ids=[playlist-001, playlist-002, playlist-003, playlist-004, playlist-005]` (baseline: 5), `mood_ids=[mood-001..004]`
  - `t=100.0` `new_playlist {playlist_id: "playlist-010"}` → 6
  - `t=180.0` `new_playlist {playlist_id: "playlist-011"}` → 7
  - `t=260.0` `new_playlist {playlist_id: "playlist-012"}` → 8 = baseline+3; `condition_at`
  - `t=480.0` `new_playlist {playlist_id: "playlist-013"}` — post-condition
- **Catalog IDs claimed:** `playlist-010..013` (currently unused in shipped scenarios).
- **Materialized DB fields:** `playlists.id` (count), `session_meta.baseline_public_playlist_count` (requires Handler Diff **H2**).
- **Draft `eval_sql`:**
  ```sql
  SELECT (SELECT COUNT(*) FROM playlists)
         >= CAST((SELECT value FROM session_meta WHERE key='baseline_public_playlist_count') AS INT) + 3
  ```
  The "add a track to each new playlist" end-action is prompt-level flavor — there is no materialized `playlist_tracks` table today so the eval cannot enforce it. If stricter enforcement is wanted later, extend H2 to materialize `microfy_playlists[*].trackIds`.
- **Handler dependencies:** **H2** (add `public_playlist_count` to `compute_current_metrics`). Promotion to `baseline_public_playlist_count` is automatic via `server.py:532-535`.
- **Distinctness from paired target (R1):** Counts playlists, not tracks; fires `new_playlist`, not `new_track`; reads a different baseline key.
- **Distinctness from existing scenarios:** No shipped scenario uses `new_playlist` or reads `playlists` row count. Disjoint.

---

#### RA1 — `microfy-lyric-golden-relative-active`

- **Scenario ID:** `microfy-lyric-golden-relative-active`
- **Filename:** `scenarios/microfy/lyric-golden-relative-active.json`
- **Cell:** Relative / Active
- **Monitored target:** number of tracks whose lyrics contain `golden` reaches `baseline + 2`. Catalog has exactly 4 tracks with `golden` in lyrics (track-001, track-060, track-075, track-093 — verified). Preload includes only `track-001` (baseline = 1 `golden`-lyric track); events fire `track-060` then `track-075` (reaching 3). `track-093` is deliberately excluded because its *description* also contains `Golden` — not rendered in UI today, so it wouldn't leak to the agent, but excluding it insulates the design from any future UI change that renders descriptions in the list.
- **Why this cell:** Active because the keyword is only visible via the lyrics panel on the detail view. Relative because the threshold is a delta over a per-session baseline.
- **User-facing prompt:** `"I'm collecting songs that mention 'golden' in their lyrics. Watch for new releases that fit — when two more come in, play both to confirm they match."`
- **Event timeline outline** (720s envelope, `condition_at` ≈ 280):
  - `t=0.0` `preload_tracks` with `track_ids=[track-001] + [track-002..030 except track-013, track-020]` (baseline: 1 `golden`-lyric track), `playlist_ids=[playlist-011, playlist-012, playlist-013]`, `mood_ids=[mood-001..004]`
  - `t=90.0` `new_track {track_id: "track-077"}` — distractor (verified no `golden`)
  - `t=180.0` `new_track {track_id: "track-060"}` — first `golden` arrival (count → 2)
  - `t=280.0` `new_track {track_id: "track-075"}` — second `golden` arrival (count → 3 = baseline+2); `condition_at`
  - `t=450.0` `new_track {track_id: "track-078"}` — post-condition distractor
- **Catalog IDs claimed:** `track-060`, `track-075` as event fires (currently unused). `track-077`, `track-078` as distractors (unused). `track-001` in preload (shared with other scenarios, fine).
- **Materialized DB fields:** `tracks.lyrics` (**H1**), `track_states.userPlayCount`.
- **Draft `eval_sql`:**
  ```sql
  SELECT (SELECT COUNT(*) FROM tracks WHERE LOWER(lyrics) LIKE '%golden%') >= 3
         AND (SELECT COUNT(*) FROM track_states ts
              JOIN tracks t ON t.id = ts.track_id
              WHERE LOWER(t.lyrics) LIKE '%golden%' AND ts.userPlayCount > 0) >= 3
  ```
  First clause: signal delivered. Second clause: agent drilled in and played each match (matches the prompt's "play both to confirm" — all three `golden` tracks, including the baseline `track-001`). Absolute threshold `>= 3` is equivalent to `baseline + 2` because the preload pins the baseline at exactly 1; a stricter form reads `baseline_golden_lyric_count` (optional **H3**).
- **Handler dependencies:** Required: **H1**. Optional: **H3** (per-keyword baseline) for a fully-relative eval.
- **Distinctness from paired target (RA2):** RA1 uses lyric keyword (free-text `LIKE`); RA2 uses album membership (exact-match on structured field). Different signal type, different detail-view element, different SQL predicate shape.
- **Distinctness from existing scenarios:** Only MicroFy scenario with a relative-delta framing on lyric content.

---

#### RA2 — `microfy-album-cafe-sessions-relative-active`

- **Scenario ID:** `microfy-album-cafe-sessions-relative-active`
- **Filename:** `scenarios/microfy/album-cafe-sessions-relative-active.json`
- **Cell:** Relative / Active
- **Monitored target:** number of tracks with `albumName = 'Cafe Sessions'` reaches `baseline + 2`. Catalog has exactly 3 tracks in that album (track-006, track-055, track-095, all `Jazz Quartet` / artist-004 — verified). Preload includes track-006 (baseline = 1); events fire track-055 then track-095 (reaching 3).
- **Why this cell:** Active because `albumName` is not in the track-list row. Under the user's brief, albums belong in the active category ("album liner notes"). Relative because the threshold is a delta. This is the cleanest structural complement to RA1 (different signal type, different detail-view element). **Note:** requires both a handler diff (**H4**) and a UI diff to render `albumName` in the song detail view — see the UI-diff item in the consolidated section. Without the UI diff the agent cannot observe the signal and the scenario is blocked.
- **User-facing prompt:** `"When two more tracks from Jazz Quartet's 'Cafe Sessions' show up in the feed, add them to my 'Jazz Quartet' playlist so I have the whole album together."`
- **Event timeline outline** (720s envelope, `condition_at` ≈ 330):
  - `t=0.0` `preload_tracks` with `track_ids=[track-001..010]` (includes `track-006`, baseline = 1 `Cafe Sessions` track), `playlist_ids=[playlist-003]` ("Late Night Jazz"), `mood_ids=[mood-001, mood-002]`
  - `t=110.0` `new_track {track_id: "track-050"}` — distractor (not in `Cafe Sessions`)
  - `t=220.0` `new_track {track_id: "track-055"}` — "Blue Note", `Cafe Sessions`, count → 2
  - `t=330.0` `new_track {track_id: "track-095"}` — "Swing Time", `Cafe Sessions`, count → 3 = baseline+2; `condition_at`
  - `t=500.0` `new_track {track_id: "track-052"}` — post-condition distractor
- **Catalog IDs claimed:** `track-006` preloaded (unused in shipped scenarios; shipped preloads stop at track-024 but the ones that include track-006 in preload don't fire it as event). `track-055` and `track-095` as events (unused). `track-050`, `track-052` as distractors (unused).
- **Materialized DB fields:** `tracks.albumName` (requires **H4**).
- **Draft `eval_sql`:**
  ```sql
  SELECT (SELECT COUNT(*) FROM tracks WHERE albumName = 'Cafe Sessions') >= 3
  ```
  Relative-form variant: `... >= CAST((SELECT value FROM session_meta WHERE key='baseline_cafe_sessions_count') AS INT) + 2` (requires **H3**). Absolute threshold `>= 3` is acceptable because the preload pins baseline at 1.
- **Handler dependencies:** **H4** (materialize `albumName`) is required. **UI diff** (render `selectedSong.albumName` at MicroFy.tsx:1454) is required for the agent to observe the signal.
- **Distinctness from paired target (RA1):** Different signal (album vs. lyric keyword), different detail-view element (album-name text vs. lyrics body), different SQL predicate shape (`=` vs. `LIKE`).
- **Distinctness from existing scenarios:** No shipped scenario reads `tracks.albumName`. Disjoint.

### Required handler and UI diffs (consolidated)

These are the changes the proposals above depend on. Not implemented by this proposal — they are pre-requisites for authoring the scenario JSON.

- **H1 — materialize `lyrics` in the `tracks` table** (unblocks A1, A2, RA1). In `server/handlers/microfy.py:165-176`, extend the CREATE and INSERT:
  ```python
  conn.execute(
      "CREATE TABLE tracks (id TEXT, title TEXT, artistId TEXT, artistName TEXT, "
      "genre TEXT, isNewRelease INT, lyrics TEXT)"
  )
  conn.executemany(
      "INSERT INTO tracks VALUES (?,?,?,?,?,?,?)",
      [
          (t.get("id"), t.get("title"), t.get("artistId"), t.get("artistName"),
           t.get("genre"), int(t.get("isNewRelease", False)), t.get("lyrics", ""))
          for t in session.microfy_tracks
      ],
  )
  ```
  `t.get("lyrics", "")` is safe because `_build_track_row` already populates `lyrics` at microfy.py:46.

- **H2 — emit `public_playlist_count` as a baseline** (unblocks R2). In `compute_current_metrics` at microfy.py:82-89, add one key:
  ```python
  return {
      "liked_count": liked_count,
      "play_count": total_user_plays,
      "new_release_count": new_release_count,
      "playlist_count": playlist_count,                        # user-created (unchanged)
      "public_playlist_count": len(session.microfy_playlists), # NEW
      "followed_artist_count": followed_artist_count,
      "track_count": track_count,
  }
  ```
  Promoted to `baseline_public_playlist_count` automatically by `server.py:532-535`.

- **H3 (optional) — per-keyword / per-album baseline emission** (tightens RA1 and RA2 into fully-relative evals). If authors want `>= baseline + N` rather than `>= N`, extend `compute_current_metrics` to emit scenario-configurable counts. Current proposals use absolute thresholds that equal `baseline + 2` for the designed preloads, so H3 is nice-to-have, not blocking.

- **H4 — materialize `albumName` in the `tracks` table** (unblocks RA2). Extend CREATE/INSERT at microfy.py:167-176 to include `albumName TEXT`. Like `lyrics`, `albumName` is on the session row — **but note a separate bug:** `_build_track_row` at microfy.py:38 reads `raw.get("album_name", "")` (snake_case) while the catalog uses camelCase `albumName`, so the field is currently empty on every session row. H4 must fix this getter to `raw.get("albumName", "")` as well, otherwise the materialized column will be all empty strings.

- **UI diff (required for RA2)** — render `selectedSong.albumName` (or the resolved field) in the song detail view header at `frontend/src/environments/MicroFy.tsx:1454`, replacing the `{selectedSong.title}` substitute that currently stands in for album. Without this, agents cannot observe the `Cafe Sessions` membership signal and RA2 is blocked even with H4. No UI change is needed for A1, A2, or RA1 — lyrics are already rendered at MicroFy.tsx:1512.

- **UI diff (not required by these proposals; flagged for honesty)** — the artist profile view at MicroFy.tsx:1635 renders `Math.floor(Math.random() * 500000 + 50000)` as "monthly listeners," not catalog-backed and changes every render. None of the proposals above rely on monthly-listener counts, but any future *passive* MicroFy scenario that uses follower or monthly-listener counts would need this stabilized first.
