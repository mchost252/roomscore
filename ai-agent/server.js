import express from 'express';
import { createGroq } from '@ai-sdk/groq';
import { streamText, tool, generateObject, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Tactical Request Logger & Fail-safe Body Parser
app.use((req, res, next) => {
  console.log(`[COMMS_INCOMING] ${req.method} ${req.url} from ${req.ip}`);
  if (req.method === 'POST' && (!req.body || Object.keys(req.body).length === 0)) {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (data) {
        try {
          req.body = JSON.parse(data);
          console.log('[AI-Agent] Body recovered from raw stream.');
        } catch (e) {
          console.warn('[AI-Agent] Raw stream detected but not valid JSON.');
        }
      }
      next();
    });
  } else {
    next();
  }
});

let prisma;
try {
  prisma = new PrismaClient();
  prisma.user.count()
    .then(c => console.log(`[AI-Agent] Prisma connected. User count: ${c}`))
    .catch(e => console.error('[AI-Agent] DB Query Failed. Check DATABASE_URL:', e.message));
} catch (e) {
  console.error('[AI-Agent] Prisma initialization failed:', e);
}

const MODEL_ID = 'meta-llama/llama-4-scout-17b-16e-instruct';

app.get('/api/health', (req, res) => {
  res.json({ status: 'ONLINE', model: MODEL_ID });
});

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// ── COMMANDER CHAT (Streaming) ───────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!req.body || !req.body.messages) {
    return res.status(400).json({ error: 'INVALID_REQUEST_BODY' });
  }

  const { messages, roomId, userId, taskId } = req.body;
  console.log(`[AI-Agent] Incoming Turn: ${messages.length} messages. Room: ${roomId || 'PERS'}, Task: ${taskId || 'NONE'}`);
  // console.log('[AI-Agent] Full History Payload:', JSON.stringify(messages, null, 2));

  try {
    const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { username: true } }) : null;
    let roomName = 'Personal Space';
    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
      if (room) roomName = room.name;
    }

    let taskContext = '';
    if (taskId) {
      const roomTask = await prisma.roomTask.findUnique({ where: { id: taskId } });
      const personalTask = await prisma.personalTask.findUnique({ where: { id: taskId } });
      const t = roomTask || personalTask;
      if (t) {
        taskContext = `CURRENT MISSION FOCUS: "${t.title}"\nSTATUS: ${t.isCompleted ? 'SECURED' : 'ACTIVE'}`;
      }
    }

    const systemPrompt = `You are Krios, a friendly and encouraging personal assistant inside a social habit-tracking app called Roomscore.
You are chatting with ${user?.username || 'the user'} in their ${roomId ? `shared Room "${roomName}"` : 'Personal Space'}.
${taskContext}

PERSONALITY:
- Warm, supportive, concise. Like a helpful friend, not a robot.
- Use 1-2 relevant emojis naturally. Keep replies short (2-4 sentences unless the user wants detail).
- Celebrate wins! Encourage progress. Be genuine.

HARD RULES:
- NEVER use military/tactical language (no "commander", "mission", "operator", "intel", "archive", "deploy", "recon").
- NEVER reveal internal tool names, function names, or technical architecture to the user.
- NEVER say things like "I'll call create_task" or "Let me use get_user_context". Just DO IT silently.
- NEVER create a task with an empty or "undefined" title. If the user says "add a task" without specifying what, ASK them what the task should be called first.

TOOL USAGE:
- When the user asks to see their tasks, schedule, progress, or "what do I have" → IMMEDIATELY call get_user_context with scope "personal" (or "room" if in a Room). Do NOT reply with text first.
- When the user asks to add/create a task AND provides a clear title → call create_task immediately.
- When the user asks to mark a task done or update it → call update_task. You need the task ID — if you don't have it, call get_user_context first to find it.
- When the user asks to delete/remove a task → call delete_task. You need the task ID — if you don't have it, call get_user_context first to find it.
- For the "scope" parameter in get_user_context, always pass "personal" or "room" as a string.
- For the "description" parameter in create_task, pass a brief helpful description (1 sentence). For "points", use 10 as default.

AFTER TOOL RESULTS:
- When you receive tool results, summarize them naturally for the user. Don't dump raw data.
- For get_user_context results: present tasks in a clean, friendly list. Mention how many are ongoing vs completed.
- For create_task results: confirm the task was added with an encouraging message.
- For errors: apologize briefly and suggest trying again. Never show error codes.

GENERAL CONVERSATION:
- You can chat about anything — motivation, habits, productivity tips, or just casual conversation.
- If the user seems stressed or overwhelmed, be empathetic first, then offer to help prioritize.
- You are NOT a search engine. If you don't know something, say so honestly.`;

    // ── History Translator ──────────────────────────────────────────────
    // Converts client-side UIMessage parts into the format that
    // convertToModelMessages() expects. Key rules:
    //   1. Every tool-call MUST have a matching tool-result (or convertToModelMessages throws MissingToolResultsError)
    //   2. text-delta → text (text-delta is a streaming-only type, not valid in history)
    //   3. tool-invocation (v3 format) → tool-call + tool-result pair
    //   4. Empty assistant messages get a placeholder text part
    const safeMessages = (messages || []).map(msg => {
      // User messages: ensure parts array exists
      if (msg.role === 'user') {
        if (!msg.parts && msg.content) {
          return { ...msg, parts: [{ type: 'text', text: msg.content }] };
        }
        // Filter user parts to only text
        if (msg.parts) {
          const textParts = msg.parts.filter(p => p.type === 'text').map(p => ({
            type: 'text',
            text: p.text || ''
          }));
          if (textParts.length === 0 && msg.content) {
            textParts.push({ type: 'text', text: msg.content });
          }
          return { ...msg, parts: textParts.length > 0 ? textParts : [{ type: 'text', text: '.' }] };
        }
        return msg;
      }
      
      if (msg.role === 'assistant' && msg.parts) {
        const newParts = [];
        // Track which toolCallIds have results so we can add missing ones
        const toolCallIds = new Set();
        const toolResultIds = new Set();
        
        for (const p of msg.parts) {
          if (p.type === 'text') {
            if (p.text && p.text.trim()) newParts.push({ type: 'text', text: p.text });
          } else if (p.type === 'text-delta') {
            // text-delta is streaming-only; convert to text
            if (p.textDelta || p.text) {
              newParts.push({ type: 'text', text: p.textDelta || p.text });
            }
          } else if (p.type === 'tool-invocation') {
            const tcId = p.toolInvocationId || p.toolCallId || `tc_${Date.now()}`;
            // Always emit tool-call
            newParts.push({
              type: 'tool-call',
              toolCallId: tcId,
              toolName: p.toolName,
              input: p.args || p.input || {}
            });
            toolCallIds.add(tcId);
            
            // Always emit a matching tool-result (use dummy if no result yet)
            const hasResult = p.state === 'result' || p.state === 'output-available' || p.result !== undefined;
            newParts.push({
              type: 'tool-result',
              toolCallId: tcId,
              toolName: p.toolName,
              output: hasResult ? (p.result || p.output || { status: 'OK' }) : { status: 'COMPLETED' }
            });
            toolResultIds.add(tcId);
          } else if (p.type === 'tool-call') {
            const tcId = p.toolCallId || `tc_${Date.now()}`;
            newParts.push({ ...p, toolCallId: tcId, input: p.input || p.args || {} });
            toolCallIds.add(tcId);
          } else if (p.type === 'tool-result') {
            const tcId = p.toolCallId || `tc_${Date.now()}`;
            newParts.push({ ...p, toolCallId: tcId, output: p.output || p.result || { status: 'OK' } });
            toolResultIds.add(tcId);
          }
        }
        
        // Second pass: ensure every tool-call has a matching tool-result
        for (const tcId of toolCallIds) {
          if (!toolResultIds.has(tcId)) {
            // Find the tool-call to get the toolName
            const tc = newParts.find(p => p.type === 'tool-call' && p.toolCallId === tcId);
            newParts.push({
              type: 'tool-result',
              toolCallId: tcId,
              toolName: tc?.toolName || 'unknown',
              output: { status: 'COMPLETED' }
            });
          }
        }
        
        // Ensure at least one text part exists
        if (newParts.length === 0) {
          newParts.push({ type: 'text', text: '...' });
        }
        
        return { ...msg, parts: newParts };
      }
      
      return msg;
    });
    
    // Debug: log translated messages shape
    console.log('[AI-Agent] safeMessages count:', safeMessages.length);
    
    let modelReadyMessages;
    try {
      modelReadyMessages = await convertToModelMessages(safeMessages);
    } catch (e) {
      console.error('[AI-Agent] convertToModelMessages failed:', e.message);
      // Fallback: strip all tool parts and just keep text to avoid crashing
      const textOnlyMessages = safeMessages.map(msg => {
        if (msg.role === 'assistant' && msg.parts) {
          const textParts = msg.parts.filter(p => p.type === 'text');
          return { ...msg, parts: textParts.length > 0 ? textParts : [{ type: 'text', text: '...' }] };
        }
        return msg;
      });
      try {
        modelReadyMessages = await convertToModelMessages(textOnlyMessages);
        console.log('[AI-Agent] Fallback text-only conversion succeeded');
      } catch (e2) {
        console.error('[AI-Agent] Even text-only conversion failed:', e2.message);
        // Last resort: just use the latest user message
        const lastUser = safeMessages.filter(m => m.role === 'user').pop();
        modelReadyMessages = await convertToModelMessages(lastUser ? [lastUser] : []);
      }
    }

    const result = await streamText({
      model: groq(MODEL_ID, { strictJsonSchema: false }),
      system: systemPrompt,
      maxSteps: 5,
      // Convert UI messages to model-ready messages
      messages: modelReadyMessages,
      tools: {
        create_task: tool({
          description: 'Create or add a new task for the user',
          parameters: z.object({
            title: z.string(),
            description: z.string(),
            points: z.number(),
          }),
        }),
        get_user_context: tool({
          description: 'Get recent tasks and context to understand what the user has been doing',
          parameters: z.object({
            scope: z.string(),
          }),
        }),
        update_task: tool({
          description: 'Update or mark a task as done/pending',
          parameters: z.object({
            taskId: z.string(),
            title: z.string(),
            isCompleted: z.boolean(),
          }),
        }),
        delete_task: tool({
          description: 'Delete a task permanently',
          parameters: z.object({ taskId: z.string() }),
        }),
      },
    });

    // Use the official UI-message specific piping for Express response (AI SDK v6)
    result.pipeUIMessageStreamToResponse(res);
  } catch (e) {
    console.error('[AI-Agent] Chat Error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'COMM_LINK_FAILURE', details: e.message });
    }
  }
});

