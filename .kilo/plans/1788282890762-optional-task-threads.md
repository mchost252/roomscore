# MVP Readiness Plan (Krios/RoomScore)

**Goal**: Take mobile + backend from "feature-rich prototype" to a shippable private-beta MVP. Strategy: **stabilize + hide**. No new features. Unfinished/inert UI gets hidden, not implemented.

**Scope**: `mobile/` + `backend/`. Web frontend explicitly out of scope.

## Phase 0 — Safety
1. Take a clean git snapshot/commit of current working tree before any surgery.
2. Mobile runs on Android physical device via dev build; web is a secondary target for smoke verification only.

## Phase 1 — Core-loop UX bug fixes (mobile)
Folded in from previous pending plan (`1788282890762-optional-task-threads.md`), both still unfixed:

1. **Empty chat state position** — `mobile/app/(home)/chat.tsx` (~line 1511): the empty overlay sits too low. Raise `translateY: -12` → `-40` on the inner emptyChat view; verify against real device with keyboard closed AND open. Overlay structure (outside FlashList) stays as-is.
2. **Keyboard pushes composer down instead of up (Android)** — root cause: `app.json` has `edgeToEdgeEnabled: true` + `adjustResize`; with RN 0.81/Expo 54 edge-to-edge, the window height doesn't shrink the way legacy adjustResize implies, and the absolutely-positioned composer (`styles.inputWrap`, `position: absolute; bottom: 0`) doesn't follow the IME. Fix using **react-native-keyboard-controller** (already in package.json):
   - Import `useReanimatedKeyboardAnimation` in chat.tsx.
   - `const { height } = useReanimatedKeyboardAnimation();` → `const composerKbStyle = useAnimatedStyle(() => ({ transform: [{ translateY: height.value }] }));`
   - Wrap the composer (`View inputWrapRef`, ~line 1590) in `Animated.View` with that style.
   - Keep `KeyboardAvoidingView behavior={undefined}` for Android as-is (prevents double-compensation; documented at line 1237-1243).
   - Verify on physical Android device: composer rides up with keyboard, caption text remains visible, no residual gap after dismiss.
3. **Regression sweep on 4 chat surfaces** (`chat.tsx`, `room-chat.tsx`, `room-task-thread.tsx`, `ai-chat.tsx`): composer behaves correctly in all four.

## Phase 2 — Hide unfinished/inert UI (no new features)
Known inert surfaces to remove or gate behind a "Coming soon"-free UI:

