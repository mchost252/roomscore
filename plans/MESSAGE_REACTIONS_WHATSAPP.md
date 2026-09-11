Plan: WhatsApp-style message reactions on chat screens (chat.tsx, room-chat.tsx), excluding AI chat.

Scope:
- SQLite persistence: add `message_reactions` table (`message_id`, `emoji`, `user_id`, `count`).
- UI: tap-and-hold on ChatBubble triggers emoji picker; tapping an emoji saves reaction via sqliteService.
- `MessageRow`/`ChatBubble` already have `Reaction[]` props; wire reactions through `messageService`/sqlite query.
- Recommended: SQLite persistence, not ephemeral.

Files: `sqliteService.ts` (table + query/update), `messageService.ts` (reaction methods), `ChatBubble.tsx` (long-press picker), `chat.tsx` (reaction state), `room-chat.tsx` (if exists).
