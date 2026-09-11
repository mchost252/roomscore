# Mobile Tab-Transition & UI Responsiveness Performance Plan

## Scope
Optimize **tab switching** (Home / Rooms / Messages / Profile) responsiveness on the Expo mobile app. Tab switches currently remount every screen from scratch and fire mount-time work that competes with the native slide animation, causing dropped frames and visible stutter before the screen settles.

## Root Cause (confirmed in code)
1. **Every tab switch destroys + remounts the target screen.** `(home)/_layout.tsx` `navigateHomeTab` uses `router.replace(route)` (line 148) with a `slide_from_right/left` card animation (lines 175, 180-190). Because the four tab routes are siblings in a plain `Stack` and `replace` swaps them, there is **no screen caching**: the previous screen unmounts and the target mounts fresh on every switch.
2. The fresh mount runs heavy synchronous/async work inside the animation window:
   - `hooks/room/useRoomsInstant.ts` calls `getCachedRoomsList()` **2-3 times** synchronously on mount (lines 87, 89), each doing `storage.getString` + `JSON.parse`.
   - Its initial `useEffect` (lines 152-154) always invokes `fetchFromAPI`, which on success runs a **sequential per-room `await db.runAsync` SQLite write loop** (lines 117-129) plus `Promise.allSettled` of two `/rooms` API calls, even when cache exists.
   - `useRoomsManager` re-runs `filteredMyRooms` / `filteredPublicRooms` `.filter()` **on every render** (lines 109-122), and its `useEffect` maps over `hookError` every render.
3. **`useFocusEffect` callbacks are replaced immediately on focus** in `rooms.tsx` (82-87), `messages.tsx` (101-106), `profile.tsx` (515-519), triggering context updates + re-renders of `_layout` during the transition.
4. **Mount-time animated enter effects** (`FadeInDown`) and **heavy `useMemo`/`useAnimatedScrollHandler` setups** in `profile.tsx` (trophies array, scroll handler) run while the screen is still sliding in.

## Proposed Changes (ordered by impact)

### 1. Defer mount-time network/SQLite work out of the animation frame
- In `useRoomsInstant.ts`: add in-memory/module-level guard so `fetchFromAPI` does **not** run a full SQLite rewrite on repeat mounts within a session. Wrap the initial `fetchFromAPI` (line 153) in `InteractionManager.runAfterInteractions`, and skip the API call entirely when a fresh cache exists (`ROOMS_LIST_TS_KEY` within TTL, e.g. 60s).
- Move per-room `db.runAsync` write loop (lines 117-129) into a single deferred/batched task, using `db.withTransactionAsync` or `Promise.all` to remove sequential `await`.

### 2. Memoize derived rooms data
- In `useRoomsManager.ts`, wrap `filteredMyRooms` and `filteredPublicRooms` in `useMemo` keyed on `[myRooms, publicRooms, searchQuery]`.

### 3. Defer `useFocusEffect` context registration
- In `rooms.tsx` / `messages.tsx` / `profile.tsx`, wrap `setOpenAIChat`/`setOpenAddTask` context assignments in `InteractionManager.runAfterInteractions`.

### 4. (Optional, higher effort) Keep tab screens mounted instead of `replace`
- Switch tab navigation from `router.replace` to mounted screens via `react-native-screens` `freezeOnBlur` with `Stack` + `push`, or render all four tabs in one container toggled by `activeNavTabIndex`. Biggest win, highest risk; follow-up after 1-3 land.

## Validation
- `cd mobile && npm run type-check` passes.
- `npm run lint` clean.
- Manual: rapid Home→Rooms→Messages→Profile switch; no spinner flash, no stutter, rooms list paints from MMKV cache instantly on re-entry.
- No regressions: rooms still refresh (pull-to-refresh), messages unread badge updates, profile edits persist.

## Risks
- InteractionManager deferral can delay legit first-load spinners if not guarded by cache-existence checks; scoped by "skip fetch when fresh cache".
- Changing `replace`→mount strategy (item 4) can alter back-stack behavior and deep-link flow; keep behind a flag.

## Out of Scope
- Chat/room-detail secondary push animation work (separate pass).
- Backend changes.
