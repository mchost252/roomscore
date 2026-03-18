​ROLE & MISSION:
You are an elite Lead React Native Architect and UI/UX Designer. Your task is to build the initial architecture and UI implementation for Room.tsx (the Cluster/Room Screen) for a high-end social habit-tracking app called Krios.
The app operates on a "WhatsApp-level" local-first architecture (0% JS thread lag, instant loads) with a "Shiny and Massive" futuristic dark-mode aesthetic.
​CONTEXT & VISUAL TARGETS:
I have provided reference images. The UI must utilize Interactive Glassmorphism (rgba(255,255,255,0.05) with 1px borders), deep charcoal backgrounds, and neon accents. All layout shifts and animations MUST use react-native-reanimated (Native Driver). No useState for UI movement.
​CORE ARCHITECTURE & COMPONENTS REQUIRED:
​1. The Dual-State Header (Reanimated Flip):
• ​State A (Calendar/Info): Displays the current week/calendar and the Room Title.
• ​State B (Room Details/Admin): Triggered by a tap. Flips (using rotateY via Reanimated) to reveal a "Dashboard" back-side.
• ​Back-Side UI: Includes the "Doom Clock" (a circular gauge showing the Room's Ban/Expiry date transitioning from Green to Red), the Room Code, and Owner controls (if userRole === 'OWNER').
​2. The Task Selection & Folder List (FlashList):
• ​Layout: Tasks are displayed as massive "Folder Cards" (refer to the provided image).
• ​Visual States: * Accepted Tasks: Sit at the top. Full color, vibrant glassmorphic styling, glowing borders. Avatar stack of active users features pulsing rings.
• ​Spectator Tasks: Sit below. Grayed out, 40% opacity, tagged as "Viewing Only".
• ​Interaction: A 3-dot menu on each folder opens a sleek BottomSheet to "Join" or "Leave" a task without navigating away.
• ​First Entry: When a user enters the room for the very first time, trigger a staggered fade-and-scale entrance for these folders.
​3. The Task Thread (The Command Center):
• ​Design: A "Glass Subway Timeline". A vertical neon line runs down the left; updates and messages are nodes on this line.
• ​Pinned Memory Wall: The top of the thread features a horizontal scroll of "Pinned Images" (polygonal, angled thumbnails). These are pre-fetched and open instantly to full screen on tap.
• ​System Messages: Admin changes (e.g., "Deadline updated") appear as slim, deep-purple pill cards in the timeline.
​4. The Logic Engine (Strict Rules - Implement State Structures for these):
• ​Local-First Sync: Assume the use of SQLite/MMKV. The UI must only render from local state. Supabase is only used to fetch missing "deltas" since the last login (maximum 5-day retention).
• ​Reputation & Verification (Trust Shield): * Implement state for an "Aura" score (determines vote weight).
• ​Implement "Ghost Approval" logic: If a submitted task proof is unreviewed for 4 hours, it auto-passes unless "Challenged" by a peer within 12 hours.
• ​Gamification Decays: Implement state for Weekly Sprints. Badges decay (fade in opacity) after 7 days if not defended.
​YOUR OUTPUT:
• ​Do not scatter the code. Provide the complete, robust TypeScript implementation for Room.tsx.
• ​Create clean, modular internal components (<TaskFolder />, <DualHeader />) within the file or suggest the exact file structure.
• ​Write the explicit StyleSheet utilizing React Native Reanimated to achieve the "Shiny and Massive" glassmorphic UI.
• ​Define the TypeScript Interfaces (Room, Task, UserAura) clearly at the top.





​PROJECT: KRIOS - ADVANCED ROOM & COMMAND THREAD ARCHITECTURE
​ROLE: You are a Lead Software Architect specializing in High-Performance Mobile Engines (React Native, Skia, Reanimated). Your goal is to implement the Room.tsx ecosystem. This is not just a UI; it is a local-first, high-fidelity game-style dashboard that must run at a locked 60 FPS.
​PHASE 1: DATA ARCHITECTURE (THE LOCAL ENGINE)
• ​Local-First Sync: Use a "Delta-Sync" strategy. The app must never show a loading spinner after the first entry. Store data in SQLite/MMKV.
• ​Retention Policy: Strictly enforce a 5-day local message retention. On the 6th day, the "Janitor" function must purge local records.
• ​Point System: Implement a 7-day "Weekly Sprint" state. Points reset every Sunday.
• ​Aura Logic: Define a UserAura type where "Aura" determines vote weight in verification.
​PHASE 2: ROOM SELECTION UI (THE "SHINY" FOLDER HUB)
• ​Header (Dual-Flip): * Use rotateY via Reanimated 3 to flip between Calendar View and Room Details.
• ​Room Details Side: Must feature the Doom Clock (a GPU-accelerated circular gauge that bleeds from Green to Red as the Room Expiry/Ban date approaches).
• ​Folder Layout (High-Fidelity):
• ​Accepted Tasks (Top): "Active" folders with Skia-powered neon cyan outer glows. Show an avatar stack of participants; active users get a pulsing green "Live" ring.
• ​Spectator Tasks (Bottom): Monochrome folders at 40% opacity with a "Viewing Only" overlay.
• ​Interaction: Tapping an "Accepted" folder triggers a Shared Element Transition into the Task Thread.
​PHASE 3: THE COMMAND THREAD (WHATSAPP-SPEED HYBRID HUB)
• ​Visual Style: Implement the "Subway Timeline". A vertical neon violet line down the left margin. Every message and update is a node on this line.
• ​Memory Wall: The top header features a horizontal scroll of "Pinned Images." These are angled, polygonal thumbnails that pre-fetch and open instantly.
• ​Proof of Work: * Implement "Ghost Approval": If an admin hasn't reviewed a submission in 4 hours, auto-approve it.
• ​The Challenge System: Allow users to "Challenge" an auto-pass for 12 hours. If challenged, points are frozen for "Justice Review" by the Owner.
• ​Gamification: Implement "Heat" states. If a task hits 80% completion, the folder icon should trigger a static "Heat" color shift (no heavy animations to preserve FPS).
​PHASE 4: OWNER & ADMIN PERMISSIONS
• ​Conditional UI: If user.id === room.owner_id, inject "Admin Pills" into the 3-dot folder menus (Edit Task, Ban User, Justice Review).
• ​System Messages: Any setting change (e.g., deadline move) must inject a non-deletable, deep-purple pill card into the timeline.
​TECHNICAL CONSTRAINTS:
• ​Zero-JS Animation Policy: All movement MUST be handled via useAnimatedStyle and withSpring.
• ​Image Optimization: Use react-native-fast-image. Once an image is delivered to all users in a task, flag the Supabase URL for auto-deletion to keep the DB light.
• ​Static Aura: Aura colors (Bronze, Silver, Gold) should be pre-cached constants to avoid re-renders.
​YOUR TASK:
Generate the full TypeScript implementation for the Room ecosystem. Provide the RoomProvider for state, the FolderList for the hub, and the CommandThread for the task view. Ensure all TypeScript interfaces are robust and account for the 5-day retention and weighted voting logic.