1. `mobile/app/(home)/settings.tsx` (lines ~192-200): Security, Help & FAQ, Contact Support, Terms of Service rows open "Coming soon" modals → **remove these rows**.
2. `mobile/app/(home)/profile.tsx` (lines ~701-702): Privacy, Help and support rows → **remove**.
3. `mobile/app/(home)/chat.tsx` profile sheet "SHARED" section (~line 1313): rows described as inert → **remove the SHARED section rows** (or entire section if nothing remains).
4. `mobile/components/messaging/MessageInput.tsx` (lines ~159, 164): Voice message button → "Coming Soon" alert, Emoji button → "coming soon" alert → **remove both buttons** (simpler + cleaner; restore when feature lands).
5. `mobile/app/(home)/trophies.tsx`: "Coming soon" trophies (line ~105, criterionless trophies render "Coming soon" text) — **leave as-is** (that's a meaningful empty state, not a dead control).
6. `mobile/hooks/useSmartSuggestions.ts` — currently unused (only re-exported in `hooks/index.ts`). **Delete file + remove barrel export**, confirm nothing imports it (grep verified: no importers found besides barrel).

Rule of thumb applied throughout Phase 2: if tapping it shows "Coming soon" with no backend/feature behind it, it goes away. If it's a meaningful empty/locked state, it stays.

## Phase 3 — Workspace hygiene
1. Delete committed backup files (grep-verified stale, none imported by anything):
   - `mobile/app/(home)/_layout.tsx.bak`, `.bak2`, `.bak3`
   - `mobile/app/(home)/index.tsx.bak2`
   - `mobile/app/test.tsx`
   - `mobile/app/index-simple.tsx.backup`
   - `mobile/app/_error.tsx` — verify not referenced; delete if unused (expo-router auto-collects routes, so a dead file here is a real hazard).
   - Git status also shows `profile.backup.tsx.bak` deleted in working tree already — confirm it's gone from the tree.
2. Confirm no other `.bak`/`.copy`/`.old` files: `rg --files -g '*.bak*' mobile/`.
3. Fix pre-existing type errors blocking the gate in `mobile/app/(home)/trophies.tsx` (`IMAGE_FOR_CATEGORY` undefined, `Image` imported wrong at line 413/420) — owner's WIP, minimal fix only so `tsc --noEmit` passes; do NOT restructure troops UI (owner is actively working there).

## Phase 4 — Quality gates

### 4a. Mobile lint
- Create `mobile/eslint.config.js` (flat config) extending `eslint-config-expo` + `eslint-plugin-react-hooks` + `eslint-plugin-recommended-type-checking` equivalent for Expo SDK 54.
- Rule severity: warnings for stylistic, errors only for `react-hooks/rules-of-hooks`, `no-undef`-equivalents via tsc. Add `ignorePatterns` for `node_modules`, `.expo`, `dist`, `*.bak*`.
- Command change: `package.json` lint script → `eslint .` (flat config doesn't take `--ext`).
- Run once; fix or disable-blocking-report (`// eslint-disable-next-line` with reason comment) everything, target `npm run lint` exit 0.

### 4b. Mobile type-check
- `npm run type-check` must exit 0 (currently fails only on trophies.tsx which Phase 3 fixes).

### 4c. Backend smoke tests
Current state: `npm test` exits 1 with zero tests (and `server.js:237` calls `server.listen()` at module top level, so `require('../server')` from a test would start an HTTP listener — needs a guard).

Setup:
1. `backend/server.js`: wrap `server.listen(...)` in `if (require.main === module)` guard. `module.exports = { app, server, io }` already exists.
2. `backend/__tests__/setup.js`: spin up a **fresh sqlite** test DB per run — use `prisma db push --schema=prisma/schema.local.prisma` against `DATABASE_URL=file:./test.db` in a `globalSetup`/globalTeardown, reusing the local sqlite schema so tests don't touch prod/dev DBs.
3. Auth smoke (`__tests__/auth.smoke.test.js`): register → login → GET /auth/profile with token.
4. Rooms smoke (`__tests__/rooms.smoke.test.js`): create room (with bundled task) → list rooms → join via joinCode with second user → member list reflects both.
6. Tasks smoke (`__tests__/tasks.smoke.test.js`): create task → owner create w/ hasThread:true → complete → uncomplete → points update.
7. Thread/nodes smoke (`__tests__/thread.smoke.test.js`): post node to hasThread:true task succeeds; post node to hasThread:false task → 403 ("thread disabled" guard from Phase-shipped earlier).
8. `npm test` in /backend exits 0.

Notes for tests:
- Socket.io in tests: exports exist; silence or `jest.mock` PushNotificationService/notification emission if they attempt network.
- Keep test files under `backend/__tests__/` so the existing `testMatch` picks them up.

### 4d. No CI changes (out of scope; just note in AGENTS.md what the gates are).

## Phase 5 — Verification on device
1. `npm run type-check` (mobile) exits 0.
2. `npm run lint` (mobile) exits 0.
3. `npm test` (backend) exits 0 with the smoke suite.
4. On Android physical device, walk the golden path:
   - launch → onboarding → sign in → home
   - create a room with one task (thread OFF) + one (thread ON)
   - join a friend via code → complete task via card checkbox → points visible
   - open thread on the thread task → post text → open proof image → close
   - chat: send message → empty state is correctly positioned (not upside-down, not too low) → keyboard opens and composer rides up
   - settings/profile screens: no dead "Coming soon" rows
5. Logcat glance: no repeated RedBox/errors.

## Open questions / explicitly out of scope
- Web frontend audit — excluded by user.
- Implementing "coming soon" features (emoji picker, voice, help, security, privacy) — excluded by user; hidden for MVP.
- Trophy system logic/UI — owner is actively working in trophies.tsx; scope limited to unbreaking its type errors.
- No CI setup.
- No commit/push of this work from the agent; user runs git.

## Success criteria (DoD)
- `npm run type-check`: exits 0 in /mobile
- `npm run lint`: exits 0 in /mobile with new flat config
- `npm test`: exits 0 in /backend with smoke suite green
- Physical device walkthrough: golden path completed without red screens, broken layouts, or keyboard pushing composer off
- Settings/Profile/MessageInput contain no dead "Coming soon" controls
- No `.bak*`/`test.tsx`-style stale files under `mobile/app`
