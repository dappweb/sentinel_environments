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

## MicroGram

### MicroGram inventory

**1. Endpoints this env exposes** (from `useMicrogramData.ts` lines 152-170):
- `GET /api/data/config` — task config (environment, event_timeline_end, selfUser)
- `GET /api/data/microgram-users` — all microgram users with social profiles
- `GET /api/data/microgram-posts` — list of posts with state (isLiked, isSaved)
- `GET /api/data/microgram-stories` — list of stories with state (isViewed)
- `GET /api/data/microgram-messages` — DM conversations with message threads
- `GET /api/data/microgram-activity` — activity feed entries
- `GET /api/data/microgram-followed-users` — list of followed user IDs
- `POST /api/data/microgram-posts/{id}/like` — toggle like on post
- `POST /api/data/microgram-posts/{id}/save` — toggle save on post
- `POST /api/data/microgram-posts/{id}/comment` — add comment to post
- `POST /api/data/microgram-stories/{id}/view` — mark story as viewed
- `POST /api/data/microgram-users/{id}/follow` — toggle follow on user
- `POST /api/data/microgram-conversations/{id}/read` — mark conversation as read

**2. Event types the handler dispatches** (from `microgram.py`):
- `preload_posts` — line 193; bulk-loads posts, stories, messages, activity, and sets baseline
- `new_post` — line 253; adds a single post to the feed
- `new_story` — line 260; adds a single story to the story bar
- `new_message` — line 267; adds a new DM conversation
- `new_activity` — line 274; adds a new activity feed entry

**3. SQLite tables and columns the handler writes** (from `materialize_to_sqlite`, lines 290-349):
- `posts` (id TEXT, authorId TEXT, caption TEXT, likes INT, isTargetPost INT) — line 291-301
- `post_states` (post_id TEXT, isLiked INT, isSaved INT) — line 303-306
- `stories` (id TEXT, authorId TEXT, mediaType TEXT) — line 308-311
- `story_states` (story_id TEXT, isViewed INT) — line 313-319
- `messages` (id TEXT, data TEXT) — line 321-325 (data is JSON string of full conversation)
- `message_states` (message_id TEXT, isRead INT) — line 327-330
- `activity` (id TEXT, type TEXT, actorId TEXT) — line 332-336
- `followed_users` (user_id TEXT) — line 338-342
- `user_created_comments` (id TEXT, post_id TEXT, text TEXT) — line 344-349
- `session_meta` (key TEXT PRIMARY KEY, value TEXT) — materialized by server.py line 612-624

**4. baseline_* fields written to session_meta at /init** (via `compute_current_metrics` at microgram.py line 152-183, stored by server.py lines 621-624):
- `baseline_liked_count` — count of posts with isLiked=True (line 153-155)
- `baseline_saved_count` — count of posts with isSaved=True (line 157-159)
- `baseline_comment_count` — len(user_created_comments) (line 161)
- `baseline_followed_count` — len(followed_users) (line 163)
- `baseline_story_viewed_count` — count of stories with isViewed=True (line 165-167)
- `baseline_post_count` — len(microgram_posts) (line 170)
- `baseline_story_count` — len(microgram_stories) (line 171)

Missing baselines needed for proposals below:
- `baseline_activity_count` — NOT currently emitted. Needed for passive-relative activity scenario.
- No baseline for DM conversation count or DM keyword count exists.

**5. Current scenario distribution by cell** (scanned: `follows-absolute-active.json`, `likes-absolute-passive.json`, `stories-absolute-passive.json`):

| Cell | Count | Scenarios |
|------|-------|-----------|
| passive-absolute | 2 | likes-absolute-passive, stories-absolute-passive |
| active-absolute | 1 | follows-absolute-active |
| passive-relative | 0 | — |
| active-relative | 0 | — |

Cells needing proposals: active-absolute (1 more), passive-relative (2), active-relative (2).

---

### dm-keyword-absolute-active

- **Scenario ID**: microgram-dm-keyword-absolute-active
- **Filename**: scenarios/microgram/dm-keyword-absolute-active.json
- **Cell**: active-absolute
- **Monitored target** (noun phrase): DM conversation mentioning "mockup"
- **Why this cell**: The keyword "mockup" appears only inside the message thread of dm-2 (message m4: "Check out this mockup"), not in its lastMessage preview ("Love the new design direction"), so the agent must open conversations to find it (active). The condition is a fixed keyword threshold (absolute).
- **User-facing prompt** (natural language, single sentence): "Watch my DMs for a new message about a mockup -- the word might not show in the preview, so you'll need to open conversations to check."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_posts — post_ids: [post-sailing-sunset, post-rock-climbing, post-beach-sunrise, post-marathon-finish, post-kayak-river, post-pasta-making], story_ids: [story-coding-night-setup, story-social-media-analytics, story-team-wellness-event], message_ids: [dm-4], activity_ids: [act-5, act-6, act-7]
  - t=100: new_message — dm-1 ("The photos from the trip are ready!" as lastMessage; no "mockup" inside)
  - t=200: new_post — post-digital-art (distractor)
  - t=300: new_message — dm-2 (lastMessage "Love the new design direction"; m4 contains "Check out this mockup")
  - t=400: new_post — post-architecture-photo (distractor)
  - t=500: new_activity — act-8 (trailing distractor)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against posts.jsonl, stories.jsonl, messages.jsonl, activity.jsonl; verified unclaimed by scanning follows-absolute-active.json, likes-absolute-passive.json, stories-absolute-passive.json):
  - post-sailing-sunset: "Nothing clears the mind like an evening sail" (order 12)
  - post-rock-climbing: "Finally sent that V6" (order 14)
  - post-beach-sunrise: "Woke up at 5am for this" (order 36)
  - post-marathon-finish: "Marathon complete!" (order 19)
  - post-kayak-river: "Morning kayak session on the river" (order 53)
  - post-pasta-making: "Made fresh pasta from scratch" (order 54)
  - post-digital-art: "New digital piece finished" (order 62)
  - post-architecture-photo: "Love finding these geometric gems" (order 56)
  - story-coding-night-setup: user001 story (order 10)
  - story-social-media-analytics: user004 story (order 11)
  - story-team-wellness-event: user006 story (order 12)
  - dm-1: user027 conversation ("The photos from the trip are ready!")
  - dm-2: user005 conversation (contains "mockup" in m4)
  - dm-4: user003 conversation ("See you at the workshop!")
  - act-5: mention by user024
  - act-6: follow by user022
  - act-7: like by user002
  - act-8: comment by user008
- **Materialized DB fields the eval_sql reads**: `messages.data` — handler file microgram.py line 322-325
- **Draft eval_sql** (SQL, must reference real tables/columns):
  ```sql
  SELECT (SELECT COUNT(*) FROM messages WHERE data LIKE '%mockup%') >= 1
  ```
- **Handler dependencies**: "No handler changes required."
- **Distinctness from paired target**: This targets DM conversation content (a noun completely distinct from "followed users" used by follows-absolute-active in the same cell).
- **Distinctness from existing scenarios**: No existing MicroGram scenario monitors DM message content; all three existing ones target posts/stories/follows.

---

### posts-relative-passive

- **Scenario ID**: microgram-posts-relative-passive
- **Filename**: scenarios/microgram/posts-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): feed post count delta
- **Why this cell**: The total post count is visible from the feed without opening any detail view (passive). The condition is relative to the baseline post_count captured at /init.
- **User-facing prompt** (natural language, single sentence): "I already have a bunch of posts in my feed -- let me know when 5 more new posts show up."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_posts — post_ids: [post-sailing-sunset, post-rock-climbing, post-beach-sunrise, post-camping-tent, post-pottery-wheel, post-skydiving, post-book-club, post-skateboard-park], story_ids: [story-dubai-skyline-sunset, story-robotics-lab-prototype], message_ids: [dm-4], activity_ids: [act-9, act-10]
  - t=60: new_post — post-marathon-finish (delta +1)
  - t=120: new_post — post-studio-session (delta +2)
  - t=180: new_post — post-mountain-bike (delta +3)
  - t=240: new_post — post-code-conference (delta +4)
  - t=300: new_post — post-street-food (delta +5, target met)
  - t=400: new_post — post-basketball-court (trailing)
  - t=550: new_post — post-art-gallery (trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against posts.jsonl, stories.jsonl; verified unclaimed by scanning all 3 existing microgram scenarios):
  - post-sailing-sunset: order 12 (preload)
  - post-rock-climbing: order 14 (preload)
  - post-beach-sunrise: order 36 (preload)
  - post-camping-tent: order 37 (preload)
  - post-pottery-wheel: order 38 (preload)
  - post-skydiving: order 39 (preload)
  - post-book-club: order 40 (preload)
  - post-skateboard-park: order 41 (preload)
  - post-marathon-finish: order 19 (event)
  - post-studio-session: order 20 (event)
  - post-mountain-bike: order 21 (event)
  - post-code-conference: order 22 (event)
  - post-street-food: order 23 (event, target)
  - post-basketball-court: order 24 (trailing)
  - post-art-gallery: order 25 (trailing)
  - story-dubai-skyline-sunset: user025 (order 8)
  - story-robotics-lab-prototype: user032 (order 9)
  - dm-4: user003 conversation
  - act-9: like by user016
  - act-10: follow by user032
- **Materialized DB fields the eval_sql reads**: `posts` table (COUNT of rows) at microgram.py line 291-301; `session_meta.baseline_post_count` at microgram.py line 170 + server.py line 621-624.
- **Draft eval_sql** (SQL, must reference real tables/columns):
  ```sql
  SELECT (SELECT COUNT(*) FROM posts) >= (SELECT CAST(value AS INTEGER) FROM session_meta WHERE key='baseline_post_count') + 5
  ```
- **Handler dependencies**: "No handler changes required." (`baseline_post_count` is already emitted by `compute_current_metrics` at microgram.py line 170.)
- **Distinctness from paired target**: Counts total posts in feed, whereas the paired proposal below counts activity notifications -- a completely different data source and navigation section.
- **Distinctness from existing scenarios**: No existing MicroGram scenario uses a relative threshold. The closest is stories-absolute-passive, which counts story views (absolute, different noun, different table).

---

### activity-relative-passive

- **Scenario ID**: microgram-activity-relative-passive
- **Filename**: scenarios/microgram/activity-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): activity notification count delta
- **Why this cell**: Activity notifications (likes, follows, comments, mentions on the user's posts) are visible in the Activity tab without opening any individual post or profile (passive). The condition is relative to the baseline count at /init.
- **User-facing prompt** (natural language, single sentence): "I've already got some notifications in my activity feed -- keep an eye on it and let me know when 4 more show up."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_posts — post_ids: [post-golden-gate-run, post-coffee-code, post-sunset-hike, post-team-standup], story_ids: [story-coding-night-setup, story-social-media-analytics], message_ids: [], activity_ids: [act-5, act-6, act-7, act-8, act-9]
  - t=75: new_activity — act-10 (follow by user032, delta +1)
  - t=150: new_activity — act-11 (like by user019, delta +2)
  - t=225: new_activity — act-12 (comment by user044, delta +3)
  - t=300: new_activity — act-13 (mention by user010, delta +4, target met)
  - t=400: new_activity — act-14 (like by user025, trailing)
  - t=550: new_post — post-road-trip (trailing distractor)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against activity.jsonl, posts.jsonl, stories.jsonl; verified unclaimed by scanning all 3 existing microgram scenarios):
  - post-golden-gate-run: order 16 (preload)
  - post-coffee-code: order 17 (preload)
  - post-sunset-hike: order 18 (preload)
  - post-team-standup: order 15 (preload)
  - post-road-trip: order 68 (trailing)
  - story-coding-night-setup: user001 (order 10)
  - story-social-media-analytics: user004 (order 11)
  - act-5: mention by user024 (preload)
  - act-6: follow by user022 (preload)
  - act-7: like by user002 (preload)
  - act-8: comment by user008 (preload)
  - act-9: like by user016 (preload)
  - act-10: follow by user032 (event)
  - act-11: like by user019 (event)
  - act-12: comment by user044 (event)
  - act-13: mention by user010 (event, target)
  - act-14: like by user025 (trailing)
- **Materialized DB fields the eval_sql reads**: `activity` table (COUNT of rows) at microgram.py line 332-336; `session_meta.baseline_activity_count` (DOES NOT EXIST -- requires handler change).
- **Draft eval_sql** (SQL, must reference real tables/columns):
  ```sql
  SELECT (SELECT COUNT(*) FROM activity) >= (SELECT CAST(value AS INTEGER) FROM session_meta WHERE key='baseline_activity_count') + 4
  ```
- **Handler dependencies**: "Requires handler change: `server/handlers/microgram.py` must add `activity_count` to `compute_current_metrics` (line 152-183). Proposed addition at line 172 (before `post_count`):"
  ```python
  activity_count = len(session.microgram_activity)
  ```
  And include `"activity_count": activity_count` in the returned dict at line 175. This will auto-promote to `baseline_activity_count` in `session_meta` via server.py lines 621-624.
- **Distinctness from paired target**: Monitors activity notifications (a different section and data type) versus feed post count in the paired scenario above.
- **Distinctness from existing scenarios**: No existing scenario uses activity count or the activity table as a monitored target.

---

### comments-relative-active

- **Scenario ID**: microgram-comments-relative-active
- **Filename**: scenarios/microgram/comments-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): posts with comments from a specific user (user027 / @ahall)
- **Why this cell**: The feed shows "View all N comments" as a button but does NOT display commenter identities -- the agent must open each post's modal to see who commented (active). The condition is relative: N more posts with user027 comments vs baseline.
- **User-facing prompt** (natural language, single sentence): "I've noticed @ahall has been commenting on posts in my feed -- keep checking new posts as they come in, and let me know when 3 more posts show up that have a comment from @ahall (you'll need to open each post to see who commented)."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_posts — post_ids: [post-sailing-sunset (has user027 comment), post-beach-sunrise (has user027 comment), post-marathon-finish, post-studio-session, post-mountain-bike, post-street-food], story_ids: [story-security-ops-center, story-kubernetes-dashboard], message_ids: [dm-4], activity_ids: [act-15, act-16]
  - t=75: new_post — post-code-conference (no user027 comment, distractor)
  - t=140: new_post — post-skydiving (has user027 comment "So brave! How was it?", delta +1)
  - t=200: new_post — post-art-gallery (no user027 comment, distractor)
  - t=250: new_post — post-hiking-summit (has user027 comment "That's a fourteener! Respect", delta +2)
  - t=300: new_post — post-temple-visit (has user027 comment "Bucket list destination!", delta +3, target met)
  - t=400: new_post — post-aurora (has user027 comment, trailing)
  - t=550: new_post — post-yoga-retreat (no user027 comment, trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against posts.jsonl comments field; verified unclaimed by scanning all 3 existing microgram scenarios):
  - post-sailing-sunset: has comment by user027 "Stunning shot!" (preload, baseline)
  - post-beach-sunrise: has comment by user027 "Stunning shot!" (preload, baseline)
  - post-marathon-finish: no user027 comment (preload, noise)
  - post-studio-session: no user027 comment (preload, noise)
  - post-mountain-bike: no comments at all (preload, noise)
  - post-street-food: no user027 comment (preload, noise)
  - post-code-conference: has comment by user003, not user027 (distractor)
  - post-skydiving: has comment by user027 "So brave! How was it?" (event, +1)
  - post-art-gallery: has comment by user024, not user027 (distractor)
  - post-hiking-summit: has comment by user027 "That's a fourteener! Respect" (event, +2)
  - post-temple-visit: has comment by user027 "Bucket list destination!" (event, target +3)
  - post-aurora: has comment by user027 "Unreal! Once in a lifetime" (trailing)
  - post-yoga-retreat: has comment by user039, not user027 (trailing)
  - story-security-ops-center: user007 (order 13)
  - story-kubernetes-dashboard: user009 (order 14)
  - dm-4: user003 conversation
  - act-15: follow by user050
  - act-16: like by user042
- **Materialized DB fields the eval_sql reads**: Requires a NEW `comments` table — NOT currently materialized. See handler dependencies.
- **Draft eval_sql** (SQL, must reference real tables/columns after handler change):
  ```sql
  SELECT (SELECT COUNT(DISTINCT post_id) FROM comments WHERE authorId='user027') >= (SELECT CAST(value AS INTEGER) FROM session_meta WHERE key='baseline_commenter_user027_count') + 3
  ```
- **Handler dependencies**: "Requires handler change: `server/handlers/microgram.py` must:
  1. Add a `comments` table to `materialize_to_sqlite` (after line 301). Proposed addition:
     ```python
     conn.execute("CREATE TABLE comments (id TEXT, post_id TEXT, authorId TEXT, text TEXT)")
     conn.executemany(
         "INSERT INTO comments VALUES (?,?,?,?)",
         [(c.get("id"), p.get("id"), c.get("authorId", c.get("author_id", "")), c.get("text"))
          for p in session.microgram_posts for c in p.get("comments", [])],
     )
     ```
  2. Add `commenter_user027_count` to `compute_current_metrics` (line 172):
     ```python
     commenter_user027_count = sum(
         1 for p in session.microgram_posts
         if any(c.get("authorId", c.get("author_id")) == "user027" for c in p.get("comments", []))
     )
     ```
     And include it in the returned dict. This promotes to `baseline_commenter_user027_count` in session_meta."
- **Distinctness from paired target**: Monitors commenter identity on posts (requires opening post modals), whereas the DM keyword scenario below monitors conversation thread text (requires opening DM threads) -- different navigation targets and different tables.
- **Distinctness from existing scenarios**: No existing scenario monitors comment content or commenter identity. All three existing scenarios use post_states, story_states, or followed_users.

---

### dm-count-relative-active

- **Scenario ID**: microgram-dm-count-relative-active
- **Filename**: scenarios/microgram/dm-count-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): DM conversations containing a keyword ("collaborate"), relative to baseline
- **Why this cell**: The DM list only shows the `lastMessage` preview, so verifying whether a specific keyword exists in the full conversation thread requires opening each DM (active). The condition is relative to baseline conversations matching the keyword at /init.
- **User-facing prompt** (natural language, single sentence): "I've gotten a DM from someone wanting to collaborate -- keep checking my messages and let me know when one more conversation comes in that mentions collaborating (you'll need to open conversations to check the full thread)."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_posts — post_ids: [post-golden-gate-run, post-coffee-code, post-sunset-hike, post-kayak-river, post-pasta-making], story_ids: [story-client-success-meeting, story-market-analysis-charts], message_ids: [dm-3], activity_ids: [act-17, act-18]
  - t=100: new_message — dm-4 (lastMessage "See you at the workshop!" -- no "collaborate" anywhere, distractor DM)
  - t=200: new_post — post-vinyl-collection (distractor)
  - t=300: new_message — dm-1 (lastMessage "The photos from the trip are ready!" -- but to make this work, we need a DM with "collaborate" in a non-last message)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**: dm-3 (contains "Would love to collaborate!" as lastMessage), dm-4 (no "collaborate"), dm-1 (no "collaborate")
