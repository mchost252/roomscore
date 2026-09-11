# Trophy Catalog Deduplication Plan

## Context
The trophy catalog (`backend/catalog/trophies.js`, 89 trophies / 47 live / 42 stubs) contains many semantically identical achievements. A single action (e.g., completing task #25) can fire 3–5 unlocks simultaneously because Beginning's task-count ladder is a clone of Task Master's, and several stub pairs describe the same future criterion.

## Decisions (confirmed with user)
1. **Beginning = firsts only** — remove its task-count ladder; Task Master owns volume.
2. **Remove duplicate threshold-1/threshold-3 trophies from Task Master / Consistency** — Beginning owns the "firsts".
3. **Remove `First Session` (Beginning stub)** — `Locked In` (Focused) owns first Focus session.
4. **Remove `In Sync` (Communication stub)** — fix `Clear Signal` wording to match its real criterion.
5. **Legendary trimmed to 3** — keep Rising Star (breadth 3), Multi-Talented (breadth 5), Complete Journey; remove the 4 vague/unreachable ultimates and the 2 unreachable breadth trophies.
6. **Community stubs re-scoped** to distinct future criteria (kept as stubs).
7. **Profile screen legacy trophy list purged** — server catalog becomes the only source.

## Resulting catalog: 76 trophies (39 live, 37 stubs)

### Removals (13 trophies)
| Category | Removed IDs |
|---|---|
| beginning | `getting-started`, `finding-your-way`, `on-your-way`, `krios-initiate`, `first-session` |
| task_master | `task-starter` |
| consistency | `showing-up` |
| communication | `in-sync` |
| legendary | `krios-elite`, `krios-master`, `peak-performance`, `unstoppable-legend`, `krios-legend` |

### Final shape per category
- **Beginning (3, all live):** first-step, first-win, first-rhythm
- **Consistency (13 live):** active-days ladder steady→constant (7→365, minus 3-day); streak ladder first-streak→legendary-streak (3→100)
- **Task Master (7 live + 4 stub):** volume ladder task-runner→task-legend (10→1000, minus 1); priority stubs unchanged
- **Focused (12 stub):** unchanged; `locked-in` is the entry trophy
- **Community (8 live + 3 stub):** live unchanged; stubs re-scoped (below)
- **Communication (5 live + 2 stub):** in-sync removed; DM wording standardized
- **Growth (8 stub) / Learning (8 stub):** unchanged
- **Legendary (3 live):** rising-star, multi-talented, complete-journey

### Description fixes (align text with real criterion)
- `first-win`: "Complete your first personal task" (was "meaningful task")
- `first-connection`: "Send or receive your first direct message"
- `open-channel`: "Send or receive 5 direct messages"
- `good-communicator`: "Send or receive 25 direct messages"
- `always-in-sync`: "Send or receive 100 direct messages"
- `clear-signal`: "Send 25 room chat messages" (criterion is `chat_messages`, not tasks)
- `core-member` (stub): "Complete a task in the same room on 30 different days"
- `community-pillar` (stub): "Complete 100 room tasks and 100 room chat messages"
- `shared-momentum` (stub): "Be in a room that completes 50 tasks together"

## Implementation steps (ordered)

### 1. `backend/catalog/trophies.js`
- Delete the 13 trophy entries listed above.
- Apply the description fixes listed above.
- No changes to CATEGORIES, RARITY, helpers, or criterion types.

### 2. New guard test `backend/__tests__/catalog.test.js`
- Assert total count is 76 (39 live / 37 stub).
- Assert **no two live trophies share an identical criterion** (type + scope + threshold).
- Assert all trophy categories exist in CATEGORIES and ids are unique.
- Run via existing Jest setup (`npm test` in `/backend`).

### 3. New cleanup script `backend/scripts/cleanup-removed-trophies.js`
- Deletes `UserTrophy` rows whose `trophyId` no longer exists in the catalog (the 13 removed IDs will otherwise remain as inert orphans).
- Support `--user <id>` and `--all` modes like `backfill-trophies.js`; print deleted counts; require `--confirm` to actually write.
- Register npm script alongside the existing backfill scripts in `backend/package.json`.
- Note: orphan rows are already invisible to `getTrophiesForUser` and `category_breadth` (they map over catalog ids), so this is hygiene, not a correctness fix.

### 4. `mobile/app/(home)/trophies.tsx`
- Remove dead `ICON_FOR_TROPHY` entries for all 13 removed ids (first-session, getting-started, finding-your-way, on-your-way, krios-initiate, task-starter, showing-up, in-sync, krios-elite, krios-master, peak-performance, unstoppable-legend, krios-legend).
- No other logic changes — screens are catalog-driven.

### 5. `mobile/app/(home)/profile.tsx` legacy purge
- Delete local `Trophy` interface, `TrophyGroupKey`, and reduce `ExpandKey` to `'bio' | 'account' | 'insights'`.
- Delete the hardcoded 7-trophy `trophies` useMemo, `unlockedTrophies`, `trophyGroups`, and the `TrophyCard` component (verify each is truly unused in render before deleting).
- `expanded` state record: drop `consistency`/`social`/`mastery` keys.
- Count line: `{serverUnlockedCount}/{Math.max(serverTrophyTotal, trophies.length)}` → `{serverUnlockedCount}/{serverTrophyTotal}`.
- Earned row: server data only (keep `.slice(0, 4)`); remove the local-list fallback branch.
- Empty state condition: `serverUnlockedCount === 0` (drop earnedTrophies.length check).
- Keep `rarityMap` (still used by the earned row). Remove now-unused styles after verifying: `trophyCard`, `trophyGrid`, `trophyIcon`, `trophyTitle`, `trophyDesc`, `trophyFooter`, `rarityText`, `progressText`, `groupNote`, `summaryMedal`.

### 6. Verification
- Backend: `npm test` (includes new catalog guard test); `node --check catalog/trophies.js`.
- Mobile: `npm run type-check`.
- Manual smoke: run dev backend, call `GET /api/trophies` — expect `summary.total = 76`, no duplicate criteria, categories all present; open Trophies screen and Profile trophies tab — totals consistent (profile shows `unlocked/76`).
- Run `cleanup-removed-trophies.js --all` on local DB, then `POST /api/trophies/recompute` — unlocked count may drop by however many removed duplicates the user had unlocked (expected).

## Accepted overlaps (intentional, scope-based — do NOT "fix")
- `first-step` (any task #1) vs `first-win` (personal task #1): different scopes; a personal first task fires both by design.
- `team-player` (first room task) fires alongside `first-step` when the first ever task is a room task: different scopes.
- `first-room` vs `room-creator`: if the owner is auto-added as a RoomMember, creating a room may fire both; join vs create are distinct achievements.
- `first-rhythm` (3 total active days) vs `first-streak` (3 consecutive days): distinct metrics.

## Risks
- **Users' visible unlocked totals will drop** (e.g., a user who unlocked both `first-step` and `task-starter` keeps only `first-step`). Counts on both screens shrink accordingly (89→76 total). This is the intended outcome — communicate in release notes if applicable.
- Mobile trophy cache (`krios_trophies_cache_v1`, 60s TTL + focus refresh) may briefly show removed trophies after deploy. Self-resolves; no action needed.
- No schema/DB migration required; cleanup script is optional hygiene.

## Out of scope
- Wiring Focused/Growth/Learning/priority stubs to real data (later).
- Category banner images (user will tackle later).
- Rebalancing rarity colors or thresholds beyond removals listed.
