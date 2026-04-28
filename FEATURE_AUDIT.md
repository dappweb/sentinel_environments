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
