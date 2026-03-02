# 🤖 AI Task Assistant — Build Plan

**Last Updated:** 2026-02-28  
**Platform:** Mobile First (React Native / Expo)  
**AI Provider:** Provider-agnostic (Gemini or OpenAI via env variable)  
**Scope:** Personal tasks first, designed to extend to rooms

---

## Vision

A smart task assistant that lives inside the task thread. When a user creates a vague task (e.g. "read a novel"), the AI:
1. Detects ambiguity and pops up a focused clarification sheet
2. Generates a **structured note** (not a chat) inside the task thread
3. Adds a flow/steps, a motivational hook, and a resource card
4. Learns the user's preferences over time to skip clarifications

The thread is a **living document** — more Notion than WhatsApp.

---

## End-to-End Flow

```
User types task
       ↓
aiTaskParser checks vagueness (local NLP)
       ↓ (if vague)
Clarification bottom sheet pops up
(2–3 smart questions, always skippable)
       ↓
Task saved instantly to SQLite (offline-first)
       ↓
AI request → backend /api/ai/task-assist
       ↓
Backend calls Gemini / OpenAI with:
  - task title + clarification answers
  - user preference profile
       ↓
AI returns structured JSON:
  {
    flow: [...steps],
    hook: "fun fact / why this matters",
    resource: { name, url, type, description },
    milestones: [...checkboxes]
  }
       ↓
Task thread renders AI note (structured, not chat)
  - Collapsible flow steps
  - Hook / interest card
  - Resource card (tappable)
  - Milestone checkboxes
       ↓
User adds their own notes below AI section
       ↓
AI note cached in SQLite (works offline after first load)
```

---

## Phases

### Phase 1 — Clarification Popup (UI + Logic)
- Detect vague tasks using existing `aiTaskParser.ts`
- Bottom sheet with 2–3 smart questions based on task category
- Always skippable
- Answers stored with task for AI context

### Phase 2 — Backend AI Endpoint
- `POST /api/ai/task-assist`
- Provider-agnostic: reads `AI_PROVIDER` env var (`gemini` or `openai`)
- Accepts: task title, clarification answers, user preference profile
- Returns: structured JSON note (flow, hook, resource, milestones)
- Rate-limited, error-handled

### Phase 3 — Structured Note UI in Task Thread
- AI section rendered at top of task thread (pinned)
- Collapsible step-by-step flow
- Interest hook card
- Resource card (opens URL or App Store link)
- Milestone checkboxes (state saved locally + synced)
- User notes section below AI content

### Phase 4 — Learning Engine
- `aiBehaviorEngine.ts` tracks task types, genres, preferences in SQLite
- After 3+ tasks of same type, AI skips clarification (it knows the user)
- Preference profile sent with every AI request for personalization
- Sync profile to backend for cross-device persistence

### Phase 5 — Offline Caching
- AI note stored in SQLite after first fetch
- Offline: render cached note with "last updated" badge
- New tasks offline: queue AI request, process when back online
- Clarification answers queued if submitted offline

### Phase 6 — Resource Card Suggestions
- AI suggests relevant apps (Libby, Kindle, Notion, etc.)
- Short trivia/interest hook tailored to the task
- Deep links where possible (open app directly)

---

## Architecture

### Mobile (React Native)
- `aiTaskParser.ts` — vagueness detection (exists, needs tuning)
- `aiBehaviorEngine.ts` — user preference learning (to build)
- `sqliteService.ts` — local DB (exists, web-safe fix applied)
- `threadService.ts` — thread read/write (exists)
- New: `aiNoteService.ts` — fetch, cache, render AI notes

### Backend
- New: `backend/routes/ai.js` — AI task assist endpoint
- New: `backend/services/aiService.js` — provider-agnostic AI calls
- Prisma model: `AITaskNote` — store generated notes per task

### Task Thread UI
- `mobile/app/(home)/task-thread.tsx` — main thread screen
- AI note renders above user notes (pinned, collapsible)
- Milestone checkboxes interactive

---

## Environment Variables Needed

```env
# Backend .env
AI_PROVIDER=gemini          # or "openai"
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here   # fallback
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| AI thread style | Structured notes | Not chat — more like Notion AI |
| Clarification timing | Only when vague | Don't annoy users on simple tasks |
| Offline strategy | Cache-first | Show cached note, fetch update online |
| AI provider | Provider-agnostic | Swap key in .env, no code changes |
| SQLite on web | Graceful no-op | Web uses backend/cache, not local DB |
| Learning | SQLite + backend sync | Local fast, backend for cross-device |

---

## Current Status

- [x] `sqliteService.ts` — web-safe fix applied (graceful no-op on web)
- [x] `threadService.ts` — updated to support string taskIds (cuid compatible)
- [x] `aiTaskParser.ts` — vagueness detection exists (server-side)
- [x] `backend/services/aiService.js` — provider-agnostic Gemini/OpenAI wrapper ✅
- [x] `backend/routes/ai.js` — `/api/ai/check-vagueness`, `/api/ai/task-assist`, `/api/ai/update-profile` ✅
- [x] AI route registered in `backend/server.js` ✅
- [x] `mobile/services/aiBehaviorEngine.ts` — local learning engine ✅
- [x] `mobile/services/aiNoteService.ts` — fetch, cache, milestone persistence ✅
- [x] `mobile/components/AIClarificationSheet.tsx` — bottom sheet UI ✅
- [x] `mobile/components/AITaskNote.tsx` — structured note renderer ✅
- [x] `mobile/app/(home)/index.tsx` — clarification wired into task creation ✅
- [x] `mobile/app/(home)/task-thread.tsx` — AI note displayed at top of thread ✅
- [x] `backend/.env.example` — AI keys documented ✅

## What You Need To Do

1. **Add your AI API key to `backend/.env`:**
   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_key_here
   ```
   Get a free Gemini key at: https://aistudio.google.com/app/apikey

2. **Run Prisma migration** to add `aiNote` + `aiProfile` fields:
   ```bash
   cd backend && npx prisma migrate dev --name add_ai_fields
   ```

3. **Test the flow:**
   - Create a vague task like "read a novel"
   - Clarification sheet should appear
   - Submit answers → navigates to task thread
   - AI note appears at top with steps, hook, resource card, milestones
