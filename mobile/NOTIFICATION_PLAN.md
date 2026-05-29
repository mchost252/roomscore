# Krios Notification System Plan (V3 - Zero Storage, WhatsApp-Fast)

**Goal:** Implement a fast, reliable, and "WhatsApp-fast" notification system for Krios that relies on Contextual Unread Badges and Ephemeral Action Strips. No bulky notification feeds. Zero extra database storage.

## 1. Notification Types & Triggers

### A. Core Action Triggers (Push + In-App)
- **Vouch Received:** "Alex vouched for your Morning Run proof! 👏" (Immediate)
- **Ghost Approval:** "Your reading proof was Ghost Approved! 👻 +50pts" (Calculated locally, confirmed via silent sync)
- **New Task Added (Room):** "Sarah added a new task to Morning Routine Club." (Immediate)
- **Task Reminder:** "Don't forget: Drink 2L Water is due in 2 hours." (100% Local Scheduled Notification)

### B. Daily/Weekly Summaries (Push)
- **Daily Heat Check:** "You're on a 3-day streak! Complete one more task today to maintain your Heat." (Calculated and scheduled locally)
- **Weekly Sprint Wrap-up:** "Morning Routine Club scored 1,247 points this week!" (Sent Sunday 11:59 PM)

---

## 2. Strategic Permission Prompting
**The Golden Rule:** Never ask for permissions on launch.
- **Trigger A (Room):** Prompt the user to allow notifications immediately after they successfully join their *first room*.
- **Trigger B (Personal):** Prompt the user immediately after they successfully create their *first personal task*.

---

## 3. The "Zero Storage" Approach
We will NOT build a Facebook-style "Notification Center" page. It eats up phone storage, clutters the UI, and forces users to read lists instead of engaging with their habits. 

Instead, we use two highly optimized UI patterns:

### A. Contextual Unread Badges (The WhatsApp Method)
*   **Rooms Hub (`rooms.tsx`):** If a room has new activity, a glowing violet badge with the number of unread events (e.g., `3`) appears on the `RoomOperationCard`.
*   **Room Detail (`room/[id].tsx`):** The specific `RoomTaskFolder` gets a glowing unread dot.
*   **Task Thread (`room-thread/[id].tsx`):** The Subway Timeline automatically inserts an elegant `[ ────── UNREAD ────── ]` divider directly above the new messages/proofs.
*   **Storage Impact: ZERO.** The app simply compares `last_viewed_timestamp` (saved in MMKV when leaving a room) against the `updated_at` timestamps of the new items received during a Delta-Sync. Once you view the thread, the badge vanishes.

### B. The Ephemeral Action Strip
*   If the user misses their phone's OS notification (or swipes it away), they open Krios and the app runs a Delta-Sync.
*   If new events occurred while they were gone, a sleek, glassmorphic **Action Strip** drops down from the top of the Home Screen for 5 seconds.
*   *Example:* "🔥 3 new vouches in Morning Routine. Tap to view."
*   If the user taps it, they are deep-linked to the Room. If they ignore it or swipe it up, **it is deleted from RAM instantly**. There is no "History" to clutter the app.
*   **Storage Impact: ZERO.** It only exists in memory for 5 seconds.

---

## 4. The "WhatsApp-Style" Hybrid Sync Architecture

### A. The "Delta-Sync" (Foreground)
- **WebSockets (Supabase Realtime):** Used *only* when the app is actively open in the foreground. If User A vouches while User B is staring at the screen, the Ephemeral Action Strip drops down immediately.
- **On Resume (App Opening):** When Krios opens, it makes **ONE** API call: "Give me everything since my `last_sync` timestamp." It updates local SQLite, updates the timestamp, and triggers the Action Strip if needed.

### B. The "Silent Push" Wake-Up Call (Background)
1. When User A vouches for User B and User B's app is closed, the backend sends a **Silent Push Notification** (a data-only payload).
2. The payload *contains* the vouch data. The phone's OS wakes the app up silently in the background for a few seconds.
3. The app writes the new data directly to the local SQLite database.
4. When User B finally opens the app, the UI updates instantly from local SQLite. **Zero database reads occurred.**

---

## 5. Implementation Phasing

*   **Phase 1: UI Framework.** Build the `EphemeralActionStrip` context and enhance the UI components (`RoomOperationCard`, `RoomTaskFolder`, `RoomSubwayTimeline`) with WhatsApp-style unread badges. (CURRENT)
*   **Phase 2: Local Mastery.** Set up `expo-notifications`, strategic permission prompts, and local scheduling logic for due dates.
*   **Phase 3: Silent Payloads & Sync.** Save Push Tokens to Supabase. Implement the Edge Function that sends Silent Data Pushes to devices when events happen, and the logic to compare `last_viewed_timestamp` to show/hide badges.