// ── TASK ASSIST (Structured) ──────────────────────────────────────────────────
app.post('/api/task-assist', async (req, res) => {
  try {
    const { taskTitle, taskType, priority, userProfile, clarifications, notesContext } = req.body;
    
    const contextHints = clarifications 
      ? `\nAdditional context from user: ${JSON.stringify(clarifications)}`
      : '';
    const notesHint = notesContext && String(notesContext).trim()
      ? `\nUser's current notepad for this task: ${String(notesContext).slice(0, 1200)}`
      : '';
    
    const result = await generateObject({
      model: groq(MODEL_ID, { strictJsonSchema: false }),
      schema: z.object({
        summary: z.string(),
        flow: z.array(z.object({ step: z.number(), title: z.string(), detail: z.string() })),
        milestones: z.array(z.object({ id: z.number(), label: z.string(), completed: z.boolean() })),
        resource: z.object({
          name: z.string(),
          url: z.string(),
          type: z.enum(['app', 'website', 'book', 'tool']),
          description: z.string(),
        }).nullable(),
        hook: z.string(),
        estimatedTime: z.string(),
        category: z.string(),
      }),
      prompt: `You are Krios, a warm and motivational AI assistant inside a habit-tracking app.

A user just created a task called: "${taskTitle}"
Task type: ${taskType || 'daily'}
Priority: ${priority || 'medium'}${contextHints}${notesHint}

Generate a helpful, motivational AI note for this task. Your response should feel like advice from a supportive friend, NOT a textbook or lesson plan.

Rules for each field:
- "summary": A short (1-2 sentence) motivational take on WHY this task matters. Make it personal and encouraging. Example for "Read a novel": "Reading expands your imagination and gives you a mental escape — even 15 minutes a day adds up to finishing a whole book in a few weeks!"
- "flow": 3-4 practical, actionable steps to actually DO this task. Not academic theory — real steps. Example for "Read a novel": [{step 1: "Pick your book", detail: "Choose something that genuinely excites you — ask friends for recs or check bestseller lists"}, {step 2: "Set a daily page goal", detail: "Start small: 10-20 pages. You can always read more if you're hooked!"}]
- "milestones": 3-4 checkpoints the user can celebrate along the way. Make them feel achievable. Example: ["Picked my book", "Finished chapter 1", "Halfway through!", "Finished the book"]
- "resource": Pick ONE specific, real resource that fits the exact task. Prefer a searchable website/app/book/tool name and include a valid URL. If no resource would genuinely help, set null. Never use a generic "research path".
- "hook": One interesting, fun, or surprising fact related to this task that gets the user excited. Example: "Did you know the average CEO reads 60 books a year? You're joining some great company!"
- "estimatedTime": A realistic time estimate like "15-30 min/day" or "1-2 hours total"
- "category": One word category like "fitness", "reading", "learning", "health", "productivity", "creative", "social", "finance", "mindfulness"

Keep everything conversational, warm, and actionable. No jargon. No academic language.`,
    });
    res.json({ success: true, note: result.object });
  } catch (e) {
    console.error('[AI-Agent] Task Assist Error:', e);
    res.status(500).json({ error: 'NOTE_GENERATION_FAILED', details: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Krios AI Agent (Express Bypass) listening on all interfaces at port ${PORT}`);
});