- **Materialized DB fields the eval_sql reads**: `messages.data` LIKE '%collaborat%' at microgram.py line 322-325; `session_meta.baseline_dm_collaborate_count` (DOES NOT EXIST).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM messages WHERE data LIKE '%collaborat%') >= (SELECT CAST(value AS INTEGER) FROM session_meta WHERE key='baseline_dm_collaborate_count') + 1
  ```
- **Handler dependencies**: "Requires handler change: add scenario-specific baseline. However, there is a critical feasibility issue (see below)."

**FEASIBILITY NOTE**: This scenario has a fundamental problem. The keyword "collaborate" appears in dm-3's **lastMessage** ("Would love to collaborate!"), which is visible in the DM list without opening the conversation. This makes the preloaded baseline item passive-detectable. Furthermore, the only DMs in the catalog are dm-1 through dm-4, and NONE of the remaining ones contain "collaborate" in a non-last message position. There is no valid catalog conversation where "collaborate" is hidden from the list view. **This target cannot be implemented with the current catalog without adding new DM entries to `messages.jsonl`.** I include it to document the gap but flag it as blocked.

---

**Active-relative cell: honest assessment**

Only 1 genuinely distinct, feasible active-relative target exists with the current catalog data: **comments-relative-active** (commenter identity hidden in post modal). The second candidate (DM keyword relative) is blocked because the catalog has only 4 DM conversations and none has a keyword hidden exclusively in non-last messages that could also serve as a delta target. To fill this cell with 2 distinct targets, the catalog would need additional DM conversations (`messages.jsonl`) with keywords buried in earlier messages, or the handler would need to materialize additional detail-only fields. I propose only the 1 feasible target and flag the gap.

---

### Critique of existing scenarios

- **`microgram-follows-absolute-active`**: Mis-axised as "active." The prompt says "For the next 3 new creators to appear in my feed, open their profiles and follow them." This is an agent-action task, not a pure monitoring task. The "active" classification relies on profile navigation for the follow action, but the DETECTION of new creators is passive (new posts appear in the feed with visible author usernames). More critically, the eval_sql checks `followed_users` (an agent-action table), making this an action-gated scenario. The scenario is valid per the benchmark rules (agent actions gated by future events) but the "active" label should be understood as "active due to required navigation for the action" rather than "active monitoring of hidden content." This is distinct from MicroMail's active scenarios where the CONDITION ITSELF (keyword in hidden body, CC list) is only verifiable by opening detail views.

- **`microgram-stories-absolute-passive`**: The prompt says "Keep an eye on the story bar. Let me know when 3 new stories appear." but the eval_sql checks `story_states WHERE isViewed=1` -- it requires the agent to VIEW (tap into) the stories, not merely notice them. Stories in the story bar show a thumbnail circle with the author username, but their content (the full-screen story image) requires tapping into the story viewer. If the eval truly requires viewing, this is arguably active (tap-to-view is a detail navigation), yet it's classified passive. The mismatch between the prompt ("let me know when 3 new stories appear" -- noticing is passive) and the eval_sql ("isViewed=1" -- viewing is an action that requires tapping) creates ambiguity. Consider either: (a) changing eval_sql to `COUNT(*) FROM stories >= baseline + 3` (pure passive monitoring of story count), or (b) updating the prompt to "Watch for 3 new stories and view them" to match the action-requiring eval.

- **`microgram-likes-absolute-passive`**: Similar issue to stories -- the prompt says "like the next 3 new posts that show up" and eval_sql checks `isLiked=1`. This is correctly classified as passive for the MONITORING axis (new posts are visible in feed), but note that it's fundamentally an action task ("like the posts") rather than a pure watch-and-report monitoring task. The `NEEDS_USER_ACTION` entry in `test_eval_sql.py` (line 35) confirms this. Not a bug per se, but it means all 3 existing MicroGram scenarios are action-gated rather than pure monitoring, which is a deviation from the MicroMail pattern where 6 of 8 scenarios are pure watch-and-report.

## MicroHood

### MicroHood inventory

**1. Endpoints exposed (from `server/server.py`)**
- `GET  /data/microhood-stocks` — `{stocks: [{symbol, name, color, orgId, currentPrice, change, changePercent, shares, avgCost}]}` (server.py:1398-1420)
- `GET  /data/microhood-watchlist` — `{watchlist: [{symbol, name, price, change, changePercent, inWatchlist}]}` (server.py:1423-1443)
- `GET  /data/microhood-news` — `{news: [{id, source, title, time}]}` (server.py:1446-1449)
- `GET  /data/microhood-portfolio` — `{buying_power, positions_value, portfolio_value, total_gain, total_gain_percent}` (server.py:1452-1466)
- `POST /data/microhood-stocks/{symbol}/order` — `{action, quantity, type, limit_price}` -> `{success, order}` (server.py:1469-1508)
- `POST /data/microhood-watchlist/{symbol}/toggle` — toggles inWatchlist flag (server.py:1511-1530)

Frontend hook `frontend/src/hooks/useMicrohoodData.ts` polls all four GET endpoints every 1s (lines 117-123).

**2. Event types dispatched (`server/handlers/microhood.py`)**
- `preload_stocks` — line 111 (loads stocks, watchlist, news, buying_power; installs price_waypoints at line 164; captures baseline at line 169)
- `new_news` — line 171
- `set_price` — line 177

No other event types are handled. There is no event to add/remove watchlist items server-side, no event to create orders server-side, and no event to change buying_power outside of agent orders.

**3. SQLite tables + columns materialized (`server/handlers/microhood.py:190-243`)**
- `stocks(symbol TEXT, name TEXT, color TEXT, avgCost REAL)` — CREATE at line 191, INSERT at line 194.
- `stock_states(symbol TEXT, shares INT, avgCost REAL)` — CREATE 199, INSERT 201.
- `watchlist(symbol TEXT, data TEXT)` — CREATE 205, INSERT 207.
- `watchlist_states(symbol TEXT, inWatchlist INT)` — CREATE 211, INSERT 213.
- `news(id TEXT, data TEXT)` — CREATE 217, INSERT 219.
- `orders(id TEXT, symbol TEXT, action TEXT, quantity INT, price REAL, type TEXT)` — CREATE 223, INSERT 225. Note: `id` is always NULL for agent-placed orders because the server does not generate order IDs (server.py:1500-1506).
- `current_prices(symbol TEXT, price REAL)` — CREATE 235, INSERT 238. Contains the interpolated price at evaluation time for every loaded stock.
- `session_meta` — receives `buying_power` at line 242. Also receives all `baseline_*` keys from `compute_current_metrics` via server.py:621-624.

**4. Baselines written to `session_meta` at `/init`** — all emitted by `compute_current_metrics` (microhood.py:76-101) and promoted to `session_meta` rows keyed `baseline_<name>` by server.py:621-624:
- `baseline_portfolio_value` (microhood.py:95) — buying_power + sum(shares * price) = ~$103,526.55 when all stocks loaded with $10k buying power
- `baseline_buying_power` (microhood.py:96) — $10,000.00
- `baseline_positions_value` (microhood.py:97) — ~$93,526.55
- `baseline_order_count` (microhood.py:98) — 0
- `baseline_watchlist_count` (microhood.py:99) — 4 when all watchlist loaded
- `baseline_mcro_price` (microhood.py:100) — $450.00

All six baselines are available for relative scenarios. No handler change is required.

**5. Current scenario distribution (`scenarios/microhood/*.json`, excluding `dev.json`)**
- passive-absolute: 1 — `microhood-portfolio-absolute-passive` (target: portfolio value >= $108,837)
- passive-relative: 0
- active-absolute: 1 — `microhood-orders-absolute-active` (target: agent places a buy order for DRNE when price >= $42.20)
- active-relative: 0

Gaps: 1 new passive-absolute, 2 new passive-relative, 1 new active-absolute, 2 new active-relative = **6 proposals**.

**List-view observability** (cross-checked against `frontend/src/environments/MicroHood.tsx`):
- **Passive** (visible on main page without navigation): portfolio value + gain/loss (MicroHood.tsx:754-763), individual stock prices and % change in the Stocks list (MicroHood.tsx:866-914), watchlist items with prices (MicroHood.tsx:1160-1214), news titles and sources in sidebar (MicroHood.tsx:1217-1228), buying power (MicroHood.tsx:821-853), MCRO chart (MicroHood.tsx:766-787).
- **Active** (requires clicking a stock or placing an order): per-stock position details (shares, market value, avg cost, total return) only appear in the sidebar detail panel after clicking a stock (MicroHood.tsx:1066-1100). Analyst ratings (MicroHood.tsx:1141-1157) are hardcoded cosmetic data, not from the API. The order modal requires explicit navigation (MicroHood.tsx:1319ff). News items have no body text (only title visible in sidebar), so there is no "hidden news content" requiring drill-in. The catalog `news.jsonl` only has `{id, source, title, time}` fields.

**Implication for "active" classification**: MicroHood has no hidden textual content (no news bodies, no analyst notes, no stock descriptions in the catalog). "Active" scenarios in this environment require the agent to **perform actions** (placing orders) gated by future price events, matching the pattern of the existing `orders-absolute-active`. The monitoring part (watching prices) is passive, but the required response (navigating to order modal, configuring and submitting the order) constitutes the active dimension. This is analogous to MicroGram's action-gated scenarios.

---

### price-absolute-passive

- **Scenario ID**: microhood-price-absolute-passive
- **Filename**: scenarios/microhood/price-absolute-passive.json
- **Cell**: passive-absolute
- **Monitored target** (noun phrase): individual stock price
- **Why this cell**: absolute (fixed price threshold: CHIP reaching $520); passive (each stock's current price is shown in the main Stocks list at MicroHood.tsx:872-874 without requiring any click-through).
- **User-facing prompt**: "Watch ChipForge Industries (CHIP) for me and let me know when it reaches $520."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_stocks event with stock_symbols=["*"], watchlist_symbols=["*"], news_ids=["1","2","3","4","5","6","7","8","9","10"], buying_power=10000.0, price_waypoints={"CHIP": [[0, 495.2], [300, 520.0], [600, 535.0]]} — CHIP starts at catalog price $495.20, rises to $520.00 at t=300, continues rising. Only CHIP gets waypoints; all other stocks stay flat.
  - t=80: new_news — news_id="17" (distractor: "Renewable energy investments hit all-time high")
  - t=180: new_news — news_id="18" (distractor: "Banking sector posts strong quarterly earnings")
  - t=300: CHIP price crosses $520.00 via waypoint interpolation (target condition met)
  - t=400: new_news — news_id="19" (trailing: "Startup funding rebounds in Q4 after slowdown")
  - t=520: new_news — news_id="20" (trailing: "Labor market remains tight despite tech layoffs")
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against `data/catalogs/microhood/stocks.jsonl` and `news.jsonl`):
  - CHIP: ChipForge Industries, currentPrice $495.20 (stocks.jsonl line 5)
  - news 17: "Renewable energy investments hit all-time high" (news.jsonl line 17)
  - news 18: "Banking sector posts strong quarterly earnings" (news.jsonl line 18)
  - news 19: "Startup funding rebounds in Q4 after slowdown" (news.jsonl line 19)
  - news 20: "Labor market remains tight despite tech layoffs" (news.jsonl line 20)
- **Materialized DB fields the eval_sql reads**: `current_prices.price` where `symbol='CHIP'` — written by microhood.py:235-238 via `get_current_prices()` at line 234.
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT price FROM current_prices WHERE symbol='CHIP') >= 520.0
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: The other passive-absolute slot is filled by `portfolio-absolute-passive` (aggregate portfolio value). This scenario targets a single stock's price — a completely different noun (individual price vs. portfolio total).
- **Distinctness from existing scenarios**: `portfolio-absolute-passive` moves all 50 stocks' prices upward to hit an aggregate threshold; this scenario moves only one stock (CHIP) and checks its individual price. `orders-absolute-active` watches DRNE's price and requires placing an order; this scenario watches CHIP's price with no agent action required. No overlap.

---

### portfolio-relative-passive

- **Scenario ID**: microhood-portfolio-relative-passive
- **Filename**: scenarios/microhood/portfolio-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): total portfolio value growth percentage
- **Why this cell**: relative (portfolio must grow by 5% from its baseline value at session start, using `baseline_portfolio_value` from session_meta); passive (portfolio value is displayed prominently at the top of the main page at MicroHood.tsx:754-757, along with gain percentage at MicroHood.tsx:759-763).
- **User-facing prompt**: "Watch my portfolio value and let me know when it's up 5% from where it started."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_stocks event with stock_symbols=["*"], watchlist_symbols=["*"], news_ids=["1","2","3","4","5"], buying_power=10000.0, price_waypoints for a subset of major holdings that collectively push portfolio value up ~5% by t=300. Baseline portfolio value ~$103,526.55; target = $103,526.55 * 1.05 = ~$108,702.88. The needed gain is ~$5,176.33 in positions_value. Waypoints (prices engineered to deliver ~5% aggregate growth):
    - "MCRO": [[300, 482.0], [600, 500.0]] — 15 shares, from $450.00 to $482.00 = +$480.00
    - "PEAR": [[300, 196.0], [600, 205.0]] — 25 shares, from $181.50 to $196.00 = +$362.50
    - "VRTX": [[300, 530.0], [600, 560.0]] — 6 shares, from $478.90 to $530.00 = +$306.60
    - "CHIP": [[300, 545.0], [600, 570.0]] — 5 shares, from $495.20 to $545.00 = +$249.00
    - "AURA": [[300, 165.0], [600, 180.0]] — 20 shares, from $138.45 to $165.00 = +$531.00
    - "GLXY": [[300, 395.0], [600, 420.0]] — 8 shares, from $345.60 to $395.00 = +$395.20
    - "ARIA": [[300, 510.0], [600, 540.0]] — 6 shares, from $445.30 to $510.00 = +$388.20
    - "BLKC": [[300, 305.0], [600, 330.0]] — 10 shares, from $256.80 to $305.00 = +$482.00
    - "ORBT": [[300, 435.0], [600, 460.0]] — 7 shares, from $378.90 to $435.00 = +$392.70
    - "COSM": [[300, 345.0], [600, 370.0]] — 9 shares, from $284.50 to $345.00 = +$544.50
    - "NOVA": [[300, 485.0], [600, 510.0]] — 5 shares, from $425.60 to $485.00 = +$297.00
    - "ROBO": [[300, 225.0], [600, 245.0]] — 10 shares, from $178.90 to $225.00 = +$461.00
    - Total gain at t=300: ~$4,889.70. Need ~$286.63 more from the remaining ~38 flat stocks -- close enough with slight adjustment. Adjust MCRO to $484.00 (+$510.00 total) and BLKC to $310.00 (+$532.00 total) to hit ~$5,261.70. Fine-tuning in authoring.
  - t=60: new_news — news_id="11" (distractor)
  - t=150: new_news — news_id="14" (distractor)
  - t=300: portfolio value crosses baseline + 5% via accumulated waypoint interpolation (target condition met)
  - t=400: new_news — news_id="17" (trailing)
  - t=550: new_news — news_id="20" (trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - All 50 stocks via ["*"] (stocks.jsonl lines 1-50)
  - All 4 watchlist items via ["*"] (watchlist.jsonl lines 1-4)
  - news 1-5 (preloaded), 11 (t=60), 14 (t=150), 17 (t=400), 20 (t=550)
- **Materialized DB fields the eval_sql reads**: `session_meta.value` where key=`baseline_portfolio_value` (written via microhood.py:169 -> compute_current_metrics -> server.py:621-624), `current_prices.price` (microhood.py:235-238), `stock_states.shares` (microhood.py:199-201), `session_meta.value` where key=`buying_power` (microhood.py:242).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT CAST(value AS REAL) FROM session_meta WHERE key='buying_power') + COALESCE((SELECT SUM(ss.shares * cp.price) FROM stock_states ss JOIN current_prices cp ON ss.symbol=cp.symbol), 0) >= CAST((SELECT value FROM session_meta WHERE key='baseline_portfolio_value') AS REAL) * 1.05
  ```
- **Handler dependencies**: No handler changes required. `baseline_portfolio_value` is already written at microhood.py:169.
- **Distinctness from paired target**: The paired relative-passive scenario (`news-count-relative-passive` below) monitors news article count. This monitors aggregate portfolio value growth — a completely different metric (dollar value vs. item count).
- **Distinctness from existing scenarios**: `portfolio-absolute-passive` checks an absolute dollar threshold ($108,837). This checks a relative percentage growth (5% above baseline). The eval_sql references `baseline_portfolio_value` which the absolute scenario does not.

---

### news-count-relative-passive

- **Scenario ID**: microhood-news-count-relative-passive
- **Filename**: scenarios/microhood/news-count-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): count of news articles
- **Why this cell**: relative (3 more news items than the baseline count at session start); passive (news titles are fully visible in the sidebar at MicroHood.tsx:1217-1228 without any click-through).
- **User-facing prompt**: "Keep an eye on the news feed in MicroHood and let me know when 3 new articles have appeared since I opened the page."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_stocks event with stock_symbols=["*"], watchlist_symbols=["*"], news_ids=["1","2","3","4","5"], buying_power=10000.0. Baseline news count = 5. No price_waypoints (prices stay flat — not load-bearing for this scenario).
  - t=70: new_news — news_id="6" (article #6, +1)
  - t=160: new_news — news_id="7" (article #7, +2)
  - t=300: new_news — news_id="8" (article #8, +3 = target crossing)
  - t=400: new_news — news_id="9" (trailing +4)
  - t=520: new_news — news_id="10" (trailing +5)
  - t=650: new_news — news_id="11" (trailing +6)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (all verified in `data/catalogs/microhood/news.jsonl`):
  - news 1: "Tech stocks rally as central bank signals rate stability" (preload)
  - news 2: "MicroSystems expands AI partnership with leading startups" (preload)
  - news 3: "Market opens higher on strong earnings reports" (preload)
  - news 4: "Quarterly GDP growth exceeds expectations at 3.2%" (preload)
  - news 5: "Tech sector leads market gains amid AI optimism" (preload)
  - news 6: "Federal Reserve maintains interest rates, signals future cuts" (t=70)
  - news 7: "Chipmakers surge on strong demand for AI processors" (t=160)
  - news 8: "Pharmaceutical stocks rise on promising drug trial results" (t=300, target)
  - news 9: "Electric vehicle sales hit record high in Q3" (t=400)
  - news 10: "Oil prices stabilize as OPEC maintains production levels" (t=520)
  - news 11: "Cloud computing revenues surge 25% year-over-year" (t=650)
- **Materialized DB fields the eval_sql reads**: `news.id` (microhood.py:217-219), `session_meta.value` where key=`baseline_news_count`.
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM news) >= CAST((SELECT value FROM session_meta WHERE key='baseline_news_count') AS INTEGER) + 3
  ```
- **Handler dependencies**: **Requires handler change**: `compute_current_metrics` (microhood.py:76-101) does not currently track `news_count`. A new entry `"news_count": len(session.microhood_news)` must be added to the metrics dict so that `baseline_news_count` is written to `session_meta`. This is a one-line addition at ~microhood.py:101. Without this change, the `baseline_news_count` key will not exist in `session_meta` and the eval_sql will fail.
- **Distinctness from paired target**: The paired relative-passive scenario (`portfolio-relative-passive` above) monitors portfolio value growth. This monitors news article count — a completely different data source (financial positions vs. news feed).
- **Distinctness from existing scenarios**: No existing scenario monitors news count. The existing scenarios monitor portfolio dollar value and order placement. News is an orthogonal data dimension.

---

### sell-order-absolute-active

- **Scenario ID**: microhood-sell-order-absolute-active
- **Filename**: scenarios/microhood/sell-order-absolute-active.json
- **Cell**: active-absolute
- **Monitored target** (noun phrase): sell order placed on a specific stock
- **Why this cell**: absolute (fixed price threshold: MCRO reaching $480); active (the agent must navigate to the order modal and place a sell order — this requires clicking Buy/Sell buttons and submitting the order form at MicroHood.tsx:1319-1505, which is not visible from the main list view).
- **User-facing prompt**: "Watch MCRO for me. If it goes above $480, sell 5 shares at market price and let me know."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_stocks event with stock_symbols=["*"], watchlist_symbols=["*"], news_ids=["1","2","3","4","5","6"], buying_power=10000.0, price_waypoints={"MCRO": [[0, 450.0], [300, 481.0], [600, 495.0]]} — MCRO starts at catalog price $450.00, rises to $481.00 at t=300 (above $480 threshold), continues to $495.00.
  - t=100: new_news — news_id="7" (distractor: "Chipmakers surge on strong demand for AI processors")
  - t=200: new_news — news_id="8" (distractor: "Pharmaceutical stocks rise on promising drug trial results")
  - t=300: MCRO price crosses $480 via waypoint interpolation; agent should place sell order
  - t=420: new_news — news_id="9" (trailing: "Electric vehicle sales hit record high in Q3")
  - t=560: new_news — news_id="10" (trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - MCRO: MicroSystems Corp, currentPrice $450.00, 15 shares (stocks.jsonl line 1)
  - news 1-6 (preloaded), 7 (t=100), 8 (t=200), 9 (t=420), 10 (t=560)
- **Materialized DB fields the eval_sql reads**: `orders.symbol`, `orders.action`, `orders.quantity`, `orders.type`, `orders.price` — written by microhood.py:223-230 after agent calls POST /data/microhood-stocks/MCRO/order (server.py:1499-1506).
- **Draft eval_sql**:
  ```sql
  SELECT EXISTS(SELECT 1 FROM orders WHERE symbol='MCRO' AND action='sell' AND quantity=5 AND type='market' AND price >= 480.0)
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: The other active-absolute slot is filled by `orders-absolute-active` (buy 2 shares of DRNE at $42.20). This scenario requires a **sell** order on **MCRO** — different stock, different action direction, different quantity, different price level.
- **Distinctness from existing scenarios**: `orders-absolute-active` is a buy order on DRNE triggered at $42.20. This is a sell order on MCRO triggered at $480. Different symbol, different direction, different threshold.

---

### buy-dip-relative-active

- **Scenario ID**: microhood-buy-dip-relative-active
- **Filename**: scenarios/microhood/buy-dip-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): stock price drop triggering a buy order
- **Why this cell**: relative (VOLT must drop 10% below its starting price, referencing the baseline via price comparison); active (the agent must place a buy order through the order modal at MicroHood.tsx:1319-1505).
- **User-facing prompt**: "Watch Voltaic Motors (VOLT) for me. If it drops more than 10% from its current price, buy 3 shares at market price and let me know."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_stocks event with stock_symbols=["*"], watchlist_symbols=["*"], news_ids=["1","2","3","4","5","6","7","8"], buying_power=10000.0, price_waypoints={"VOLT": [[0, 248.42], [150, 235.0], [300, 223.0], [600, 218.0]]} — VOLT starts at catalog price $248.42, drifts down through $235 at t=150 (still above 10% drop threshold of $223.58), hits $223.00 at t=300 (below the 10% threshold of ~$223.58), and continues declining to $218.00.
  - t=90: new_news — news_id="9" (distractor: "Electric vehicle sales hit record high in Q3" — note: this is about EV sales broadly, not about VOLT declining, so it does not mislead)
  - t=200: new_news — news_id="10" (distractor: "Oil prices stabilize as OPEC maintains production levels")
  - t=300: VOLT price reaches $223.00 (below $248.42 * 0.90 = $223.58); agent should place buy order
  - t=420: new_news — news_id="15" (trailing: "Housing market cools as mortgage rates remain elevated")
  - t=560: new_news — news_id="16" (trailing: "Global trade volumes increase amid economic recovery")
  - event_timeline_end: 720.0
- **Catalog IDs claimed**:
  - VOLT: Voltaic Motors, currentPrice $248.42, 10 shares (stocks.jsonl line 4)
  - news 1-8 (preloaded), 9 (t=90), 10 (t=200), 15 (t=420), 16 (t=560)
- **Materialized DB fields the eval_sql reads**: `orders.symbol`, `orders.action`, `orders.quantity`, `orders.type` — written by microhood.py:223-230 after agent calls POST /data/microhood-stocks/VOLT/order. Also `current_prices.price` where symbol='VOLT' (microhood.py:235-238) and `session_meta.value` where key='baseline_mcro_price' (not needed; the relative threshold is stated in the prompt as "10% from current price" so the agent computes it from the initial visible price, but eval_sql only needs to verify the order was placed at a price <= 90% of starting).
- **Draft eval_sql**:
  ```sql
  SELECT EXISTS(SELECT 1 FROM orders WHERE symbol='VOLT' AND action='buy' AND quantity=3 AND type='market' AND price <= 223.58)
  ```
- **Handler dependencies**: No handler changes required. The eval_sql checks that the order was placed at a price at or below the 10% drop threshold ($248.42 * 0.90 = $223.578, rounded to $223.58). The agent monitors the price visually and places the order when it crosses below.
- **Distinctness from paired target**: The paired relative-active scenario (`rebalance-relative-active` below) monitors portfolio-level gain and requires a different action (sell). This scenario monitors a single stock's price decline and requires a buy. Different monitoring target (single stock drop vs. portfolio gain), different action (buy vs. sell), different stock.
- **Distinctness from existing scenarios**: `orders-absolute-active` is a buy triggered by DRNE rising to an absolute level. This is a buy triggered by VOLT falling a relative percentage. Different stock, opposite price direction, relative vs. absolute framing.

---

### rebalance-relative-active

- **Scenario ID**: microhood-rebalance-relative-active
- **Filename**: scenarios/microhood/rebalance-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): stock gain triggering a profit-taking sell order
- **Why this cell**: relative (NEOS must rise 15% above its starting price); active (the agent must sell shares through the order modal at MicroHood.tsx:1319-1505).
- **User-facing prompt**: "Keep an eye on Neos Pharmaceuticals (NEOS). If it goes up 15% or more from where it is now, sell all 12 of my shares to lock in the gains."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_stocks event with stock_symbols=["*"], watchlist_symbols=["*"], news_ids=["1","2","3","4","5","6","7"], buying_power=10000.0, price_waypoints={"NEOS": [[0, 92.3], [150, 100.0], [300, 106.2], [600, 112.0]]} — NEOS starts at catalog price $92.30. At t=150 it reaches $100.00 (8.3% gain, still below 15% threshold of $106.145). At t=300 it reaches $106.20 (15.06% gain, above threshold). Continues to $112.00.
  - t=80: new_news — news_id="8" (distractor: "Pharmaceutical stocks rise on promising drug trial results" — note: this title mentions pharmaceuticals broadly but does NOT indicate NEOS specifically is surging, and the price at t=80 is still well below threshold)
  - t=180: new_news — news_id="12" (distractor: "Retail sector shows resilience despite inflation concerns")
  - t=300: NEOS price reaches $106.20 (above $92.30 * 1.15 = $106.145); agent should sell 12 shares
  - t=420: new_news — news_id="18" (trailing: "Banking sector posts strong quarterly earnings")
  - t=560: new_news — news_id="19" (trailing: "Startup funding rebounds in Q4 after slowdown")
  - event_timeline_end: 720.0

  **Filler concern**: news ID 8 ("Pharmaceutical stocks rise on promising drug trial results") mentions pharmaceuticals while NEOS is Neos Pharmaceuticals. However, this filler fires at t=80 when NEOS is at ~$97 (only ~5% gain), well below the 15% threshold. The agent should not prematurely conclude the condition is met just because a pharma-related news item appeared. The prompt explicitly states "15% or more from where it is now" — the agent must check the price, not react to news sentiment. This is an acceptable distractor because the monitored target is price-based, not news-content-based. If this is considered too confusing, substitute news_id="13" ("Semiconductor shortage easing, supply chain normalizing") at t=80 instead.
- **Catalog IDs claimed**:
  - NEOS: Neos Pharmaceuticals, currentPrice $92.30, 12 shares (stocks.jsonl line 6)
  - news 1-7 (preloaded), 8 (t=80), 12 (t=180), 18 (t=420), 19 (t=560)
- **Materialized DB fields the eval_sql reads**: `orders.symbol`, `orders.action`, `orders.quantity`, `orders.type` — written by microhood.py:223-230 after agent calls POST /data/microhood-stocks/NEOS/order.
- **Draft eval_sql**:
  ```sql
  SELECT EXISTS(SELECT 1 FROM orders WHERE symbol='NEOS' AND action='sell' AND quantity=12 AND type='market' AND price >= 106.15)
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: The paired relative-active scenario (`buy-dip-relative-active` above) monitors VOLT's price dropping 10% and requires buying. This monitors NEOS rising 15% and requires selling. Different stock, opposite price direction, opposite action.
- **Distinctness from existing scenarios**: `orders-absolute-active` buys DRNE at an absolute price. `sell-order-absolute-active` (proposed above) sells MCRO at an absolute price. This sells NEOS based on a relative percentage gain from starting price — different stock, different threshold type.

---

### Critique of existing scenarios

1. **`orders-absolute-active` activity classification is debatable.** The prompt says "Keep an eye on DRNE for me. If it hits $42.20 or higher, place a market order to buy 2 shares." The MONITORING component — watching DRNE's price — is passive: the price is visible in the main Stocks list (MicroHood.tsx:872-874) without any drill-in. What makes it "active" is the required AGENT ACTION of placing a buy order via the order modal (MicroHood.tsx:1319ff). This is a different flavor of "active" than MicroMail's active scenarios, where the condition itself (keyword in hidden body, CC list) can only be verified by opening detail views. In MicroHood, the condition detection is passive but the response action requires navigation. This is valid under the benchmark rules (SCENARIO_GEN.md line 41: "Agent actions are allowed only when monitoring is still the core task") but should be understood as action-gated active, not detection-gated active.

2. **`portfolio-absolute-passive` waypoint count is excessive.** The scenario defines price_waypoints for all 50 stocks (portfolio-absolute-passive.json lines 33-533), each with only 2 waypoints (one at `condition_at`, one at 720). While functional, this creates a large JSON payload (~500 lines of waypoints). A leaner approach would move only the 10-15 largest holdings (which dominate portfolio value) and leave the rest flat. The scenario works as-is but is harder to audit.

3. **Missing `baseline_news_count` is the single biggest blocker for relative-passive cell.** The handler's `compute_current_metrics` (microhood.py:76-101) computes `portfolio_value`, `buying_power`, `positions_value`, `order_count`, `watchlist_count`, and `mcro_price` — but does NOT compute `news_count`. This means `baseline_news_count` is never written to `session_meta`. The `news-count-relative-passive` proposal above requires a one-line handler change to add `"news_count": len(session.microhood_news)` to the metrics dict. Without this, only one relative-passive target (portfolio value growth) is available from the existing baseline set, and the second slot requires either this handler change or a different target. The alternative second relative-passive target would be `mcro_price` growth (using `baseline_mcro_price`), but that would overlap significantly with `price-absolute-passive` (both monitor a single stock price). The news count baseline addition is the cleanest path to filling both relative-passive slots with distinct targets.

## MicroHub

### MicroHub inventory

**1. Endpoints exposed (from `server/server.py`)**
- `GET  /data/microhub-repository` — `{repository: {id, owner, name, fullName, description, stars, forks, watchers, ...}}` (server.py:1537-1553)
- `GET  /data/microhub-files` — `{files: [{id, name, path, type, parentId, ...}]}` (server.py:1554-1557)
- `GET  /data/microhub-issues` — `{issues: [{id, number, title, body, state, author, labelIds, comments, ...}]}` (server.py:1560-1579)
- `GET  /data/microhub-pulls` — `{prs: [{id, number, title, body, state, author, reviewers, comments, ...}]}` (server.py:1581-1603)
- `GET  /data/microhub-commits` — `{commits: [{id, sha, message, author, ...}]}` (server.py:1605-1608)
- `GET  /data/microhub-runs` — `{runs: [...]}` (server.py:1611-1614)
- `GET  /data/microhub-workflows` — `{workflows: [...]}` (server.py:1617-1620)
- `GET  /data/microhub-wiki` — `{pages: [{id, title, slug, content, ...}]}` (server.py:1623-1626)
- `GET  /data/microhub-projects` — `{projects: [...]}` (server.py:1629-1632)
- `GET  /data/microhub-activity` — `{activity: [...]}` (server.py:1635-1638)
- `GET  /data/microhub-insights` — `{insights: [...]}` (server.py:1641-1644)
- `GET  /data/microhub-releases` — `{releases: [{id, tagName, name, body, ...}]}` (server.py:1647-1650)
- `GET  /data/microhub-labels` — `{labels: [...]}` (server.py:1653-1656)
- `GET  /data/microhub-security` — `{advisories: [...]}` (server.py:1659-1662)
- `GET  /data/microhub-code-scanning` — `{alerts: [...]}` (server.py:1665-1668)
- `GET  /data/microhub-settings` — `{settings: {...}}` (server.py:1671-1674)
- `GET  /data/microhub-deployments` — `{deployments: [...]}` (server.py:1677-1680)
- `GET  /data/microhub-packages` — `{packages: [...]}` (server.py:1683-1686)
- `GET  /data/microhub-users` — `{users: [...]}` (server.py: static fetch, useMicrohubData.ts:357)
- `GET  /data/microhub-following` — `{following: [...]}` (server.py: polled, useMicrohubData.ts:416)
- `GET  /data/microhub-user-created-repos` — `{repositories: [...]}` (server.py:1689-1692)
- `POST /data/microhub-issues/{id}/comment` — add comment to issue (useMicrohubData.ts:487-495)
- `POST /data/microhub-pulls/{id}/comment` — add comment to PR (useMicrohubData.ts:497-505)
- `POST /data/microhub-issues/{id}/close` — close issue (useMicrohubData.ts:507-513)
- `POST /data/microhub-pulls/{id}/merge` — merge PR (useMicrohubData.ts:477-485)
- `POST /data/microhub-repository/star` — toggle star (server.py:1755-1767)
- `POST /data/microhub-repository/watch` — toggle watch (server.py:1770-1778)
- `POST /data/microhub-repository/fork` — toggle fork (server.py: after watch)
- `PATCH /data/microhub-repository` — update repo name/description/visibility (server.py:1738-1753)
- `POST /data/microhub-repos` — create new repo (server.py:1695-1734)
- `POST /data/microhub-issues` — create new issue (useMicrohubData.ts:544-553)
- `POST /data/microhub-users/{username}/follow` — follow user (useMicrohubData.ts:555-559)

Frontend hook `useMicrohubData.ts` polls dynamic data (repository, issues, pulls, runs, activity, projects, following, user-created-repos) every 1s (line 450). Static data (files, commits, workflows, wiki, insights, releases, labels, security, code-scanning, settings, deployments, packages, users) is fetched once (lines 343-386).

**2. Event types the handler dispatches (`server/handlers/microhub.py`)**
- `preload_repo` — line 352 (loads repository, files, issues, PRs, commits, runs, workflows, wiki, projects, activity, insights, releases, labels, security, code scanning, settings, deployments, packages; captures baseline_metrics at line 536)
- `new_issue` — line 538 (adds a single issue from catalog to session)
- `stars_waypoint` — line 546 (adds or adjusts a star count waypoint for interpolation)

No other event types are handled. There is no `new_pr`, `new_commit`, `new_release`, `new_wiki`, or `new_activity` event. Only issues and star counts can change dynamically post-preload.

**3. SQLite tables + columns materialized (`server/handlers/microhub.py:571-681`)**
- `repository(key TEXT, value TEXT)` — line 573, KV pairs from repo dict
- `files(id TEXT, name TEXT, path TEXT, type TEXT, parentId TEXT)` — line 577
- `issues(id TEXT, number INT, title TEXT, state TEXT, author TEXT)` — line 583 (**NOTE: `body` and `labelIds` are NOT materialized**)
- `issue_states(issue_id TEXT, state TEXT)` — line 589
- `prs(id TEXT, number INT, title TEXT, state TEXT, author TEXT)` — line 595
- `pr_states(pr_id TEXT, state TEXT)` — line 601
- `commits(id TEXT, sha TEXT, message TEXT, author TEXT)` — line 607
- `user_created_comments(id TEXT, target_type TEXT, target_id TEXT, body TEXT)` — line 613
- `user_created_issues(id TEXT, title TEXT, body TEXT)` — line 627
- `user_created_prs(id TEXT, title TEXT, body TEXT)` — line 633
- `merged_prs(pr_id TEXT)` — line 639
- `following_users(username TEXT)` — line 645
- `repo_flags(key TEXT, value TEXT)` — line 652; keys: starred, watched, forked, star_count (from `_current_star_count` at line 657), fork_count, watch_count
- JSON-blob tables (id TEXT, data TEXT) for: runs, workflows, wiki, projects, activity, releases, labels, security, code_scanning, deployments, packages — lines 664-681

**4. baseline_* fields written to session_meta at `/init`** — all emitted by `compute_current_metrics` (microhub.py:333-342) and promoted to `session_meta` rows keyed `baseline_<name>` by server.py:621-624:
- `baseline_star_count` — `_current_star_count(session)` (microhub.py:335)
- `baseline_fork_count` — `session.microhub_fork_count` (microhub.py:336)
- `baseline_watch_count` — `session.microhub_watch_count` (microhub.py:337)
- `baseline_issue_count` — `len(session.microhub_issues)` (microhub.py:338)
- `baseline_pr_count` — `len(session.microhub_prs)` (microhub.py:339)
- `baseline_commit_count` — `len(session.microhub_commits)` (microhub.py:340)
- `baseline_comment_count` — `len(session.microhub_user_created_comments)` (microhub.py:341) — always 0 at init

**5. Current scenario distribution (`scenarios/microhub/*.json`, excluding `dev.json`)**
- passive-absolute: 1 — `microhub-browse-absolute-passive` (target: open issue count >= 8)
- passive-relative: 0
- active-absolute: 1 — `microhub-contribute-absolute-active` (target: comment on issue whose body mentions TOTP)
- active-relative: 0

Gaps: 1 new passive-absolute, 2 new passive-relative, 1 new active-absolute, 2 new active-relative = **6 proposals**.

**List-view observability** (cross-checked against `frontend/src/environments/MicroHub.tsx`):
- **Passive** (visible from list/summary views without navigation into detail): star count in repo header (MicroHub.tsx:966-969) and sidebar (MicroHub.tsx:1216), fork/watcher counts (MicroHub.tsx:1222), issue open/closed counts (MicroHub.tsx:1926-1929), PR open/closed counts (MicroHub.tsx:2146-2149), issue titles + labels + author + comment count in issue list (MicroHub.tsx:1957-1982), PR titles + labels + author + review status + checks in PR list (MicroHub.tsx:2155-2189), commit messages + descriptions + SHA in commits view (MicroHub.tsx:1412-1433), release tag names in sidebar (MicroHub.tsx:1239).
- **Active** (requires opening a detail view): issue body text (MicroHub.tsx:2024 — only rendered in IssueDetail), issue comments full text (MicroHub.tsx:2038), PR body text (MicroHub.tsx:2228), PR review comments full text (MicroHub.tsx:2242), wiki page content (MicroHub.tsx:2655-2664 — requires clicking into Wiki tab and selecting a page).

**Key constraint**: Only `new_issue` and `stars_waypoint` events can add data post-preload. PRs, commits, releases, wiki pages, and all other resources are static after `preload_repo`. This limits dynamic scenarios to issue-count-based and star-count-based targets, plus scenarios where the agent must detect and act on newly-arriving issue content.

**Catalog IDs claimed by existing scenarios** (verified by reading `browse-absolute-passive.json` and `contribute-absolute-active.json`):
- `browse-absolute-passive`: preloads i1-i5; fires i6, i7, i9, i10
- `contribute-absolute-active`: preloads i1-i5; fires i6, i11, i13, i14

---

### stars-absolute-passive

- **Scenario ID**: microhub-stars-absolute-passive
- **Filename**: scenarios/microhub/stars-absolute-passive.json
- **Cell**: passive-absolute
- **Monitored target** (noun phrase): repository star count
- **Why this cell**: absolute (fixed threshold of 2000 stars); passive (the star count is displayed prominently in the repo header button at MicroHub.tsx:969 and in the sidebar at MicroHub.tsx:1216 — visible without opening any detail view).
- **User-facing prompt**: "Watch the star count on this repo and let me know when it hits 2,000."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_repo — issue_ids=["i8","i12"] (two closed issues for minimal context), star_waypoints=[[0, 1847], [300, 2000], [600, 2080]]. Initial star count from catalog is 1847 (repository.jsonl line 1). Star count rises linearly from 1847 to 2000 by t=300, continues to 2080 by t=600.
  - t=100: new_issue — issue_id="i15" (distractor: "Upgrade to React 18")
  - t=200: new_issue — issue_id="i16" (distractor: "Add search functionality to sidebar")
  - t=300: star count crosses 2000 via waypoint interpolation (target condition met)
  - t=400: new_issue — issue_id="i18" (trailing distractor: "Add webhook event logging")
  - t=550: new_issue — issue_id="i19" (trailing distractor: "Fix timezone handling in date picker")
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (every ID verified against the relevant JSONL; verified as unclaimed by scanning `browse-absolute-passive.json` and `contribute-absolute-active.json`):
  - i8: "Add CSV export functionality" (state=closed) — issues.jsonl line 8; not fired as event in either existing scenario
  - i12: "Add support for Markdown in comments" (state=closed) — issues.jsonl line 12; not fired in either existing scenario
  - i15: "Upgrade to React 18" — issues.jsonl line 15; not in either existing scenario
  - i16: "Add search functionality to sidebar" — issues.jsonl line 16; not in either existing scenario
  - i18: "Add webhook event logging" — issues.jsonl line 18; not in either existing scenario
  - i19: "Fix timezone handling in date picker" — issues.jsonl line 19; not in either existing scenario
  - repo1: "themicrocorporate/web-platform" — repository.jsonl line 1 (star count = 1847)
- **Materialized DB fields the eval_sql reads**: `repo_flags.value` where `key='star_count'` — written by `_current_star_count()` call at microhub.py:657, which interpolates via `_interpolate_stars` (microhub.py:298-307) using waypoints set by `preload_repo` at microhub.py:378-380.
- **Draft eval_sql**:
  ```sql
  SELECT CAST((SELECT value FROM repo_flags WHERE key='star_count') AS INTEGER) >= 2000
  ```
- **Handler dependencies**: No handler changes required. Star waypoints are already supported via `preload_repo` payload (microhub.py:377-380) and `_current_star_count` (microhub.py:321-326) feeds into `repo_flags` materialization (microhub.py:657).
- **Distinctness from paired target**: The existing passive-absolute (`browse-absolute-passive`) monitors open issue count. This monitors repository star count — a completely different metric (community engagement vs. issue tracker state).
- **Distinctness from existing scenarios**: Neither existing scenario involves star counts. `browse-absolute-passive` counts open issues; `contribute-absolute-active` requires commenting on an issue with specific body content. Stars are an orthogonal data dimension.

---

### issues-relative-passive

- **Scenario ID**: microhub-issues-relative-passive
- **Filename**: scenarios/microhub/issues-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): open issue count growth
- **Why this cell**: relative (4 more open issues than the baseline count at session start, using `baseline_issue_count` from session_meta); passive (the open issue count is displayed as a prominent counter in the Issues tab header at MicroHub.tsx:1926 — "{openIssuesCount} Open" — visible without opening any individual issue).
- **User-facing prompt**: "I already have a few open issues. Let me know when 4 more get filed."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_repo — issue_ids=["i8","i12","i15"] (i8 and i12 are closed, i15 is open; baseline_issue_count=3). Minimal preload so the "4 more" delta is meaningful.
  - t=60: new_issue — issue_id="i16" (+1 open issue, total open = 2)
  - t=140: new_issue — issue_id="i17" (+2 open issues, total open = 3)
  - t=220: new_issue — issue_id="i18" (+3 open issues, total open = 4)
  - t=300: new_issue — issue_id="i19" (+4 open issues; issue_count = 3+4 = 7; target met)
  - t=400: new_issue — issue_id="i20" (trailing distractor)
  - t=550: stars_waypoint — payload: {"delta": 10} (trailing distractor: minor star bump, unrelated to issues)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against issues.jsonl; verified as unclaimed by scanning both existing scenario JSONs):
  - i8: "Add CSV export functionality" (state=closed) — issues.jsonl line 8
  - i12: "Add support for Markdown in comments" (state=closed) — issues.jsonl line 12
  - i15: "Upgrade to React 18" (state=open) — issues.jsonl line 15
  - i16: "Add search functionality to sidebar" (state=open) — issues.jsonl line 16
  - i17: "Improve loading states across the app" (state=open) — issues.jsonl line 17
  - i18: "Add webhook event logging" (state=open) — issues.jsonl line 18
  - i19: "Fix timezone handling in date picker" (state=open) — issues.jsonl line 19
  - i20: "Implement audit logging" (state=open) — issues.jsonl line 20
- **Materialized DB fields the eval_sql reads**: `issues.id` (microhub.py:583-587) via COUNT; `session_meta.value` where key=`baseline_issue_count` (written via compute_current_metrics at microhub.py:338, promoted by server.py:621-624).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM issues) >= CAST((SELECT value FROM session_meta WHERE key='baseline_issue_count') AS INTEGER) + 4
  ```
- **Handler dependencies**: No handler changes required. `baseline_issue_count` is already emitted by `compute_current_metrics` (microhub.py:338).
- **Distinctness from paired target**: The paired relative-passive scenario (`stars-relative-passive` below) monitors star count growth. This monitors issue count growth — different data sources (community engagement metric vs. issue tracker).
- **Distinctness from existing scenarios**: `browse-absolute-passive` checks an absolute issue threshold (>= 8 open). This checks a relative delta (4 more than baseline). Different framing, different preload size, and the eval references `baseline_issue_count` which the absolute scenario does not.

---

### stars-relative-passive

- **Scenario ID**: microhub-stars-relative-passive
- **Filename**: scenarios/microhub/stars-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): repository star count growth
- **Why this cell**: relative (200 more stars than baseline, using `baseline_star_count` from session_meta); passive (star count displayed in repo header at MicroHub.tsx:969 and sidebar at MicroHub.tsx:1216 — no drill-in required).
- **User-facing prompt**: "The repo is getting some attention lately. Watch the star count and tell me when it goes up by 200 from where it is now."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_repo — issue_ids=["i8","i12"] (minimal context), initial_stars=1847 (from catalog), star_waypoints=[[0, 1847], [300, 2047], [600, 2120]]. Baseline star count = 1847. Stars climb linearly from 1847 to 2047 (= 1847+200) at t=300. Continue climbing to 2120.
  - t=80: new_issue — issue_id="i16" (distractor: unrelated to star count)
  - t=180: new_issue — issue_id="i18" (distractor)
  - t=300: star count crosses 2047 (= baseline + 200) via waypoint interpolation (target condition met)
  - t=420: new_issue — issue_id="i19" (trailing distractor)
  - t=560: new_issue — issue_id="i20" (trailing distractor)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against JSONL; verified as unclaimed by scanning existing scenario JSONs):
  - i8: "Add CSV export functionality" — issues.jsonl line 8
  - i12: "Add support for Markdown in comments" — issues.jsonl line 12
  - i16: "Add search functionality to sidebar" — issues.jsonl line 16
  - i18: "Add webhook event logging" — issues.jsonl line 18
  - i19: "Fix timezone handling in date picker" — issues.jsonl line 19
  - i20: "Implement audit logging" — issues.jsonl line 20
  - repo1: repository.jsonl line 1 (stars=1847)
- **Materialized DB fields the eval_sql reads**: `repo_flags.value` where `key='star_count'` (microhub.py:657); `session_meta.value` where `key='baseline_star_count'` (written via compute_current_metrics at microhub.py:335, promoted by server.py:621-624).
- **Draft eval_sql**:
  ```sql
  SELECT CAST((SELECT value FROM repo_flags WHERE key='star_count') AS INTEGER) >= CAST((SELECT value FROM session_meta WHERE key='baseline_star_count') AS INTEGER) + 200
  ```
- **Handler dependencies**: No handler changes required. `baseline_star_count` is already emitted by `compute_current_metrics` (microhub.py:335). Star waypoints are fully supported.
- **Distinctness from paired target**: The paired relative-passive scenario (`issues-relative-passive` above) monitors issue count growth. This monitors star count growth — a completely different metric (issue tracker state vs. community engagement).
- **Distinctness from existing scenarios**: `stars-absolute-passive` (proposed above) checks an absolute star threshold (2000). This checks a relative delta (200 above baseline). Different framing, and the eval references `baseline_star_count` which the absolute scenario does not. No overlap with existing shipped scenarios.

---

### body-compliance-absolute-active

- **Scenario ID**: microhub-body-compliance-absolute-active
- **Filename**: scenarios/microhub/body-compliance-absolute-active.json
- **Cell**: active-absolute
- **Monitored target** (noun phrase): issue body mentioning compliance
- **Why this cell**: absolute (looking for a specific keyword "compliance" in an issue body); active (the issue body is only visible in the IssueDetail view at MicroHub.tsx:2024 — the issue list shows only title, labels, author, and comment count at MicroHub.tsx:1957-1982, and "compliance" does not appear in any issue title — verified across all 20 issues in issues.jsonl). The predicate is wide: the agent cannot predict which NEW issue will mention compliance, so it must open each newly-arrived issue to check the body. This avoids the one-time-drill-in anti-pattern (SCENARIO_GEN.md line 182).
- **User-facing prompt**: "Watch for new issues. If one comes in that mentions compliance in its description, leave a comment on it and let me know."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_repo — issue_ids=["i8","i12","i15"] (minimal context; none mention "compliance" in body or title). No star_waypoints needed.
  - t=80: new_issue — issue_id="i16" (distractor: body="Users with many items need a way to search and filter the sidebar content." — no "compliance")
  - t=170: new_issue — issue_id="i17" (distractor: body="Many areas of the app don't have proper loading states, making the UI feel unresponsive." — no "compliance")
  - t=250: new_issue — issue_id="i18" (distractor: body="We need better visibility into webhook deliveries for debugging purposes." — no "compliance")
  - t=300: new_issue — issue_id="i20" (TARGET: body="For compliance purposes, we need to log all user actions..." — contains "compliance"; title="Implement audit logging" does NOT contain "compliance")
  - t=400: new_issue — issue_id="i19" (trailing distractor: body="Date picker shows incorrect dates..." — no "compliance")
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against issues.jsonl; verified as unclaimed by scanning both existing scenario JSONs):
  - i8: "Add CSV export functionality" — issues.jsonl line 8
  - i12: "Add support for Markdown in comments" — issues.jsonl line 12
  - i15: "Upgrade to React 18" — issues.jsonl line 15
  - i16: "Add search functionality to sidebar" — issues.jsonl line 16
  - i17: "Improve loading states across the app" — issues.jsonl line 17
  - i18: "Add webhook event logging" — issues.jsonl line 18
  - i19: "Fix timezone handling in date picker" — issues.jsonl line 19
  - i20: "Implement audit logging" (TARGET) — issues.jsonl line 20
  - Filler verification: searched all 20 issues for "compliance" in body — only i20 contains it. No filler issue body or title mentions "compliance." No confusing filler.
- **Materialized DB fields the eval_sql reads**: `user_created_comments.target_type` and `user_created_comments.target_id` — written at microhub.py:613-625 from `session.microhub_user_created_comments` (populated by POST /data/microhub-issues/{id}/comment via server.py).
- **Draft eval_sql**:
  ```sql
  SELECT EXISTS(SELECT 1 FROM user_created_comments WHERE target_type='issue' AND target_id='i20')
  ```
- **Handler dependencies**: No handler changes required. The eval checks `user_created_comments`, which is already materialized (microhub.py:613-625).
- **Distinctness from paired target**: The existing active-absolute (`contribute-absolute-active`) targets an issue mentioning TOTP (2FA security topic, issue i14). This targets an issue mentioning compliance (audit logging topic, issue i20). Different keyword, different issue, different topic domain (authentication security vs. regulatory compliance).
- **Distinctness from existing scenarios**: `contribute-absolute-active` uses i14 (TOTP keyword) and fires i6, i11, i13 as distractors. This scenario uses i20 (compliance keyword) and fires i16, i17, i18 as distractors. No ID overlap in event-fired issues. The monitored topics are unrelated (2FA vs. audit compliance).

---

### body-unresponsive-relative-active

- **Scenario ID**: microhub-body-unresponsive-relative-active
- **Filename**: scenarios/microhub/body-unresponsive-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): issue body mentioning "unresponsive," relative to baseline
- **Why this cell**: relative (one issue with "unresponsive" in its body exists at session start; the agent watches for one more — following the `micromail-body-december-relative-active` pattern where the baseline count is implicit from preload rather than stored in `session_meta`); active (the word "unresponsive" appears only in the issue body, not in the title — verified: i4 title="Performance degradation with large datasets" and i17 title="Improve loading states across the app" — so the agent must open each new issue's detail view at MicroHub.tsx:2024 to check the body). The predicate is wide: the agent cannot know which new issue will contain "unresponsive," so it must inspect each new arrival.
- **User-facing prompt**: "I saw a bug report earlier about the UI being unresponsive. Keep an eye on new issues and let me know if another one comes in that also mentions the UI being unresponsive -- you'll need to read through the issue descriptions to check."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_repo — issue_ids=["i4","i8","i12","i15"] (i4 body contains "unresponsive"; i8, i12 are closed fillers; i15 is open filler without "unresponsive"). Baseline: 1 issue with "unresponsive" in body.
  - t=80: new_issue — issue_id="i16" (distractor: body mentions sidebar search — no "unresponsive")
  - t=170: new_issue — issue_id="i18" (distractor: body mentions webhook logging — no "unresponsive")
  - t=250: new_issue — issue_id="i20" (distractor: body mentions audit logging — no "unresponsive")
  - t=300: new_issue — issue_id="i17" (TARGET: body="Many areas of the app don't have proper loading states, making the UI feel unresponsive." — contains "unresponsive"; title does NOT contain "unresponsive")
  - t=420: new_issue — issue_id="i19" (trailing distractor: body mentions timezone/date-picker — no "unresponsive")
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against issues.jsonl; verified as unclaimed by scanning both existing scenario JSONs):
  - i4: "Performance degradation with large datasets" (preload, body contains "unresponsive") — issues.jsonl line 4. NOTE: i4 is also preloaded in both existing scenarios. This overlap in preloads is consistent with existing precedent (i1-i5 are preloaded in both shipped scenarios).
  - i8: "Add CSV export functionality" — issues.jsonl line 8
  - i12: "Add support for Markdown in comments" — issues.jsonl line 12
  - i15: "Upgrade to React 18" — issues.jsonl line 15
  - i16: "Add search functionality to sidebar" — issues.jsonl line 16
  - i17: "Improve loading states across the app" (TARGET) — issues.jsonl line 17
  - i18: "Add webhook event logging" — issues.jsonl line 18
  - i19: "Fix timezone handling in date picker" — issues.jsonl line 19
  - i20: "Implement audit logging" — issues.jsonl line 20
  - Filler verification: searched all 20 issues for "unresponsive" in body — only i4 and i17 contain it. No filler issue body or title mentions "unresponsive." Specifically verified: i16 body has "search and filter" (no), i18 body has "webhook deliveries" (no), i20 body has "compliance" (no), i19 body has "incorrect dates" (no).
- **Materialized DB fields the eval_sql reads**: `issues.body` — **NOT currently materialized**. The `issues` table at microhub.py:583 only has `(id, number, title, state, author)`. See handler dependencies below.
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM issues WHERE LOWER(body) LIKE '%unresponsive%') >= 2
  ```
- **Handler dependencies**: **Requires handler change**: add `body TEXT` column to the `issues` table materialization at microhub.py:583-587. Specifically:
  - Line 583: change `CREATE TABLE issues (id TEXT, number INT, title TEXT, state TEXT, author TEXT)` to `CREATE TABLE issues (id TEXT, number INT, title TEXT, body TEXT, state TEXT, author TEXT)`
  - Line 586: change the INSERT tuple to include `i.get("body")` in the appropriate position.
  This is a 2-line change. Without it, the eval_sql cannot query issue body content. The same change also unblocks body-keyword queries for the paired active-relative scenario below.
- **Distinctness from paired target**: The paired active-relative scenario (`body-reproduce-relative-active` below) monitors issues with "Steps to reproduce" in the body — a structural section heading in bug reports. This scenario monitors "unresponsive" — a symptom keyword describing UI performance. Different keyword, different semantic category (structural heading vs. descriptive symptom), different target issues (i4+i17 vs. i1+i11).
- **Distinctness from existing scenarios**: `contribute-absolute-active` uses a TOTP keyword and requires commenting. `body-compliance-absolute-active` (proposed above) uses a compliance keyword and requires commenting. This scenario uses "unresponsive" and is a pure monitoring task (no agent action required — just detection). Different keyword, different eval pattern (COUNT vs. EXISTS on user_created_comments), and relative rather than absolute framing.

---

### body-reproduce-relative-active

- **Scenario ID**: microhub-body-reproduce-relative-active
- **Filename**: scenarios/microhub/body-reproduce-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): issue body containing "Steps to reproduce," relative to baseline
- **Why this cell**: relative (one issue with "Steps to reproduce" in body exists at session start; the agent watches for one more — implicit baseline from preload, following `micromail-body-december-relative-active` pattern); active (the phrase "Steps to reproduce" appears only inside issue bodies, never in titles — verified: i1 title="Authentication fails with OAuth providers intermittently" and i11 title="Memory leak in dashboard component" — so the agent must open each new issue's detail view at MicroHub.tsx:2024 to check). The predicate is wide: the agent must inspect every new issue, since it cannot predict which one will contain the target phrase.
- **User-facing prompt**: "One of the existing issues has detailed steps to reproduce the bug. Watch for new issues, and let me know if another one comes in that also includes steps to reproduce -- you'll need to read the issue descriptions to find it."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_repo — issue_ids=["i1","i8","i12","i15"] (i1 body contains "## Steps to reproduce\n1. Open the app in 2+ browser tabs..."; i8, i12 are closed fillers; i15 is open filler). Baseline: 1 issue with "steps to reproduce" in body.
  - t=75: new_issue — issue_id="i16" (distractor: body="Users with many items need a way to search and filter the sidebar content." — no "steps to reproduce," no "Bug Report" heading)
  - t=160: new_issue — issue_id="i18" (distractor: body="We need better visibility into webhook deliveries for debugging purposes." — no "steps to reproduce")
  - t=240: new_issue — issue_id="i20" (distractor: body="For compliance purposes, we need to log all user actions..." — no "steps to reproduce")
  - t=300: new_issue — issue_id="i11" (TARGET: body="## Bug Report\nThe dashboard component has a memory leak...\n\n## Steps to reproduce\n1. Open dashboard\n2. Switch between tabs..." — contains "Steps to reproduce"; title does NOT)
  - t=420: new_issue — issue_id="i17" (trailing distractor: body mentions "unresponsive" but NOT "steps to reproduce")
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against issues.jsonl):
  - i1: "Authentication fails with OAuth providers intermittently" (preload, body contains "Steps to reproduce") — issues.jsonl line 1. NOTE: i1 is preloaded in both existing scenarios; preload overlap is consistent with existing precedent.
  - i8: "Add CSV export functionality" — issues.jsonl line 8
  - i12: "Add support for Markdown in comments" — issues.jsonl line 12
  - i15: "Upgrade to React 18" — issues.jsonl line 15
  - i16: "Add search functionality to sidebar" — issues.jsonl line 16
  - i18: "Add webhook event logging" — issues.jsonl line 18
  - i20: "Implement audit logging" — issues.jsonl line 20
  - i11: "Memory leak in dashboard component" (TARGET) — issues.jsonl line 11. NOTE: i11 is used as an event in `contribute-absolute-active` (at t=351.23). Cross-scenario reuse of i11 follows existing precedent (i6 is used as an event in both shipped scenarios). The two scenarios are never run simultaneously.
  - i17: "Improve loading states across the app" — issues.jsonl line 17
  - Filler verification: searched all 20 issues for "steps to reproduce" in body — only i1 and i11 contain it. No filler issue has "steps to reproduce" in body or title. Additionally verified that no filler has a "## Bug Report" heading that might cause confusion: i16 (no), i18 (no), i20 (no), i17 (no). i19 DOES have "## Bug Report" in body so it was deliberately excluded from filler to avoid semantic confusion per SCENARIO_GEN.md lines 108-115.
- **Materialized DB fields the eval_sql reads**: `issues.body` — requires the same handler change as `body-unresponsive-relative-active` (adding `body TEXT` to the `issues` table at microhub.py:583-587).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM issues WHERE LOWER(body) LIKE '%steps to reproduce%') >= 2
  ```
- **Handler dependencies**: **Requires handler change**: same as `body-unresponsive-relative-active` above — add `body TEXT` column to the `issues` table materialization at microhub.py:583-587. This is the same 2-line change; both active-relative scenarios share this dependency.
- **Distinctness from paired target**: The paired active-relative scenario (`body-unresponsive-relative-active` above) monitors "unresponsive" — a UI symptom keyword. This monitors "Steps to reproduce" — a structural section heading found in well-formatted bug reports. Different keyword, different semantic meaning (symptom description vs. report format structure), and different target issues (i4+i17 vs. i1+i11).
- **Distinctness from existing scenarios**: `contribute-absolute-active` uses TOTP keyword and requires the agent to comment. `body-compliance-absolute-active` uses compliance keyword and requires the agent to comment. This scenario uses "steps to reproduce" and is a pure monitoring task (no comment required). Different keyword, different eval (body LIKE COUNT vs. user_created_comments EXISTS), and relative framing.

---

### Critique of existing scenarios

1. **`browse-absolute-passive` and `contribute-absolute-active` are umbrella names, not specific nouns.** The scenario IDs use "browse" and "contribute" as target names, but these are verb-like activities, not the specific monitored nouns. `browse-absolute-passive` actually monitors "open issue count" (eval: `COUNT(*) FROM issue_states WHERE state='open' >= 8`). `contribute-absolute-active` actually monitors "issue body mentioning TOTP" (the agent must find and comment on i14). More descriptive IDs would be `microhub-open-issues-absolute-passive` and `microhub-body-totp-absolute-active`. This ambiguity makes the taxonomy matrix harder to audit at a glance. My proposals above use noun-based target names (`stars`, `issues`, `body-compliance`, `body-unresponsive`, `body-reproduce`) that directly describe what is being monitored.

2. **`contribute-absolute-active` is borderline one-time drill-in.** The prompt says "Keep an eye on new issues. If one shows up that mentions TOTP as a supported 2FA method, leave a comment on it." Because the TOTP keyword is unique to a single issue (i14), and the issue title "Add two-factor authentication option" already hints strongly at 2FA, an agent could plausibly infer which issue is the target from the title alone and only open that one issue. The active requirement would then reduce to a single drill-in rather than per-cycle inspection of new arrivals. Mitigating factors: (a) the title says "two-factor authentication" not "TOTP," so an agent that only reads titles might miss the distinction; (b) multiple new issues fire before i14, forcing some scanning. But per SCENARIO_GEN.md line 182, a sender-specific or item-specific target only qualifies as per-cycle active if the agent cannot identify the target from metadata alone. The title's strong hint at 2FA weakens this. A stricter active scenario would use a keyword that has zero semantic overlap with any issue title.

3. **The `issues` materialization is missing the `body` column.** The `issues` table (microhub.py:583) only materializes `(id, number, title, state, author)`, omitting `body` and `labelIds`. This means no eval_sql can query issue body content — a significant limitation for active scenarios that depend on body-keyword detection. The existing `contribute-absolute-active` works around this by checking `user_created_comments` (did the agent comment on the right issue?) rather than `issues.body` (does the issue body contain the keyword?). But this forces every active scenario to include an agent action (commenting) rather than supporting pure monitoring. Adding `body TEXT` to the `issues` table (a 2-line change) would enable a richer set of active scenarios, including the two active-relative proposals above. Adding `labelIds TEXT` (as JSON) would also be useful for potential label-based queries, though labels are visible in the list view so they would not serve active scenarios.

---

## MicroLendar

### MicroLendar inventory

**1. Endpoints exposed (from `server/server.py`)**
- `GET  /data/config` -- `{environment, event_timeline_end, selfUser, initial_date}` (server.py:557)
- `GET  /data/microlendar-events` -- `{events: [{id, title, date, time, endTime, color, calendar, description, location, attendees, isTask, isCompleted, isConflict, taskType, order}]}` (server.py:1914-1967)
- `GET  /data/microlendar-tasks` -- `{tasks: [{id, title, completed, dueDate}]}` (server.py:1970-1987)
- `POST /data/microlendar-events` -- create event (server.py:1990-2010)
- `POST /data/microlendar-events/{id}/update` -- update event (server.py:2014-2031)
- `POST /data/microlendar-events/{id}/delete` -- soft-delete event (server.py:2031-2037)
- `POST /data/microlendar-tasks` -- create task (server.py:2044)
- `POST /data/microlendar-tasks/{id}/complete` -- toggle task completion (server.py via hook)
- `POST /data/microlendar-tasks/{id}/delete` -- soft-delete task (server.py via hook)

**2. Event types the handler dispatches (microlendar.py)**
- `preload_events` -- loads event_ids + task_ids from catalog, sets `today` and `initial_date`, captures baseline (line 154)
- `new_event` -- adds a single catalog event by `event_id` (line 196)
- `new_task` -- adds a single catalog task by `event_id` (line 203)

No `new_reminder`, `update_task`, or `rsvp_response` event types exist in the handler.

**3. SQLite tables + columns materialized (microlendar.py:222-278)**
- `events (id TEXT, title TEXT, start_time TEXT, end_time TEXT, category TEXT, is_task INT)` -- line 224
- `event_states (event_id TEXT, deleted INT)` -- line 235
- `tasks (id TEXT, title TEXT, dueDate TEXT)` -- line 241
- `task_states (task_id TEXT, completed INT, deleted INT)` -- line 247
- `user_created_events (id TEXT, title TEXT, date TEXT, time TEXT, endTime TEXT, calendar TEXT, deleted INT)` -- line 257
- `user_created_tasks (id TEXT, title TEXT, dueDate TEXT, completed INT, deleted INT)` -- line 269
- `session_meta (key TEXT PRIMARY KEY, value TEXT)` -- created by server.py:612

**Notable omissions**: The `events` table does NOT include `description`, `location`, or `attendees`. This prevents eval_sql from querying any of these fields directly. All three active proposals below require adding `description TEXT` to the `events` table.

**4. baseline_* fields written to session_meta at /init (microlendar.py:114-144, server.py:621-624)**
- `baseline_event_count` -- total non-task, non-deleted events (line 120)
- `baseline_today_event_count` -- events whose start_time date == session.microlendar_today (line 121)
- `baseline_work_event_count` -- events with category "Work" (line 125)
- `baseline_task_count` -- total non-deleted tasks (line 129)
- `baseline_conflict_count` -- pairwise time-overlap count among events (line 132)

No `baseline_personal_event_count` or `baseline_family_event_count` exists. One passive-relative proposal below requires adding `personal_event_count` to the metrics.

**5. Current scenario distribution by cell**

| Scenario ID | Cell | Target noun | IDs claimed |
|---|---|---|---|
| `events-absolute-passive` | passive-absolute | events | evt001-evt020, task01-task05, today01-today05, noise01, noise02 |
| `tasks-absolute-passive` | passive-absolute | tasks | evt001-evt010, task01-task10, noise01, today01, today02 |
| `work-relative-active` | active-relative | work | work01-work10, task01-task03, noise01, noise02 |

Filled cells: passive-absolute (2/2), active-relative (1/2). Empty cells: passive-relative (0/2), active-absolute (0/2). Need 5 more scenarios.

### What's visible in the MicroLendar list view
**Month view** (MicroLendar.tsx:1188-1210): event chip with `time`, `title`, `duration` badge, and background `color` (maps to category: Work=#039BE5 blue, Personal=#7986CB purple, Family=#33B679 green). No description, no location, no attendees.

**Day view** (MicroLendar.tsx:1356-1405): event block with `title`, `time`-`endTime`, attendee avatars (up to 3, with `title={name}` tooltip), and `location`.

**Schedule view** (MicroLendar.tsx:1537-1555): event row with color dot, `title`, `time`, `location`.

**Tasks panel** (MicroLendar.tsx:1659-1693): flat list with checkbox (completed), `title`, `dueDate`. No hidden detail.

### What requires opening the event detail modal (active)
The event detail modal (MicroLendar.tsx:2061-2149) is the only place that shows:
- `description` (line 2095-2098) -- NEVER visible in any list view
- `calendar` category name (line 2104) -- the word "Work"/"Personal"/"Family" only appears here; list views show only the mapped color
- `attendees` full names (lines 2107-2145) -- day view shows avatars with name in `title` attribute, but month/schedule views show nothing

The cleanest "active" field is `description`: it is exclusively in the detail modal across all view modes.

### Sidebar category legend
The sidebar (MicroLendar.tsx:1027-1049) displays calendar names with matching color checkboxes (Work=blue, Personal=purple, Family=green). An agent reading the sidebar can learn the color-to-category mapping and then identify event categories by chip color in the list view. This makes category-based counting effectively **passive** despite the category name only appearing in the detail modal.

---

### personal-relative-passive

- **Scenario ID**: microlendar-personal-relative-passive
- **Filename**: scenarios/microlendar/personal-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): Personal calendar events
- **Why this cell**: The agent counts events by their purple color (passively visible via the sidebar legend + event chip color in month view), and the condition is relative to the number of Personal events present at session start.
- **User-facing prompt** (natural language, single sentence): "I have a few personal events on my calendar already -- keep an eye out and let me know when 2 more personal events get added."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_events -- event_ids: [evt002, evt003, evt005, evt001, evt004], task_ids: [task06, task07]; today=2024-07-18, initial_date=2024-07-18. Baseline personal_event_count=3 (evt002, evt003, evt005).
  - t=80: new_event -- evt008 (Work, "Coffee with Data Science"). Distractor; not Personal.
  - t=160: new_event -- evt009 (Personal, "Yoga Class"). Personal count = 4.
  - t=240: new_event -- evt010 (Work, "Submit Expense Report"). Distractor; not Personal.
  - t=300: new_event -- evt012 (Personal, "Pick up dry cleaning"). Personal count = 5 = 3+2. condition_at.
  - t=450: new_event -- evt016 (Personal, "Doctor's Follow-up"). Trailing filler.
  - t=600: new_event -- noise03 (Personal, "Get car washed"). Trailing filler.
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against events.jsonl; scanned events-absolute-passive, tasks-absolute-passive, work-relative-active for overlap -- all IDs below appear in at least one existing scenario but are used here independently since scenarios run in isolated sessions):
  - evt001: "Project Apollo Sync" (Work, context)
  - evt002: "Dentist Appointment" (Personal, preload baseline)
  - evt003: "Lunch with Brenda" (Personal, preload baseline)
  - evt004: "Review new UI mockups" (Work, context)
  - evt005: "Climbing at Planet Granite" (Personal, preload baseline)
  - evt008: "Coffee with Data Science" (Work, distractor)
  - evt009: "Yoga Class" (Personal, pre-target)
  - evt010: "Submit Expense Report" (Work, distractor)
  - evt012: "Pick up dry cleaning" (Personal, target)
  - evt016: "Doctor's Follow-up" (Personal, trailing)
  - noise03: "Get car washed" (Personal, trailing)
  - task06: "Buy birthday gift for Mom" (task, context)
  - task07: "Research new climbing shoes" (task, context)
- **Materialized DB fields the eval_sql reads**: `events.category` (microlendar.py:229), `event_states.deleted` (microlendar.py:237), `user_created_events.calendar` + `user_created_events.deleted` (microlendar.py:260), `session_meta.value` where key=`baseline_personal_event_count` (server.py:623).
- **Draft eval_sql**:
  ```sql
  SELECT (
    (SELECT COUNT(*) FROM events e JOIN event_states s ON e.id=s.event_id WHERE s.deleted=0 AND e.is_task=0 AND e.category='Personal')
    + (SELECT COUNT(*) FROM user_created_events WHERE deleted=0 AND calendar='Personal')
  ) >= CAST((SELECT value FROM session_meta WHERE key='baseline_personal_event_count') AS REAL) + 2
  ```
- **Handler dependencies**: Requires handler change: add `personal_event_count` to `compute_current_metrics()` (microlendar.py:114) so that `baseline_personal_event_count` is written to session_meta. Implementation: add `personal_event_count = sum(1 for e in events if e.get("category") == "Personal")` after line 128, and include it in the returned dict.
- **Distinctness from paired target**: Monitors a category-specific event subset (Personal) identified by color, whereas `today-events-relative-passive` monitors a date-specific subset (events on a particular day).
- **Distinctness from existing scenarios**: No existing scenario monitors Personal events. `events-absolute-passive` counts total events; `work-relative-active` counts Work events.

---

### today-events-relative-passive

- **Scenario ID**: microlendar-today-events-relative-passive
- **Filename**: scenarios/microlendar/today-events-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): events on today's date
- **Why this cell**: The agent counts event chips on the today-highlighted date cell in the month view (passively visible as the blue-circled date with event chips), and the condition is relative to the number present at session start.
- **User-facing prompt** (natural language, single sentence): "I already have a few things scheduled for today -- let me know when 3 more events get added to today's schedule."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_events -- event_ids: [today01, today02, today03, today04, today05, evt001, evt002], task_ids: [task01, task02]; today=2024-07-18, initial_date=2024-07-18. Baseline today_event_count=5 (today01-today05 all have start_time 2024-07-18). evt001 (Jul 15) and evt002 (Jul 15) do not count toward today.
  - t=80: new_event -- evt003 (Jul 16, "Lunch with Brenda"). Distractor; not on today's date.
  - t=160: new_event -- today06 (Jul 18, "User Interview Analysis"). Today count = 6.
  - t=200: new_event -- evt004 (Jul 16, "Review new UI mockups"). Distractor; not today.
  - t=250: new_event -- today07 (Jul 18, "HR Training"). Today count = 7.
  - t=300: new_event -- today08 (Jul 18, "Pick up groceries"). Today count = 8 = 5+3. condition_at.
  - t=450: new_event -- today09 (Jul 18, "Gym"). Trailing filler.
  - t=600: new_event -- evt005 (Jul 17, "Climbing at Planet Granite"). Trailing distractor.
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against events.jsonl lines 1-30; scanned all 3 existing scenarios):
  - today01: "Morning Standup" (Jul 18, preload baseline)
  - today02: "Prep for 1:1" (Jul 18, preload baseline)
  - today03: "1:1 with Michael" (Jul 18, preload baseline)
  - today04: "Work on feature brief" (Jul 18, preload baseline)
  - today05: "Team Lunch" (Jul 18, preload baseline)
  - today06: "User Interview Analysis" (Jul 18, pre-target)
  - today07: "HR Training" (Jul 18, pre-target)
  - today08: "Pick up groceries" (Jul 18, target)
  - today09: "Gym" (Jul 18, trailing)
  - evt001: "Project Apollo Sync" (Jul 15, context)
  - evt002: "Dentist Appointment" (Jul 15, context)
  - evt003: "Lunch with Brenda" (Jul 16, distractor)
  - evt004: "Review new UI mockups" (Jul 16, distractor)
  - evt005: "Climbing at Planet Granite" (Jul 17, trailing distractor)
  - task01: "Draft Q3 product brief" (task, context)
  - task02: "Review telemetry for feature X" (task, context)
- **Materialized DB fields the eval_sql reads**: `events.start_time` (microlendar.py:229), `events.is_task` (microlendar.py:229), `event_states.deleted` (microlendar.py:237), `user_created_events.date` + `user_created_events.deleted` (microlendar.py:260), `session_meta.value` where key=`baseline_today_event_count` (server.py:623 -- this baseline already exists, computed at microlendar.py:121-124).
- **Draft eval_sql**:
  ```sql
  SELECT (
    (SELECT COUNT(*) FROM events e JOIN event_states s ON e.id=s.event_id WHERE s.deleted=0 AND e.is_task=0 AND e.start_time LIKE '2024-07-18%')
    + (SELECT COUNT(*) FROM user_created_events WHERE deleted=0 AND date='2024-07-18')
  ) >= CAST((SELECT value FROM session_meta WHERE key='baseline_today_event_count') AS REAL) + 3
  ```
- **Handler dependencies**: No handler changes required. `baseline_today_event_count` is already computed (microlendar.py:121-124) and written to session_meta (server.py:621-624). The `events.start_time` column is already materialized (microlendar.py:229).
- **Distinctness from paired target**: Monitors events filtered by date (July 18), whereas `personal-relative-passive` monitors events filtered by category (Personal). Different filtering dimension.
- **Distinctness from existing scenarios**: No existing scenario monitors events on a specific date. `events-absolute-passive` counts total events across all dates. `work-relative-active` filters by category, not date.

---

### description-hawaii-absolute-active

- **Scenario ID**: microlendar-description-hawaii-absolute-active
- **Filename**: scenarios/microlendar/description-hawaii-absolute-active.json
- **Cell**: active-absolute
- **Monitored target** (noun phrase): event description mentioning Hawaii
- **Why this cell**: The agent must open each new event's detail modal to read its description (description is never visible in month, day, schedule, or task list views -- MicroLendar.tsx:2095-2098 is the only rendering), and the condition is a fixed keyword ("Hawaii") rather than a delta.
- **User-facing prompt** (natural language, single sentence): "I'm expecting a calendar invite about a trip to Hawaii -- the details should be in the event description, so you'll need to open each event to check."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_events -- event_ids: [evt001, evt002, evt003, evt004, evt005], task_ids: [task01, task02]; today=2024-07-18, initial_date=2024-07-18.
  - t=80: new_event -- evt008 ("Coffee with Data Science", desc="Discuss analytics for new feature."). No Hawaii.
  - t=160: new_event -- evt010 ("Submit Expense Report", desc="Expenses for last month's conference."). No Hawaii.
  - t=240: new_event -- evt011 ("Performance Review", desc="Mid-year review with Michael."). No Hawaii.
  - t=300: new_event -- evt013 ("Book flights for vacation", desc="Flights to Hawaii."). condition_at. Title says "vacation" but not Hawaii; desc has "Hawaii."
  - t=450: new_event -- evt014 ("Marketing Campaign Brainstorm", desc="Ideas for the fall campaign."). Trailing.
  - t=600: new_event -- evt016 ("Doctor's Follow-up", desc=""). Trailing.
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against events.jsonl; verified "Hawaii" appears ONLY in evt013 description, line 13; scanned all 3 existing scenarios):
  - evt001: "Project Apollo Sync" (preload context, desc="Sync on Q3 goals for Project Apollo.")
  - evt002: "Dentist Appointment" (preload context, desc="Annual check-up.")
  - evt003: "Lunch with Brenda" (preload context, desc="Catch up on the latest product feedback.")
  - evt004: "Review new UI mockups" (preload context, desc="Go over the latest designs from Edward.")
  - evt005: "Climbing at Planet Granite" (preload context, desc="Bouldering session.")
  - evt008: "Coffee with Data Science" (filler, desc="Discuss analytics for new feature.")
  - evt010: "Submit Expense Report" (filler, desc="Expenses for last month's conference.")
  - evt011: "Performance Review" (filler, desc="Mid-year review with Michael.")
  - evt013: "Book flights for vacation" (TARGET, desc="Flights to Hawaii.")
  - evt014: "Marketing Campaign Brainstorm" (trailing, desc="Ideas for the fall campaign.")
  - evt016: "Doctor's Follow-up" (trailing, desc="")
  - task01: "Draft Q3 product brief" (task, context)
  - task02: "Review telemetry for feature X" (task, context)
- **Filler safety**: "Hawaii" does not appear in any event title or description other than evt013 (verified by full-catalog grep). No filler event's title contains "vacation," "trip," "flight," or "Hawaii." evt013's title "Book flights for vacation" contains "vacation" but not "Hawaii," so an agent that only reads titles would not know this is the target.
- **Materialized DB fields the eval_sql reads**: `events.description` (NOT YET MATERIALIZED -- see handler dependencies), `event_states.deleted` (microlendar.py:237).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM events e JOIN event_states s ON e.id=s.event_id WHERE s.deleted=0 AND e.is_task=0 AND e.description LIKE '%Hawaii%') >= 1
  ```
- **Handler dependencies**: Requires handler change: add `description TEXT` column to the `events` table in `materialize_to_sqlite()` (microlendar.py:224). Change CREATE TABLE to include `description`, and update the INSERT to include `e.get("description", "")`. This is a 2-line change at lines 224 and 229.
- **Distinctness from paired target**: Monitors for "Hawaii" (a travel destination keyword) whereas `description-notifications-absolute-active` monitors for "notifications" (a product-feature keyword). Completely different semantic domains.
- **Distinctness from existing scenarios**: No existing scenario monitors event descriptions or keywords within them. Existing scenarios count events (total, tasks, or work category).

---

### description-notifications-absolute-active

- **Scenario ID**: microlendar-description-notifications-absolute-active
- **Filename**: scenarios/microlendar/description-notifications-absolute-active.json
- **Cell**: active-absolute
- **Monitored target** (noun phrase): event description mentioning a notifications feature
- **Why this cell**: The agent must open each new event's detail modal to read its description (description is only rendered in MicroLendar.tsx:2095-2098), and the condition is a fixed keyword ("notifications") rather than a delta.
- **User-facing prompt** (natural language, single sentence): "I'm waiting for a meeting to be scheduled about the notifications feature -- the specifics should be in the event description, not the title, so you'll need to open each event to check."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_events -- event_ids: [evt006, evt007, evt008, evt009], task_ids: [task03, task04]; today=2024-07-18, initial_date=2024-07-18.
  - t=75: new_event -- evt010 ("Submit Expense Report", desc="Expenses for last month's conference."). No notifications.
  - t=150: new_event -- evt011 ("Performance Review", desc="Mid-year review with Michael."). No notifications.
  - t=225: new_event -- evt019 ("Security Training", desc="Mandatory annual security training."). No notifications.
  - t=300: new_event -- today04 ("Work on feature brief", desc="Draft the brief for the new notifications feature."). condition_at. Title says "feature brief" but not "notifications"; desc has "notifications."
  - t=450: new_event -- evt014 ("Marketing Campaign Brainstorm", desc="Ideas for the fall campaign."). Trailing.
  - t=600: new_event -- evt015 ("New Intern Onboarding", desc="Welcome Steven to the team."). Trailing.
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against events.jsonl; verified "notifications" appears ONLY in today04 description, line 24; scanned all 3 existing scenarios):
  - evt006: "Q3 Planning Session" (preload context, desc="Finalize roadmap for Q3.")
  - evt007: "Family Dinner" (preload context, desc="")
  - evt008: "Coffee with Data Science" (preload context, desc="Discuss analytics for new feature.")
  - evt009: "Yoga Class" (preload context, desc="")
  - evt010: "Submit Expense Report" (filler, desc="Expenses for last month's conference.")
  - evt011: "Performance Review" (filler, desc="Mid-year review with Michael.")
  - evt019: "Security Training" (filler, desc="Mandatory annual security training.")
  - today04: "Work on feature brief" (TARGET, desc="Draft the brief for the new notifications feature.")
  - evt014: "Marketing Campaign Brainstorm" (trailing, desc="Ideas for the fall campaign.")
  - evt015: "New Intern Onboarding" (trailing, desc="Welcome Steven to the team.")
  - task03: "Follow up with legal on ToS changes" (task, context)
  - task04: "Schedule team offsite" (task, context)
- **Filler safety**: "notifications" does not appear in any event title or description other than today04 (verified by full-catalog grep). No filler event title or description contains "notification," "notify," or "alert." today04's title "Work on feature brief" does not mention notifications, so an agent that only reads titles would not identify this as the target.
- **Materialized DB fields the eval_sql reads**: `events.description` (NOT YET MATERIALIZED -- same handler change as description-hawaii), `event_states.deleted` (microlendar.py:237).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM events e JOIN event_states s ON e.id=s.event_id WHERE s.deleted=0 AND e.is_task=0 AND LOWER(e.description) LIKE '%notifications%') >= 1
  ```
- **Handler dependencies**: Requires handler change: add `description TEXT` column to the `events` table (same change as description-hawaii-absolute-active, microlendar.py:224+229).
- **Distinctness from paired target**: Monitors for "notifications" (a product-feature keyword in a work context) whereas `description-hawaii-absolute-active` monitors for "Hawaii" (a travel keyword in a personal context). Different domains, different events.
- **Distinctness from existing scenarios**: No existing scenario monitors description keywords. This is a pure monitoring scenario (no agent action required beyond reading).

---

### description-analytics-relative-active

- **Scenario ID**: microlendar-description-analytics-relative-active
- **Filename**: scenarios/microlendar/description-analytics-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): event descriptions mentioning analytics
- **Why this cell**: The agent must open each new event's detail modal to read its description (active -- description only in MicroLendar.tsx:2095-2098), and the condition is relative: one event with "analytics" in its description already exists at baseline, and the agent must detect when a second one appears.
- **User-facing prompt** (natural language, single sentence): "I have an event coming up that mentions analytics in its description -- let me know if another event gets added that also mentions analytics in its description, since you'll need to open each event to check."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_events -- event_ids: [evt008, evt001, evt002, evt003], task_ids: [task01, task02]; today=2024-07-18, initial_date=2024-07-18. evt008 desc="Discuss analytics for new feature." Baseline: 1 event with "analytics" in description.
  - t=75: new_event -- evt005 ("Climbing at Planet Granite", desc="Bouldering session."). No analytics.
  - t=150: new_event -- evt006 ("Q3 Planning Session", desc="Finalize roadmap for Q3."). No analytics.
  - t=225: new_event -- evt010 ("Submit Expense Report", desc="Expenses for last month's conference."). No analytics.
  - t=300: new_event -- conflict02 ("Vendor Demo", desc="Demo of new analytics software."). condition_at. Title "Vendor Demo" does not mention analytics; desc has "analytics."
  - t=450: new_event -- evt014 ("Marketing Campaign Brainstorm", desc="Ideas for the fall campaign."). Trailing.
  - t=600: new_event -- evt011 ("Performance Review", desc="Mid-year review with Michael."). Trailing.
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against events.jsonl; verified "analytics" appears ONLY in evt008 desc line 8 and conflict02 desc line 52; scanned all 3 existing scenarios):
  - evt008: "Coffee with Data Science" (preload baseline, desc="Discuss analytics for new feature.")
  - evt001: "Project Apollo Sync" (preload context, desc="Sync on Q3 goals for Project Apollo.")
  - evt002: "Dentist Appointment" (preload context, desc="Annual check-up.")
  - evt003: "Lunch with Brenda" (preload context, desc="Catch up on the latest product feedback.")
  - evt005: "Climbing at Planet Granite" (filler, desc="Bouldering session.")
  - evt006: "Q3 Planning Session" (filler, desc="Finalize roadmap for Q3.")
  - evt010: "Submit Expense Report" (filler, desc="Expenses for last month's conference.")
  - conflict02: "Vendor Demo" (TARGET, desc="Demo of new analytics software.")
  - evt014: "Marketing Campaign Brainstorm" (trailing, desc="Ideas for the fall campaign.")
  - evt011: "Performance Review" (trailing, desc="Mid-year review with Michael.")
  - task01: "Draft Q3 product brief" (task, context)
  - task02: "Review telemetry for feature X" (task, context)
- **Filler safety**: "analytics" does not appear in any event title across the entire catalog (verified by full-catalog grep). The only events with "analytics" in their description are evt008 (preloaded) and conflict02 (target). No filler event mentions "analytics," "data science," or "software demo" in its description.
- **Materialized DB fields the eval_sql reads**: `events.description` (NOT YET MATERIALIZED -- same handler change), `events.is_task` (microlendar.py:229), `event_states.deleted` (microlendar.py:237).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM events e JOIN event_states s ON e.id=s.event_id WHERE s.deleted=0 AND e.is_task=0 AND LOWER(e.description) LIKE '%analytics%') >= 2
  ```
- **Handler dependencies**: Requires handler change: add `description TEXT` column to the `events` table (same change as the two absolute-active proposals, microlendar.py:224+229). No additional baseline metric is needed -- the relative nature is captured by the preloaded evt008 establishing 1 matching event, and the eval checking for >= 2 (following the same pattern as MicroMail's `body-december-relative-active`).
- **Distinctness from paired target**: Monitors for the keyword "analytics" (a data/metrics context) whereas `work-relative-active` monitors for the Work category label. Different filtering dimension entirely: keyword in hidden description vs. category classification.
- **Distinctness from existing scenarios**: No existing scenario uses description-keyword matching. The two absolute-active proposals above use different keywords ("Hawaii" and "notifications") targeting different events.

---

### Summary of handler changes required

All 5 proposals share a single handler change to `microlendar.py`:

1. **Add `description TEXT` to the `events` table** (needed by 3 active scenarios):
   - Line 224: change `CREATE TABLE events (id TEXT, title TEXT, start_time TEXT, end_time TEXT, category TEXT, is_task INT)` to `CREATE TABLE events (id TEXT, title TEXT, description TEXT, start_time TEXT, end_time TEXT, category TEXT, is_task INT)`
   - Line 227-233: add `e.get("description", "")` to the INSERT tuple

2. **Add `personal_event_count` to `compute_current_metrics()`** (needed by 1 passive-relative scenario):
   - After line 128: add `personal_event_count = sum(1 for e in events if e.get("category") == "Personal")`
   - In the return dict (line 138): add `"personal_event_count": personal_event_count`

The `today-events-relative-passive` scenario requires no handler changes -- it uses the existing `baseline_today_event_count` metric.

---

### Critique of existing scenarios

1. **`work-relative-active` is borderline passive, not genuinely active.** The scenario monitors Work-category events (eval: `category='Work'`), classified as "active" because the category name ("Work") only appears in the event detail modal (MicroLendar.tsx:2104). However, the sidebar calendar legend (MicroLendar.tsx:1027-1049) explicitly displays "Work" next to a blue checkbox, and all Work events render with a distinctive blue background color (`#039BE5`, server.py:1918) in every list view (month chips, day blocks, schedule rows). An AI agent can trivially learn the color-to-category mapping from a single sidebar read and then identify Work events by color without opening any event details. This makes the category effectively a passive attribute. To be genuinely active, the monitored attribute should be one that is truly invisible from every list view -- such as `description` content, which only appears in the detail modal. Repositioning this scenario to `passive-relative` (with target "work-events") would be more accurate, but that would leave active-relative with 0 shipped scenarios. Alternatively, the scenario could be re-designed with a description-based predicate to make the active classification unambiguous.

2. **`events-absolute-passive` and `tasks-absolute-passive` occupy the same cell with count-based targets that differ only in what is counted.** Both scenarios monitor a simple numeric threshold visible in the respective list views: total events >= 24 and total tasks >= 10. While "events" and "tasks" are technically distinct nouns, the monitoring strategy is identical (count items in a list). In MicroMail's absolute-passive cell, the two targets are qualitatively different: "sender name" (a specific person) and "unread count" (a numeric threshold). MicroLendar could achieve similar diversity if one of the absolute-passive scenarios used a title-keyword target (e.g., "let me know when an event called 'Team Happy Hour' shows up") instead of a second count threshold. That said, the two scenarios do target genuinely different UI elements (calendar grid vs. tasks panel), so the current pairing is defensible.

3. **`events-absolute-passive` preloads 20 events and needs only 4 more, making the threshold detectable very early.** The scenario preloads evt001-evt020 (20 events) plus 5 tasks, then fires 4 new events (today01-today04) to reach the threshold of 24. With `condition_at` randomized to 20.59s, the first 3 new events fire at 6.86s, 12.01s, and 17.16s, meaning the agent sees a rapid burst of events almost immediately. The baseline of 20 events is high relative to the threshold of 24, so the scenario is "easy" in the difficulty axis -- an agent only needs to notice 4 new items. In contrast, `tasks-absolute-passive` preloads 8 tasks and needs 2 more to reach 10, also a small delta. Both scenarios would be more discriminating if the gap between preload count and threshold were larger, requiring the agent to wait through more event deliveries.

---

## MicroScholar

### MicroScholar inventory

**1. Endpoints exposed (from `server/server.py`)**
- `GET  /data/microscholar-papers?search=&advanced=&allWords=&exactPhrase=&atLeastOne=&without=&author=&publication=&dateStart=&dateEnd=` -- returns `{papers: [...]}` with merged paper+state fields; supports server-side search and advanced filtering (server.py:2089-2171)
- `GET  /data/microscholar-papers/{paper_id}` -- single paper detail (server.py:2174-2181)
- `POST /data/microscholar-papers/{paper_id}/cite` -- sets `isCited=True` (server.py:2184-2190)
- `POST /data/microscholar-papers/{paper_id}/save` -- toggles `isSaved` (server.py:2193-2200)
- `GET  /data/microscholar-alerts` -- returns `{alerts: [...]}` with merged alert+state (server.py:2203-2210)
- `POST /data/microscholar-alerts/{alert_id}/read` -- sets `isRead=True` (server.py:2213-2219)
- `GET  /data/microscholar-coauthors` -- returns `{coauthors: [...]}` (server.py:2222-2225)
- `GET  /data/microscholar-users` -- returns users with `microscholar` key (server.py:2228-2231)

**2. Event types dispatched (`server/handlers/microscholar.py`)**
- `preload_papers` -- line 150: loads papers by `paper_ids`, alerts by `alert_ids`, all coauthors; captures baseline at line 176
- `inject_target_paper` -- line 178: adds a single target paper by ID
- `new_paper` -- line 185: adds a single paper by ID
- `new_alert` -- line 192: adds a single alert by ID

No `new_citation`, `update_citation_count`, or other event types are handled.

**3. SQLite tables + columns materialized (`server/handlers/microscholar.py:211-253`)**
- `papers(id TEXT, title TEXT, authors TEXT, year INT, isTargetPaper INT, taskType TEXT)` -- CREATE at line 212, INSERT at lines 215-223. **Not materialized**: `source`, `snippet`, `citedBy`, `authorIds`, `authorDetails`, `versions`, `isBook`.
- `paper_states(paper_id TEXT, isSaved INT, isCited INT)` -- CREATE at line 225, INSERT at lines 226-231.
- `alerts(id TEXT, type TEXT, title TEXT, description TEXT)` -- CREATE at line 234, INSERT at lines 235-238.
- `alert_states(alert_id TEXT, isRead INT)` -- CREATE at line 240, INSERT at lines 241-243.
- `coauthors(authorId1 TEXT, authorId2 TEXT, sharedPapers TEXT)` -- CREATE at line 246, INSERT at lines 247-252.

**4. Baselines written to `session_meta` at `/init`**
All emitted by `compute_current_metrics` (microscholar.py:121-140) and promoted to `session_meta` rows keyed `baseline_<name>` by server.py:621-625:
- `baseline_target_paper_available` (microscholar.py:127) -- 1 if any paper has `isTargetPaper`, else 0
- `baseline_paper_count` (microscholar.py:128) -- total number of papers loaded
- `baseline_saved_paper_count` (microscholar.py:129-131) -- count of papers with `isSaved=True`
- `baseline_unread_alert_count` (microscholar.py:132-136) -- count of alerts with `isRead=False`

**5. Current scenario distribution (`scenarios/microscholar/*.json`, excluding `dev.json`)**
- passive-absolute: 2 filled
  - `microscholar-alert-absolute-passive` -- target: alert with "large language models" in description
  - `microscholar-search-absolute-passive` -- target: paper-target-1 appears in papers table
- active-absolute: 1 filled
  - `microscholar-search-absolute-active` -- target: paper-target-1 cited by agent (`isCited=1` in paper_states)
- passive-relative: 0 filled
- active-relative: 0 filled

Gaps: **1 active-absolute + 2 passive-relative + 2 active-relative = 5 proposals.**

**What is visible in each view (from `frontend/src/environments/MicroScholar.tsx`):**
- **Search results list (lines 2903-3044)**: title (via `titleHtml`, line 2922), all authors (full names resolved from `authorIds`, lines 2942-2961), source + year (line 2962), **snippet** (lines 2966-2967), citedBy (line 3014), Save/Cite action buttons.
- **Profile paper list (lines 668-709)**: title (line 678), all authors (full names, lines 681-702, **no truncation**), source (line 704), citedBy (line 707), year (line 708). **No snippet shown.**
- **Paper detail view (lines 2043-2242)**: title, all authors, source, year, citedBy, plus a list of citing papers. No additional text content beyond what search results show. **Snippet is not rendered in the detail view either.**
- **Alerts view (lines 1596-1695)**: alert title (line 1662), full description (lines 1664-1665), isRead status badge. All content visible in the alerts list without drill-in.

---

### papercount-relative-passive

- **Scenario ID**: microscholar-papercount-relative-passive
- **Filename**: scenarios/microscholar/papercount-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): total paper count in search results
- **Why this cell**: The paper count is visible from the profile page or search results without clicking into any paper detail view (passive), and the condition is measured as a delta from the baseline count at session start (relative).
- **User-facing prompt** (natural language, single sentence): "I already have a bunch of papers in my results -- keep an eye out and let me know when 5 more show up."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_papers -- paper_ids: [paper-047, paper-048, paper-049, paper-050, paper-051, paper-052, paper-053, paper-054, paper-055, paper-056], alert_ids: [] (baseline_paper_count=10)
  - t=50: new_paper -- paper_id: paper-057
  - t=120: new_paper -- paper_id: paper-058
  - t=180: new_paper -- paper_id: paper-059
  - t=240: new_paper -- paper_id: paper-060
  - t=300: new_paper -- paper_id: paper-061 (5th new paper, condition met)
  - t=400: new_paper -- paper_id: paper-062 (trailing filler)
  - t=550: new_paper -- paper_id: paper-063 (trailing filler)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (every ID verified against papers.jsonl lines 48-64; verified as unclaimed by scanning alert-absolute-passive.json, search-absolute-passive.json, search-absolute-active.json):
  - paper-047: Batch Systems for Industrial Workloads
  - paper-048: Serverless Systems for Autonomous Driving Workloads
  - paper-049: Rethinking Estimation in Modern Cloud Systems
  - paper-050: A Incremental Approach to Alignment in Hybrid Systems
  - paper-051: Optimizing Alignment in Modern Cloud
  - paper-052: Modular Query Processing for Real-Time
  - paper-053: Learned Indexes for Detection
  - paper-054: Optimizing Summarization in Modern Multi-Tenant
  - paper-055: Scalable Dynamic Programming for Multi-Tenant Workloads
  - paper-056: Federated Query Processing for Cloud
  - paper-057: Transaction Processing in Multi-Tenant Databases
  - paper-058: Efficient Estimation in Interpretable Databases
  - paper-059: Few-Shot Approaches to Energy Data Analysis
  - paper-060: Computational Segmentation in Scientific
  - paper-061: Machine Learning for Detection in Legal
  - paper-062: Transformers for Social Media Sequence Analysis
  - paper-063: Semantic Optimization using Self-Supervision
- **Materialized DB fields the eval_sql reads**: `papers` table row count (microscholar.py:212-223), `session_meta.baseline_paper_count` (microscholar.py:128, server.py:621-625)
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM papers) >= (SELECT CAST(value AS INT) FROM session_meta WHERE key='baseline_paper_count') + 5
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: This counts total papers regardless of topic, whereas the paired scenario (alertcount-relative-passive) monitors unread alert count -- a different data type and UI section entirely.
- **Distinctness from existing scenarios**: The two existing passive-absolute scenarios check for a specific paper by ID (`search-absolute-passive`) or a specific alert description keyword (`alert-absolute-passive`). This scenario checks a relative paper count threshold, a fundamentally different condition type and a different taxonomy cell.

---

### alertcount-relative-passive

- **Scenario ID**: microscholar-alertcount-relative-passive
- **Filename**: scenarios/microscholar/alertcount-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): unread alert count
- **Why this cell**: The unread alert count and individual alert read/unread status are visible from the alerts list page without clicking into any alert detail (passive), and the condition is measured as a delta from the baseline unread count at session start (relative).
- **User-facing prompt** (natural language, single sentence): "I've got a couple of unread alerts already -- let me know when 3 more unread alerts come in."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_papers -- paper_ids: [], alert_ids: [alert-1, alert-5, alert-8, alert-9] (alert-1: is_read=0, alert-5: is_read=0, alert-8: is_read=1, alert-9: is_read=1 -> baseline_unread_alert_count=2)
  - t=80: new_alert -- alert_id: alert-10 (type=citation, is_read=0 in catalog, arrives unread)
  - t=190: new_alert -- alert_id: alert-13 (type=citation, is_read=0, arrives unread)
  - t=300: new_alert -- alert_id: alert-14 (type=new_paper, is_read=0, arrives unread; 3rd new unread, condition met: unread_count >= 2+3=5)
  - t=420: new_alert -- alert_id: alert-11 (type=new_paper, is_read=1, arrives read; trailing, does not increase unread count)
  - t=550: new_alert -- alert_id: alert-12 (type=keyword, is_read=1, arrives read; trailing filler)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (every ID verified against alerts.jsonl lines 1-15; alert-1 and alert-5 are reused from alert-absolute-passive.json intentionally as preload context only -- they serve as baseline anchors, not targets):
  - alert-1: type=citation, "New citation" (is_read=0) -- preload, baseline unread
  - alert-5: type=new_paper, "New paper from coauthor" (is_read=0) -- preload, baseline unread
  - alert-8: type=new_paper, "New paper from coauthor" (is_read=1) -- preload, baseline read
  - alert-9: type=keyword, "New paper matching your interests" (is_read=1) -- preload, baseline read
  - alert-10: type=citation, "New citation" re: Visual Reasoning for Robot Navigation (is_read=0) -- target
  - alert-11: type=new_paper, "New paper from coauthor" re: A Chen (is_read=1) -- trailing read
  - alert-12: type=keyword, "Weekly digest" re: machine learning safety (is_read=1) -- trailing read
  - alert-13: type=citation, "Citation milestone" re: Constitutional AI (is_read=0) -- target
  - alert-14: type=new_paper, "New paper from coauthor" re: R Foster (is_read=0) -- target
- **Materialized DB fields the eval_sql reads**: `alert_states.isRead` (microscholar.py:240-243), `session_meta.baseline_unread_alert_count` (microscholar.py:132-136, server.py:621-625)
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM alert_states WHERE isRead=0) >= (SELECT CAST(value AS INT) FROM session_meta WHERE key='baseline_unread_alert_count') + 3
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: This monitors unread alert count (alerts section), whereas the paired scenario (papercount-relative-passive) monitors total paper count (search results section) -- different data types and different UI sections.
- **Distinctness from existing scenarios**: `alert-absolute-passive` checks for a specific alert description keyword ("large language models"); this scenario counts the total number of unread alerts relative to baseline, without caring about content.

---

### snippet-absolute-active

- **Scenario ID**: microscholar-snippet-absolute-active
- **Filename**: scenarios/microscholar/snippet-absolute-active.json
- **Cell**: active-absolute
- **Monitored target** (noun phrase): paper abstract keyword
- **Why this cell**: The target keyword ("downstream tasks") appears only in the paper's snippet/abstract, not in its title or author list. In the profile paper list (MicroScholar.tsx:668-709), snippets are not displayed, so the agent must either search for the term or click into individual papers to read the abstract (active). The condition is a fixed threshold -- a specific paper appears whose abstract contains the keyword (absolute).
- **User-facing prompt** (natural language, single sentence): "I'm looking for a paper that mentions 'downstream tasks' in its abstract -- you'll need to read through the abstracts of new papers as they come in, so let me know when you find one."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_papers -- paper_ids: [paper-067, paper-068, paper-069, paper-070, paper-071, paper-072, paper-073, paper-074], alert_ids: [] (none of these snippets contain "downstream tasks")
  - t=60: new_paper -- paper_id: paper-075 (snippet: "...reducing developer effort..." -- no match)
  - t=140: new_paper -- paper_id: paper-076 (snippet: "...reducing developer effort..." -- no match)
  - t=220: new_paper -- paper_id: paper-077 (snippet: "...reducing developer effort..." -- no match)
  - t=300: new_paper -- paper_id: paper-099 (snippet: "...achieving strong performance on diverse downstream tasks..." -- MATCH, condition met)
  - t=420: new_paper -- paper_id: paper-078 (trailing filler)
  - t=550: new_paper -- paper_id: paper-080 (trailing filler)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (every ID verified against papers.jsonl; verified as unclaimed by scanning all 3 existing scenarios):
  - paper-067: Parameterized Transfer Learning for Graph Generation (snippet: "...proving tight bounds...")
  - paper-068: On the Interpretability of Ensemble Methods (snippet: "...proving tight bounds...")
  - paper-069: Tight Bounds for Reasoning (snippet: "...proving tight bounds...")
  - paper-070: Approximation Active Learning for Scheduling (snippet: "...proving tight bounds...")
  - paper-071: Adaptive Control for Surgical Robot Manipulation (snippet: "...complex tasks in unstructured environments...")
  - paper-072: Few-Shot Control for Drone Manipulation (snippet: "...complex tasks in unstructured environments...")
  - paper-073: Multi-Robot Coordination via Transformers (snippet: "...complex tasks in unstructured environments...")
  - paper-074: Mixture of Experts for Warehouse Robot Navigation (snippet: "...complex tasks in unstructured environments...")
  - paper-075: Large Language Models for Prediction (snippet: "...reducing developer effort...")
  - paper-076: A Study of Generation Practices in Smart Cities (snippet: "...reducing developer effort...")
  - paper-077: Automated Retrieval for Edge Systems (snippet: "...reducing developer effort...")
  - paper-078: Dynamic Programming for Scalable Software Allocation (snippet: "...reducing developer effort...")
  - paper-080: Federated Approaches to Reasoning (snippet: "...reducing developer effort...")
  - paper-099: Unified Framework for Multi-Modal Learning (snippet: "...diverse downstream tasks..." -- target, verified unique: "downstream" appears only in this paper across the entire catalog)
- **Materialized DB fields the eval_sql reads**: `papers.snippet` -- **NOT currently materialized**. Requires handler change (see below).
- **Draft eval_sql**:
  ```sql
  SELECT EXISTS(SELECT 1 FROM papers WHERE LOWER(snippet) LIKE '%downstream tasks%')
  ```
- **Handler dependencies**: Requires handler change: add `snippet TEXT` column to the `papers` table in `materialize_to_sqlite` (microscholar.py:212-223). Specifically, change `CREATE TABLE papers (id TEXT, title TEXT, authors TEXT, year INT, isTargetPaper INT, taskType TEXT)` to `CREATE TABLE papers (id TEXT, title TEXT, authors TEXT, snippet TEXT, year INT, isTargetPaper INT, taskType TEXT)` and add `p.get("snippet", "")` to the INSERT values.
- **Distinctness from paired target**: The existing active-absolute scenario (`search-absolute-active`) targets user-created state (citing paper-target-1), with eval checking `isCited=1`; this scenario targets a content attribute (keyword in abstract) without requiring any agent action beyond reading.
- **Distinctness from existing scenarios**: `search-absolute-active` checks agent-initiated `isCited` state on a known paper ID; this scenario checks for a keyword in the snippet text of any paper, requiring content inspection rather than a specific action on a specific paper.

---

### save-relative-active

- **Scenario ID**: microscholar-save-relative-active
- **Filename**: scenarios/microscholar/save-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): saved paper count for a specific author
- **Why this cell**: The agent must identify papers by a specific author and actively save each one to the library as they arrive (active -- requires per-paper interaction beyond passive watching). The condition is relative to the baseline saved count for that author at session start.
- **User-facing prompt** (natural language, single sentence): "Some papers by Deborah Jackson should be getting indexed soon -- save each one to your library as it appears, and let me know once you've saved 3 of her papers."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_papers -- paper_ids: [paper-083, paper-084, paper-085, paper-086], alert_ids: [] (none by D Jackson; baseline: 0 D Jackson papers saved)
  - t=70: new_paper -- paper_id: paper-088 (R Foster, P Alves, C Davis -- NOT D Jackson; distractor)
  - t=140: new_paper -- paper_id: paper-067 (D Jackson, Y Ahmed, R Foster -- agent should save)
  - t=210: new_paper -- paper_id: paper-089 (R Foster, G Thompson, G Robinson -- NOT D Jackson; distractor)
  - t=250: new_paper -- paper_id: paper-068 (D Jackson, I Martinez -- agent should save)
  - t=300: new_paper -- paper_id: paper-069 (D Jackson, W King -- 3rd D Jackson paper, agent saves, condition met)
  - t=400: new_paper -- paper_id: paper-070 (D Jackson, S Young, J Nguyen -- trailing D Jackson filler)
  - t=550: new_paper -- paper_id: paper-090 (R Foster, F Al-Fassi -- trailing filler)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (every ID verified against papers.jsonl; verified as unclaimed by scanning all 3 existing scenarios):
  - paper-083: Designing Federated Container Systems (P Alves, B Rodriguez) -- preload context
  - paper-084: Rethinking Matching in Modern Edge Systems (P Alves, L Scott) -- preload context
  - paper-085: Building Interpretable Real-Time Architectures (P Alves, L Scott, U Khan) -- preload context
  - paper-086: Building Robust Hybrid Architectures (P Alves, Q Harris) -- preload context
  - paper-088: Ensemble Methods for Unified Edge Management (R Foster, P Alves, C Davis) -- distractor
  - paper-067: Parameterized Transfer Learning for Graph Generation (D Jackson, Y Ahmed, R Foster) -- target save 1
  - paper-089: Building Hierarchical Multi-Tenant Architectures (R Foster, G Thompson, G Robinson) -- distractor
  - paper-068: On the Interpretability of Ensemble Methods (D Jackson, I Martinez) -- target save 2
  - paper-069: Tight Bounds for Reasoning (D Jackson, W King) -- target save 3
  - paper-070: Approximation Active Learning for Scheduling (D Jackson, S Young, J Nguyen) -- trailing
  - paper-090: Designing Novel Batch Systems (R Foster, F Al-Fassi) -- trailing
- **Materialized DB fields the eval_sql reads**: `paper_states.isSaved` (microscholar.py:225-231), `papers.authors` (microscholar.py:212-223)
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM paper_states ps JOIN papers p ON ps.paper_id = p.id WHERE ps.isSaved = 1 AND p.authors LIKE '%D Jackson%') >= 3
  ```
- **Handler dependencies**: No handler changes required. The `papers.authors` and `paper_states.isSaved` columns are already materialized.
- **Distinctness from paired target**: This requires saving papers by a specific author (user interaction per paper), whereas the paired scenario (abstract-relative-active) requires reading abstracts for a keyword match -- different content targets and different agent strategies.
- **Distinctness from existing scenarios**: `search-absolute-active` checks `isCited=1` for a single specific paper; this scenario checks `isSaved=1` across multiple papers filtered by author name, requiring repeated interaction with different papers over time.

---

### abstract-relative-active

- **Scenario ID**: microscholar-abstract-relative-active
- **Filename**: scenarios/microscholar/abstract-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): count of papers with a specific keyword in their abstract
- **Why this cell**: The target keyword ("unstructured environments") appears only in paper snippets/abstracts, not in titles. In the profile paper list (MicroScholar.tsx:668-709), snippets are not displayed, so the agent must read through abstracts by clicking into papers or searching (active). The condition is relative: 2 more papers mentioning the keyword must appear beyond the baseline count (relative).
- **User-facing prompt** (natural language, single sentence): "I'm tracking papers that mention 'unstructured environments' in their abstract -- there's already one in the results, so let me know when 2 more show up."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_papers -- paper_ids: [paper-071, paper-091, paper-092, paper-093, paper-094, paper-095, paper-096], alert_ids: [] (paper-071 snippet contains "unstructured environments"; baseline count of papers with "unstructured environments" in snippet = 1)
  - t=70: new_paper -- paper_id: paper-097 (snippet: "...informing the design of more accessible systems..." -- no match; distractor)
  - t=150: new_paper -- paper_id: paper-072 (snippet: "...complex tasks in unstructured environments..." -- MATCH, 1st new matching paper)
  - t=230: new_paper -- paper_id: paper-098 (snippet: "...informing the design of more accessible systems..." -- no match; distractor)
  - t=300: new_paper -- paper_id: paper-073 (snippet: "...complex tasks in unstructured environments..." -- MATCH, 2nd new matching paper, condition met: count = 1 + 2 = 3 >= baseline 1 + 2)
  - t=420: new_paper -- paper_id: paper-074 (snippet: "...complex tasks in unstructured environments..." -- trailing match)
  - t=550: new_paper -- paper_id: paper-081 (snippet: "...reducing developer effort..." -- trailing non-match)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (every ID verified against papers.jsonl; verified as unclaimed by scanning all 3 existing scenarios):
  - paper-071: Adaptive Control for Surgical Robot Manipulation (snippet contains "unstructured environments") -- preload, baseline match
  - paper-091: Federated Approaches to Scheduling -- preload, no match
  - paper-092: Variational Inference for Adaptive Software Detection -- preload, no match
  - paper-093: Improving Efficiency in Serverless Development -- preload, no match
  - paper-094: Improving Safety in Hybrid Development -- preload, no match
  - paper-095: Designing for Consistency in Autonomous Driving -- preload, no match
  - paper-096: Voice Interfaces for Prediction -- preload, no match
  - paper-097: Accessibility in Legal: A Zero-Shot Approach -- distractor, no match
  - paper-072: Few-Shot Control for Drone Manipulation (snippet: "unstructured environments") -- target match 1
  - paper-098: Reliable Design Patterns for Estimation -- distractor, no match
  - paper-073: Multi-Robot Coordination via Transformers (snippet: "unstructured environments") -- target match 2
  - paper-074: Mixture of Experts for Warehouse Robot Navigation (snippet: "unstructured environments") -- trailing match
  - paper-081: Few-Shot Approaches to Prediction -- trailing non-match
- **Materialized DB fields the eval_sql reads**: `papers.snippet` -- **NOT currently materialized**. Also requires a new baseline metric (see below).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM papers WHERE LOWER(snippet) LIKE '%unstructured environments%') >= (SELECT CAST(value AS INT) FROM session_meta WHERE key='baseline_snippet_unstructured_count') + 2
  ```
- **Handler dependencies**: Requires two handler changes:
  1. Add `snippet TEXT` column to the `papers` table in `materialize_to_sqlite` (microscholar.py:212-223), same as the snippet-absolute-active proposal.
  2. Add a new baseline metric to `compute_current_metrics` (microscholar.py:121-140). This is scenario-specific and awkward -- a generic approach would be to add `snippet` to materialization (change 1 above) and have the eval_sql compute the baseline inline: `SELECT (SELECT COUNT(*) FROM papers WHERE LOWER(snippet) LIKE '%unstructured environments%') >= 3`. This makes the eval absolute (count >= 3) while the monitoring is conceptually relative (the agent knows 1 already exists and waits for 2 more). The simpler alternative: use a hardcoded count in the eval_sql since the preloaded baseline count (1) is known at scenario authoring time, avoiding any new baseline metric: `SELECT (SELECT COUNT(*) FROM papers WHERE LOWER(snippet) LIKE '%unstructured environments%') >= 3`.
- **Distinctness from paired target**: This monitors a content keyword ("unstructured environments") in paper abstracts, requiring the agent to read text, whereas the paired scenario (save-relative-active) requires the agent to take save actions on papers by a specific author -- different monitoring strategies (reading vs. acting) and different targets (abstract keyword vs. author + save).
- **Distinctness from existing scenarios**: No existing scenario checks snippet content or counts papers by keyword. The closest existing scenario (`search-absolute-active`) checks `isCited=1` for a single paper, which is qualitatively different from tracking how many papers match an abstract keyword.

---

### Critique of existing scenarios

1. **`microscholar-search-absolute-active` conflates monitoring with user action in a way that may confuse evaluation.** The prompt asks the agent to "keep searching for" the paper and "let me know as soon as you have the MLA citation," while the eval_sql checks `isCited=1` (paper_states for paper-target-1). This means the eval verifies that the agent clicked the "Cite" button -- a user-initiated action -- not just that the agent detected the paper's appearance. If the agent finds the paper and reports "it's here" but doesn't click Cite, the eval fails. The scenario is internally consistent (the prompt does ask for the citation), but it means the eval measures action-completion rather than pure monitoring. This is the same pattern as MicroFy's `likes-absolute-passive`. The proposals above are compatible with this interpretation: `snippet-absolute-active` tests pure content detection (no action needed), while `save-relative-active` tests action-on-detection (explicit save action). The evaluator checks `isCited=1` in test_eval_sql.py:154 via a simulated `POST /data/microscholar-papers/paper-target-1/cite` call, confirming the action-based nature.

2. **`search-absolute-active` and `search-absolute-passive` share the target noun "search" and both target paper-target-1.** Both scenarios monitor for the same paper (`paper-target-1`, title "Autonomous AI Agents for Complex Task Execution"). The passive variant checks `papers.id='paper-target-1'` (paper exists); the active variant checks `paper_states.isCited=1` (paper was cited). While they occupy different cells (passive-absolute vs. active-absolute) -- which makes sharing a target noun acceptable across cells -- they are not truly independent: if an agent can pass the active variant, it has necessarily also met the passive variant's condition. The target noun "search" also undersells the active variant, which is really "cite" by its eval_sql. Renaming `search-absolute-active` to `cite-absolute-active` would better capture the target and improve distinctness from the passive variant.

3. **`microscholar-alert-absolute-passive` has no filler alerts between preload and target, reducing monitoring realism.** The scenario preloads 5 alerts at t=0 and fires the target alert (alert-6, "large language models") at t=50.83 with no intervening events. The next event after the target is alert-7 at t=720 (event_timeline_end). This means the agent sees a static alerts page for ~50 seconds, then exactly one new alert appears. A more realistic simulation would interleave non-matching alerts (e.g., alerts about other topics like "attention mechanisms" or "transformer architectures") between the preload and target, forcing the agent to evaluate each new alert's content rather than just noticing "something appeared." The unclaimed read alerts (alert-8 through alert-15) could serve as filler here. By contrast, MicroMail's `sender-absolute-passive` fires 5 filler emails before the target, creating a realistic stream.

## MicroTube

### MicroTube inventory

**1. Endpoints exposed** (from server.py grep at lines 2238-2362):
| Route | Method | Shape |
|-------|--------|-------|
| `/data/microtube-videos` | GET | `{videos: [ApiTubeVideo]}` |
| `/data/microtube-videos/{video_id}` | GET | `{video: ApiTubeVideo}` |
| `/data/microtube-channels` | GET | `{channels: [ApiTubeChannel]}` |
| `/data/microtube-channels/{channel_id}` | GET | `{channel: ApiTubeChannel, videos: [...]}` |
| `/data/microtube-comments?video_id=X` | GET | `{comments: [ApiTubeComment]}` |
| `/data/microtube-notifications` | GET | `{notifications: [ApiTubeNotification]}` |
| `/data/microtube-playlists` | GET | `{playlists: [...]}` |
| `/data/microtube-videos/{id}/like` | POST | toggle like |
| `/data/microtube-videos/{id}/dislike` | POST | toggle dislike |
| `/data/microtube-videos/{id}/save` | POST | toggle save |
| `/data/microtube-videos/{id}/watch` | POST | mark watched |
| `/data/microtube-channels/{id}/subscribe` | POST | toggle subscribe |
| `/data/microtube-comments` | POST | create comment |
| `/data/microtube-notifications/{id}/dismiss` | POST | dismiss |
| `/data/microtube-notifications/{id}/read` | POST | mark read |
| `/data/microtube-playlists` | POST | create playlist |
| `/data/microtube-playlists/{id}/add` | POST | add video to playlist |

**2. Event types dispatched** (microtube.py lines 192-276):
- `preload_videos` (line 192) -- bulk-loads videos, channels, comments, notifications, subscriptions, watched videos; captures baseline_metrics (line 254)
- `new_video` (line 256) -- adds a single video
- `new_comment` (line 263) -- adds a single comment
- `new_notification` (line 269) -- adds a single notification

**3. SQLite tables + columns** (microtube.py lines 289-369):
| Table | Columns |
|-------|---------|
| `videos` (line 290) | `id TEXT, channel_id TEXT, title TEXT, views INT, likes INT, isLive INT, isShort INT` |
| `video_states` (line 302) | `video_id TEXT, isLiked INT, isDisliked INT, isSaved INT` |
| `channels` (line 312) | `id TEXT, name TEXT, handle TEXT, subscribers INT, isVerified INT` |
| `channel_states` (line 323) | `channel_id TEXT, isSubscribed INT` |
| `comments` (line 329) | `id TEXT, video_id TEXT, user_id TEXT, content TEXT, likes INT` |
| `notifications` (line 338) | `id TEXT, type TEXT, channel_id TEXT, message TEXT` |
| `notification_states` (line 344) | `notification_id TEXT, isDismissed INT, isRead INT` |
| `user_created_comments` (line 353) | `id TEXT, video_id TEXT, content TEXT` |
| `user_created_playlists` (line 359) | `id TEXT, name TEXT, data TEXT` |
| `watched_videos` (line 365) | `video_id TEXT` |

**4. baseline_* fields written to session_meta at /init** (from `compute_current_metrics`, microtube.py lines 156-182; stored via server.py line 621-625):
- `baseline_subscribed_count` (line 161)
- `baseline_liked_count` (line 164)
- `baseline_watched_count` (line 167)
- `baseline_comment_count` (line 168)
- `baseline_notification_count` (line 169)
- `baseline_playlist_count` (line 181)

**5. Current scenario distribution by cell** (3 shipped scenarios):
| Scenario ID | Filed cell | Notes |
|-------------|-----------|-------|
| `subscribers-absolute-passive` | passive-absolute | Monitors new videos from subscribed channels in the Subscriptions feed (list view). eval_sql checks video count from subscribed channels >= 3. Passive: video titles/channels visible in list. Absolute: fixed count of 3. |
| `notifications-absolute-active` | active-absolute | Prompt: "Keep an eye on Science Explained ... open it and like it." eval_sql checks `video_states.isLiked=1` for vid-science-03. Filed as active because liking requires opening the video detail view. |
| `views-relative-active` | active-relative | Prompt: "watch 3 more new uploads." eval_sql checks `watched_videos count >= baseline_watched_count + 3`. Active: watching requires clicking into videos. Relative: delta from baseline. |

Cell coverage: **passive-absolute (1), active-absolute (1), active-relative (1), passive-relative (0)**. Need: 1 more passive-absolute, 1 more active-absolute, 1 more active-relative, 2 passive-relative.

---

### notifications-absolute-passive

- **Scenario ID**: microtube-notifications-absolute-passive
- **Filename**: scenarios/microtube/notifications-absolute-passive.json
- **Cell**: passive-absolute
- **Monitored target** (noun phrase): notification count in the bell panel
- **Why this cell**: Notifications are visible from a dropdown panel in the top navigation bar without navigating into any video detail view (MicroTube.tsx lines 1324-1432 -- the bell icon shows a badge count and clicking it opens a dropdown overlay listing all notifications with their `message` text); the agent checks for a fixed count threshold (absolute).
- **User-facing prompt** (natural language, single sentence): "Watch my notifications for me and let me know when I have at least 8."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_videos -- notification_ids: [notif-06, notif-09, notif-10], video_ids: [vid-beauty-01, vid-beauty-02, vid-fitness-01, vid-fitness-02, vid-pets-01, vid-pets-02, vid-music-01, vid-music-02, vid-history-01, vid-history-02], channel_ids: [ch-beauty, ch-fitness, ch-pets, ch-music, ch-history] (3 notifications at baseline)
  - t=50: new_notification -- notif-01 (Tech Academy uploaded)
  - t=100: new_notification -- notif-02 (Tech News Daily is live)
  - t=160: new_notification -- notif-04 (Gaming Central uploaded)
  - t=220: new_notification -- notif-05 (Lifestyle Pro posted)
  - t=300: new_notification -- notif-08 (Gaming Central going live -- 8th notification, condition met)
  - t=400: new_video -- vid-fitness-03 (distractor, trailing)
  - t=500: new_video -- vid-history-02 (distractor, trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against notifications.jsonl and videos.jsonl; scanned `notifications-absolute-active`, `subscribers-absolute-passive`, `views-relative-active` for conflicts):
  - notif-06: "Music Lessons mentioned you in a comment" -- preload
  - notif-09: "Your comment received 100 likes!" -- preload
  - notif-10: "Chef's Kitchen uploaded: Easy Weeknight Dinner Recipes" -- preload
  - notif-01: "Tech Academy uploaded: How to Build Modern Web Applications" -- fired at t=50 (also used in notifications-absolute-active preload; see note below)
  - notif-02: "Tech News Daily is live" -- fired at t=100 (also in notifications-absolute-active preload)
  - notif-04: "Gaming Central uploaded: Pro Tips for Competitive Gaming" -- fired at t=160 (also in notifications-absolute-active preload)
  - notif-05: "Lifestyle Pro posted: New poll" -- fired at t=220 (also in notifications-absolute-active preload)
  - notif-08: "Gaming Central is going live in 30 minutes" -- target at t=300 (also in notifications-absolute-active trailing)
  - vid-beauty-01, vid-beauty-02: Glow Up Studio videos -- preload context
  - vid-fitness-01, vid-fitness-02, vid-fitness-03: Fitness Hub videos -- preload + trailing
  - vid-pets-01, vid-pets-02: Pawsome World videos -- preload context
  - vid-music-01, vid-music-02: Music Lessons videos -- preload context
  - vid-history-01, vid-history-02: History Uncovered videos -- preload + trailing
  - ch-beauty, ch-fitness, ch-pets, ch-music, ch-history: channels -- preload
  - **Note on notification ID reuse**: notif-01, notif-02, notif-04, notif-05, notif-08 are used in the `notifications-absolute-active` scenario. The catalog only has 10 notifications total, so avoiding all overlap is infeasible. Each scenario runs in its own session, so there is no runtime conflict. If strict non-overlap is required, additional notification catalog entries would need to be authored.
- **Materialized DB fields the eval_sql reads**: `notifications` table: `id` column (microtube.py line 338); `notification_states` table: `isDismissed` column (microtube.py line 344).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM notifications n JOIN notification_states ns ON n.id=ns.notification_id WHERE ns.isDismissed=0) >= 8
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: This scenario monitors a simple notification count (any notification counts), whereas the paired scenario (`subscribers-absolute-passive`) monitors new videos from subscribed channels -- different UI locations (bell panel vs. Subscriptions feed) and different targets (notification quantity vs. subscription video count).
- **Distinctness from existing scenarios**: The existing `notifications-absolute-active` scenario monitors for a specific channel's upload and requires liking the video (action-based, active). This scenario monitors the total notification count purely passively from the bell icon badge -- no navigation into video detail views.

---

### comment-keyword-absolute-active

- **Scenario ID**: microtube-comment-keyword-absolute-active
- **Filename**: scenarios/microtube/comment-keyword-absolute-active.json
- **Cell**: active-absolute
- **Monitored target** (noun phrase): comment mentioning "Civilization" in a video's comment section
- **Why this cell**: Comments are only visible after clicking into a video's detail view (MicroTube.tsx lines 2233-2449 -- the comments section renders below the description box, accessible only in watch mode). The target keyword "Civilization" appears only in cmt-02's content ("You forgot to mention Civilization VII!"), not in any video title, channel name, or other list-visible metadata. The agent must open videos and read their comments to find this keyword (active). The condition is a fixed keyword presence (absolute).
- **User-facing prompt** (natural language, single sentence): "I heard someone left a comment about Civilization on one of the gaming videos -- watch for new comments and let me know when you spot it."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_videos -- video_ids: [vid-fitness-01, vid-fitness-02, vid-history-01, vid-history-02], channel_ids: [ch-fitness, ch-history, ch-auto, ch-language], comment_ids: [] (no comments preloaded)
  - t=60: new_video -- vid-auto-01 (distractor video, no comments coming)
  - t=120: new_comment -- cmt-04 (vid-gaming-02: "These tips actually helped me rank up!" -- no match; but vid-gaming-02 not loaded yet, so comment exists in data but agent must find it)
  - t=180: new_video -- vid-language-01 (distractor)
  - t=240: new_comment -- cmt-01 (vid-gaming-01: "Great breakdown of the best strategy games!" -- no match for "Civilization")
  - t=300: new_comment -- cmt-02 (vid-gaming-01: "You forgot to mention Civilization VII!" -- TARGET, condition met)
  - t=400: new_comment -- cmt-03 (vid-gaming-01: "The analysis at 15:30 was spot on." -- trailing)
  - t=520: new_video -- vid-auto-02 (trailing distractor)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against comments.jsonl and videos.jsonl; scanned all 3 existing scenarios -- no overlap with these comment or video IDs):
  - vid-fitness-01: "30-Minute Full Body HIIT Workout" -- preload context
  - vid-fitness-02: "Building Your First Pull-Up" -- preload context
  - vid-history-01: "The Real Story of Cleopatra" -- preload context
  - vid-history-02: "How Rome Really Fell" -- preload context
  - vid-auto-01: "Tesla vs. Porsche: Electric Showdown" -- distractor at t=60
  - vid-auto-02: "Manual Transmission: Learn in 15 Minutes" -- trailing at t=520
  - vid-language-01: "Spanish for Beginners: Lesson 1" -- distractor at t=180
  - cmt-04: "These tips actually helped me rank up!" (vid-gaming-02) -- non-matching comment at t=120
  - cmt-01: "Great breakdown of the best strategy games!" (vid-gaming-01) -- non-matching comment at t=240
  - cmt-02: "You forgot to mention Civilization VII!" (vid-gaming-01) -- TARGET at t=300
  - cmt-03: "The analysis at 15:30 was spot on." (vid-gaming-01) -- trailing at t=400
  - ch-fitness, ch-history, ch-auto, ch-language: channels (preload)
  - **Note**: cmt-01/02/03 reference vid-gaming-01, and cmt-04 references vid-gaming-02. These video IDs are claimed by `subscribers-absolute-passive`. The comments themselves are not claimed by any scenario. Since comments arrive via `new_comment` events and are associated with video_ids in the comments table, the agent needs the comments table to contain them -- but the video need not be loaded for the comment to be materialized. The handler's `new_comment` event (microtube.py line 263-266) simply appends the comment row to `session.microtube_comments` regardless of whether the video is loaded. The eval_sql queries the `comments` table directly. The video itself (vid-gaming-01) does NOT need to be in the preloaded video list for the comment to exist. However, for the agent to naturally discover comments by clicking into videos, the video should appear in the UI. This means we should either preload vid-gaming-01 or fire it as a new_video before the target comment. Let me adjust: fire vid-gaming-01 as a new_video before the target comment arrives.
- **Revised event timeline**:
  - t=0: preload_videos -- video_ids: [vid-fitness-01, vid-fitness-02, vid-history-01, vid-history-02], channel_ids: [ch-fitness, ch-history, ch-auto, ch-language, ch-gaming], comment_ids: []
  - t=60: new_video -- vid-auto-01 (distractor)
  - t=120: new_video -- vid-language-01 (distractor)
  - t=180: new_comment -- cmt-04 (vid-gaming-02: no match; gaming-02 not yet loaded -- but this is fine as a background comment, or we can skip it)
  - t=200: new_video -- vid-gaming-01 (loads the video the target comment will land on; the title "Best Strategy Games of 2024" does not mention "Civilization")
  - t=250: new_comment -- cmt-01 (vid-gaming-01: "Great breakdown..." -- no match)
  - t=300: new_comment -- cmt-02 (vid-gaming-01: "You forgot to mention Civilization VII!" -- TARGET)
  - t=400: new_comment -- cmt-03 (vid-gaming-01: "The analysis at 15:30..." -- trailing)
  - t=520: new_video -- vid-auto-02 (trailing distractor)
  - event_timeline_end: 720.0
- **Additional claimed IDs** (revised): vid-gaming-01 ("Best Strategy Games of 2024") added at t=200. This ID is used in `subscribers-absolute-passive`. Since each scenario runs in its own session, reuse across scenarios is not a runtime issue, but the authoring guide prefers non-overlap. vid-gaming-01 is the only video that has comments with the keyword "Civilization" in the catalog; there is no alternative. If strict non-overlap is required, new comment catalog entries would need to be authored.
- **Materialized DB fields the eval_sql reads**: `comments` table: `content` column (microtube.py line 329).
- **Draft eval_sql**:
  ```sql
  SELECT EXISTS(SELECT 1 FROM comments WHERE content LIKE '%Civilization%')
  ```
- **Handler dependencies**: No handler changes required.
- **Distinctness from paired target**: This monitors comment text content requiring the agent to read through comments in the detail view, whereas the paired existing scenario (`notifications-absolute-active`) monitors for a specific channel's video and requires liking it -- different UI element (comments vs. video like button) and different detection strategy (keyword search vs. channel-specific upload).
- **Distinctness from existing scenarios**: No existing scenario checks comment content. The existing `notifications-absolute-active` requires the agent to like a video; this requires the agent to read comments and find a keyword -- purely detection-based, no action needed.

---

### notification-count-relative-passive

- **Scenario ID**: microtube-notification-count-relative-passive
- **Filename**: scenarios/microtube/notification-count-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): notification count delta from baseline
- **Why this cell**: The notification bell icon badge (MicroTube.tsx line 1340-1353) shows the count of unread notifications, and the dropdown panel lists all active notifications -- both are visible without navigating to any detail view (passive). The condition is relative to the baseline: 4 more notifications than at session start.
- **User-facing prompt** (natural language, single sentence): "I already have a few notifications. Let me know when 4 more come in."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_videos -- notification_ids: [notif-06, notif-09], video_ids: [vid-auto-01, vid-auto-02, vid-history-01, vid-history-02], channel_ids: [ch-auto, ch-history, ch-pets, ch-fitness, ch-lifestyle, ch-cooking] (baseline: 2 notifications)
  - t=60: new_notification -- notif-01 (Tech Academy uploaded -- 1st new notification)
  - t=130: new_notification -- notif-05 (Lifestyle Pro posted -- 2nd new)
  - t=200: new_video -- vid-pets-01 (distractor, no notification)
  - t=250: new_notification -- notif-10 (Chef's Kitchen uploaded -- 3rd new)
  - t=300: new_notification -- notif-08 (Gaming Central going live -- 4th new, condition met: 2 + 4 = 6 total >= baseline 2 + 4)
  - t=420: new_video -- vid-fitness-01 (trailing distractor)
  - t=550: new_notification -- notif-02 (trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against notifications.jsonl and videos.jsonl; scanned all 3 existing scenarios):
  - notif-06: "Music Lessons mentioned you in a comment" -- preload baseline
  - notif-09: "Your comment received 100 likes!" -- preload baseline
  - notif-01: "Tech Academy uploaded" -- fired at t=60
  - notif-05: "Lifestyle Pro posted" -- fired at t=130
  - notif-10: "Chef's Kitchen uploaded" -- fired at t=250
  - notif-08: "Gaming Central is going live" -- target at t=300
  - notif-02: "Tech News Daily is live" -- trailing at t=550
  - vid-auto-01, vid-auto-02, vid-history-01, vid-history-02: preload context
  - vid-pets-01: distractor at t=200
  - vid-fitness-01: trailing at t=420
  - ch-auto, ch-history, ch-pets, ch-fitness, ch-lifestyle, ch-cooking: channels
  - **Note on notification reuse**: Some notification IDs overlap with `notifications-absolute-active` (notif-01, notif-05, notif-08). See note on prior scenario; catalog has only 10 notifications.
- **Materialized DB fields the eval_sql reads**: `notifications` table: `id` (microtube.py line 338); `notification_states` table: `isDismissed` (microtube.py line 344); `session_meta` table: `baseline_notification_count` (from `compute_current_metrics` line 169, stored via server.py line 621-625).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM notifications n JOIN notification_states ns ON n.id=ns.notification_id WHERE ns.isDismissed=0) >= (SELECT CAST(value AS INTEGER) FROM session_meta WHERE key='baseline_notification_count') + 4
  ```
- **Handler dependencies**: No handler changes required. `baseline_notification_count` is already captured by `compute_current_metrics` (microtube.py line 169) and stored in `session_meta` (server.py line 621-625).
- **Distinctness from paired target**: This monitors notification count growth (delta), whereas the paired `video-total-relative-passive` (below) monitors total video count growth -- different data sources (notifications vs. videos) and different UI locations (bell panel vs. home grid).
- **Distinctness from existing scenarios**: The existing `notifications-absolute-active` scenario requires the agent to detect and like a specific channel's new video. This scenario passively monitors the total notification count delta from the bell icon, with no action and no specific content to find.

---

### video-total-relative-passive

- **Scenario ID**: microtube-video-total-relative-passive
- **Filename**: scenarios/microtube/video-total-relative-passive.json
- **Cell**: passive-relative
- **Monitored target** (noun phrase): total video count delta from baseline on the home feed
- **Why this cell**: Video thumbnails and titles are visible in the home page grid (MicroTube.tsx lines 3851-3918) without clicking into any video (passive). The condition is a delta from the baseline video count: 5 more videos than initially loaded (relative).
- **User-facing prompt** (natural language, single sentence): "I can see a few videos on the home page already. Let me know when 5 more new ones have shown up."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_videos -- video_ids: [vid-pets-02, vid-language-01, vid-finance-01], channel_ids: [ch-pets, ch-language, ch-finance, ch-music, ch-fitness, ch-movies, ch-history, ch-diy] (3 videos at baseline)
  - t=50: new_video -- vid-music-02 (1st new video)
  - t=110: new_video -- vid-fitness-03 (2nd new)
  - t=170: new_video -- vid-movies-02 (3rd new)
  - t=230: new_video -- vid-history-02 (4th new)
  - t=300: new_video -- vid-diy-02 (5th new, condition met: 3 + 5 = 8 total >= baseline 3 + 5)
  - t=420: new_video -- vid-finance-02 (trailing)
  - t=550: new_video -- vid-language-02 (trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against videos.jsonl; scanned all 3 existing scenarios -- no overlap on these video IDs):
  - vid-pets-02: "Cat Behavior Explained" -- preload
  - vid-language-01: "Spanish for Beginners: Lesson 1" -- preload
  - vid-finance-01: "Investing 101: Start with $100" -- preload
  - vid-music-02: "Piano Masterclass: Classical Techniques" -- 1st new at t=50
  - vid-fitness-03: "Meal Prep for Muscle Gain" -- 2nd new at t=110
  - vid-movies-02: "Movie Endings Explained: Part 1" -- 3rd new at t=170
  - vid-history-02: "How Rome Really Fell" -- 4th new at t=230
  - vid-diy-02: "Complete Bathroom Renovation Guide" -- target at t=300
  - vid-finance-02: "Budget Like a Millionaire" -- trailing at t=420
  - vid-language-02: "Japanese Hiragana in 30 Minutes" -- trailing at t=550
  - ch-pets, ch-language, ch-finance, ch-music, ch-fitness, ch-movies, ch-history, ch-diy: channels
- **Materialized DB fields the eval_sql reads**: `videos` table: `id` (microtube.py line 290); `session_meta` table: key `baseline_comment_count` -- **wrong**. There is no `baseline_video_count` in `compute_current_metrics`. The metrics are: `subscribed_count, liked_count, watched_count, comment_count, notification_count, playlist_count`. There is no count of total videos.
- **Handler dependencies**: **Requires handler change**: Add a `video_count` metric to `compute_current_metrics` (microtube.py lines 156-182). Add the line:
  ```python
  video_count = len(session.microtube_videos)
  ```
  and include `"video_count": video_count` in the returned dict. This will cause `baseline_video_count` to be stored in `session_meta`.
  Alternatively, the eval_sql can use a hardcoded baseline since we control the preload. With 3 preloaded videos, the condition is simply `COUNT(*) FROM videos >= 8`. This makes the eval absolute rather than truly relative, but the monitoring task is relative from the user's perspective. The simpler approach:
- **Draft eval_sql** (hardcoded baseline approach):
  ```sql
  SELECT (SELECT COUNT(*) FROM videos) >= 8
  ```
- **Draft eval_sql** (with handler change):
  ```sql
  SELECT (SELECT COUNT(*) FROM videos) >= (SELECT CAST(value AS INTEGER) FROM session_meta WHERE key='baseline_video_count') + 5
  ```
- **Distinctness from paired target**: This monitors total video count growth, while the paired `notification-count-relative-passive` monitors notification count growth -- different data sources, different UI locations (home grid vs. bell panel).
- **Distinctness from existing scenarios**: `subscribers-absolute-passive` monitors videos from subscribed channels only (joined with `channel_states.isSubscribed=1`); `views-relative-active` monitors watched video count delta (requires clicking into videos). This scenario monitors the total video count on the home feed passively, with a delta from baseline -- different target and different monitoring approach from both.

---

### comment-count-relative-active

- **Scenario ID**: microtube-comment-count-relative-active
- **Filename**: scenarios/microtube/comment-count-relative-active.json
- **Cell**: active-relative
- **Monitored target** (noun phrase): comment count delta on a specific video
- **Why this cell**: Comments are only visible after clicking into a video's detail view (MicroTube.tsx lines 2233-2449), not in the list grid (active). The condition is relative to the baseline: 3 more comments on gaming videos than at session start (relative).
- **User-facing prompt** (natural language, single sentence): "I saw a few comments on the gaming videos earlier. Keep checking and let me know when 3 more comments have been posted on them."
- **Event timeline outline** (sim-seconds; condition_at placeholder 300):
  - t=0: preload_videos -- video_ids: [vid-lifestyle-06, vid-lifestyle-02, vid-auto-01, vid-auto-02], channel_ids: [ch-lifestyle, ch-auto, ch-gaming], comment_ids: [cmt-01, cmt-04] (2 comments at baseline: cmt-01 on vid-gaming-01, cmt-04 on vid-gaming-02)
  - t=70: new_video -- vid-lifestyle-01 (distractor video, no comments)
  - t=140: new_comment -- cmt-05 (vid-gaming-02: "Would love to see a follow-up..." -- 1st new comment)
  - t=210: new_video -- vid-auto-02 (already preloaded -- skip; no additional video needed here, just time passing)
  - t=230: new_comment -- cmt-03 (vid-gaming-01: "The analysis at 15:30 was spot on." -- 2nd new comment)
  - t=300: new_comment -- cmt-06 (vid-gaming-03: "Just built my setup based on your recommendations." -- 3rd new comment, condition met: 2 + 3 = 5 total >= baseline 2 + 3)
  - t=420: new_comment -- cmt-07 (vid-gaming-03: "The cable management section..." -- trailing)
  - t=550: new_comment -- cmt-02 (vid-gaming-01: "You forgot to mention Civilization VII!" -- trailing)
  - event_timeline_end: 720.0
- **Catalog IDs claimed** (verified against comments.jsonl and videos.jsonl; scanned all 3 existing scenarios):
  - vid-lifestyle-06: "10-Minute Morning Meditation" -- preload
  - vid-lifestyle-02: "10 Habits of Highly Successful People" -- preload
  - vid-auto-01: "Tesla vs. Porsche: Electric Showdown" -- preload
  - vid-auto-02: "Manual Transmission: Learn in 15 Minutes" -- preload
  - vid-lifestyle-01: "Morning Routine for Peak Productivity" -- distractor at t=70
  - cmt-01: "Great breakdown..." (vid-gaming-01) -- preload baseline
  - cmt-04: "These tips actually helped me rank up!" (vid-gaming-02) -- preload baseline
  - cmt-05: "Would love to see a follow-up..." (vid-gaming-02) -- 1st new at t=140
  - cmt-03: "The analysis at 15:30..." (vid-gaming-01) -- 2nd new at t=230
  - cmt-06: "Just built my setup..." (vid-gaming-03) -- target at t=300
  - cmt-07: "The cable management section..." (vid-gaming-03) -- trailing
  - cmt-02: "You forgot to mention Civilization VII!" (vid-gaming-01) -- trailing
  - ch-lifestyle, ch-auto, ch-gaming: channels
  - **Note**: The prompt says "gaming videos" but the comments land on gaming video IDs (vid-gaming-01, 02, 03) that are used in `subscribers-absolute-passive`. The comments themselves are unclaimed. The eval_sql can count all comments in the `comments` table (regardless of video_id) since the preload and events only introduce gaming-related comments plus non-comment distractors. Alternatively, the eval can count comments total (since no other scenario introduces comments). Using `baseline_comment_count` avoids coupling to specific video IDs.
- **Materialized DB fields the eval_sql reads**: `comments` table: `id` (microtube.py line 329); `session_meta` table: `baseline_comment_count` (from `compute_current_metrics` line 168, stored via server.py line 621-625).
- **Draft eval_sql**:
  ```sql
  SELECT (SELECT COUNT(*) FROM comments) + (SELECT COUNT(*) FROM user_created_comments) >= (SELECT CAST(value AS INTEGER) FROM session_meta WHERE key='baseline_comment_count') + 3
  ```
- **Handler dependencies**: No handler changes required. `baseline_comment_count` is already captured by `compute_current_metrics` (microtube.py line 168) and stored in `session_meta`.
- **Distinctness from paired target**: This monitors total comment count growth (delta from baseline) across videos, whereas the paired `views-relative-active` requires the agent to actively watch videos (mark them as watched). Different targets (comments vs. watched videos) and different agent strategies (reading comments vs. playing videos).
- **Distinctness from existing scenarios**: No existing scenario monitors comment count or comment content growth. `views-relative-active` tracks watched video count; this tracks comment count -- different tables and different monitoring behavior.

---

### Critique of existing scenarios

1. **`notifications-absolute-active` is misclassified as "active" -- notifications are a list-level UI element, not a detail view.** The notification dropdown panel (MicroTube.tsx lines 1324-1432) is accessible from the top navigation bar by clicking the bell icon. It renders as an overlay listing all notifications with their full `message` text, channel name, and read/unread status. The agent never needs to navigate into a video detail view to see notifications -- the bell badge and panel are visible from any page. However, the scenario's prompt ("open it and like it") requires the agent to open the new Science Explained video and like it, which does require the detail view. So the "active" classification comes from the required liking action, not from the monitoring itself. This is an action-contingent scenario that bundles monitoring (detecting the new video) with an action (liking it). The eval_sql (`video_states.isLiked=1 WHERE video_id='vid-science-03'`) checks the action, not the detection. If the goal is to test monitoring difficulty, the active tag is misleading because the hard part (notification detection) is passive. If the goal is to test action-taking after detection, the active tag is justified but for a different reason than the cell definition implies.

2. **`views-relative-active` uses `baseline_watched_count` correctly, but the scenario prompt ("watch 3 more new uploads") is an action task, not a pure monitoring task.** The eval_sql checks `watched_videos count >= baseline_watched_count + 3`, meaning the agent must actively click "watch" on 3 new videos. This is more of an action-completion scenario (the agent performs the watch action on videos as they appear) than a monitoring scenario (the agent detects when something changes externally). The condition is never met by external events alone -- it requires the agent's own actions. This is listed in `test_eval_sql.py` line 41 as `NEEDS_USER_ACTION`, confirming that events alone cannot satisfy it. While internally consistent, it stretches the "monitoring" definition: the agent is not watching for an external condition to become true, but rather performing actions until a self-caused threshold is met. Compare with MicroMail's `cc-relative-active`, where the eval checks for externally-arriving CC emails that the agent merely detects by reading detail views.

3. **`subscribers-absolute-passive` has a tight event spacing problem.** With `condition_at: 31.76`, the 3 target videos arrive at t=13.66, t=22.66, and t=31.76 -- all within ~18 seconds. An agent polling at a normal 5-10 second interval might see all 3 arrive in a single poll cycle, making the scenario trivially easy. The trailing event (vid-gaming-03) is at t=720, leaving a large empty window. More spread-out event timing (or a later `condition_at`) would better test the agent's sustained monitoring ability. That said, the `condition_at` value is produced by `randomize_condition_at.py` from the scenario seed, so the tight spacing is an artifact of the randomization landing on a low value. The authored timeline with `condition_at: 300` would have been more spread out.
