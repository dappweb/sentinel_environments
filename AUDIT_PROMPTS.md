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
