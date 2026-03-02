/**
 * AI Routes — Task Assistant
 *
 * POST /api/ai/task-assist     → Generate structured AI note for a task
 * POST /api/ai/check-vagueness → Check if a task title needs clarification
 */

const express = require('express');
const router = express.Router();
const { generateTaskNote, detectVagueness } = require('../services/aiService');
const { protect } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory — per user, 20 AI calls per hour)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map(); // userId → { count, resetAt }

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 20) return false;

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/ai/check-vagueness
// Quick local check — no AI call, instant response
// ---------------------------------------------------------------------------
router.post('/check-vagueness', protect, (req, res) => {
  const { taskTitle } = req.body;

  if (!taskTitle || typeof taskTitle !== 'string') {
    return res.status(400).json({ error: 'taskTitle is required' });
  }

  try {
    const result = detectVagueness(taskTitle.trim());
    return res.json(result);
  } catch (err) {
    console.error('[AI] Vagueness check error:', err);
    return res.status(500).json({ error: 'Failed to analyze task' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/task-assist
// Generate a full structured AI note for a task
// ---------------------------------------------------------------------------
router.post('/task-assist', protect, async (req, res) => {
  const userId = req.user.id;
  const {
    taskTitle,
    taskType,
    priority,
    clarifications = {},
    taskId,
  } = req.body;

  if (!taskTitle || typeof taskTitle !== 'string') {
    return res.status(400).json({ error: 'taskTitle is required' });
  }

  // Rate limit check
  if (!checkRateLimit(userId)) {
    return res.status(429).json({
      error: 'AI rate limit reached. Try again in an hour.',
      retryAfter: 3600,
    });
  }

  try {
    // Fetch user preference profile from DB if available
    let userProfile = {};
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiProfile: true },
      });
      if (user?.aiProfile) {
        userProfile = typeof user.aiProfile === 'string'
          ? JSON.parse(user.aiProfile)
          : user.aiProfile;
      }
    } catch (_) {
      // aiProfile field may not exist yet — that's fine
    }

    console.log(`[AI] Generating note for user ${userId}: "${taskTitle}"`);

    const note = await generateTaskNote({
      taskTitle: taskTitle.trim(),
      taskType,
      priority,
      clarifications,
      userProfile,
    });

    // Optionally store the note against the task if taskId provided
    if (taskId) {
      try {
        await prisma.personalTask.update({
          where: { id: taskId, userId },
          data: { aiNote: JSON.stringify(note) },
        });
      } catch (_) {
        // aiNote field may not exist yet — ignore, note still returned
      }
    }

    return res.json({ success: true, note });
  } catch (err) {
    console.error('[AI] task-assist error:', err.message);

    // Check if it's an API key issue
    if (err.message?.includes('API key') || err.message?.includes('401') || err.message?.includes('403')) {
      return res.status(503).json({
        error: 'AI service not configured. Please add your API key.',
        code: 'NO_API_KEY',
      });
    }

    return res.status(500).json({ error: 'AI generation failed. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/update-profile
// Update the user's AI preference profile (called from mobile after task completion)
// ---------------------------------------------------------------------------
router.post('/update-profile', protect, async (req, res) => {
  const userId = req.user.id;
  const { preferences } = req.body;

  if (!preferences || typeof preferences !== 'object') {
    return res.status(400).json({ error: 'preferences object required' });
  }

  try {
    // Merge with existing profile
    let existing = {};
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiProfile: true },
      });
      if (user?.aiProfile) {
        existing = typeof user.aiProfile === 'string'
          ? JSON.parse(user.aiProfile)
          : user.aiProfile;
      }
    } catch (_) {}

    const merged = { ...existing, ...preferences, updatedAt: new Date().toISOString() };

    await prisma.user.update({
      where: { id: userId },
      data: { aiProfile: JSON.stringify(merged) },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[AI] update-profile error:', err.message);
    // Silently succeed even if DB update fails — not critical
    return res.json({ success: true });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// Real conversational AI with full user context
// ---------------------------------------------------------------------------
router.post('/chat', protect, async (req, res) => {
  const userId = req.user.id;
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  if (!checkRateLimit(userId)) {
    return res.status(429).json({
      error: 'AI rate limit reached. Try again in an hour.',
      retryAfter: 3600,
    });
  }

  try {
    // Fetch user data for context
    let userName = 'there';
    let userProfile = {};
    let pendingTasks = [];
    let completedCount = 0;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true, aiProfile: true },
      });
      if (user) {
        userName = user.name || user.username || 'there';
        if (user.aiProfile) {
          userProfile = typeof user.aiProfile === 'string'
            ? JSON.parse(user.aiProfile) : user.aiProfile;
        }
      }

      const tasks = await prisma.personalTask.findMany({
        where: { userId },
        select: { id: true, title: true, priority: true, taskType: true, dueDate: true, isCompleted: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });

      pendingTasks = tasks.filter(t => !t.isCompleted).slice(0, 15);
      completedCount = tasks.filter(t => t.isCompleted).length;
    } catch (_) {}

    // Build system prompt with full user context
    const now = new Date();
    const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : now.getHours() < 21 ? 'evening' : 'night';
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

    const taskListText = pendingTasks.length > 0
      ? pendingTasks.map((t, i) =>
          `${i + 1}. "${t.title}" [${t.priority || 'medium'} priority, ${t.taskType || 'one-time'}${t.dueDate ? ', due ' + new Date(t.dueDate).toLocaleDateString() : ''}]`
        ).join('\n')
      : 'No pending tasks right now.';

    const profileText = Object.keys(userProfile).length > 0
      ? JSON.stringify(userProfile, null, 2) : 'No profile data yet.';

    const systemPrompt = `You are Krios AI — a smart, warm, personal productivity assistant inside the Krios app.
You are talking to ${userName}. Today is ${dayName}, ${timeOfDay}.

WHAT YOU KNOW ABOUT ${userName.toUpperCase()}:
- Pending tasks (${pendingTasks.length}):
${taskListText}
- Completed tasks: ${completedCount}
- Learned preferences: ${profileText}

YOUR PERSONALITY:
- Warm, direct, and smart — like a brilliant friend who knows your habits
- Keep replies SHORT (2–4 sentences) unless asked for detail
- Be proactive — notice patterns, offer suggestions, don't just answer
- Never say "I'm just an AI" — you're Krios, their personal assistant
- Use their name naturally but not every message

TASK CREATION:
When the user wants to create a task (any phrasing like "add", "remind me", "I need to", "set a task", "can you create"), extract ALL details you can from their message and return a taskSuggestion JSON object.
Extract:
- title: the task name (required)
- priority: "low" | "medium" | "high" | "urgent" (default "medium")
- taskType: "daily" | "weekly" | "one-time" (default "one-time")
- bucket: category label (e.g. "health", "work", "reading", "personal")
- dueDate: ISO date string if they mention a date/day
- dueTime: "HH:MM" 24h format if they mention a time
- notes: any extra context from their message

RESPONSE FORMAT:
Always reply with valid JSON:
{
  "reply": "your conversational response here",
  "taskSuggestion": null
}
OR if creating a task:
{
  "reply": "your conversational response confirming what you understood",
  "taskSuggestion": {
    "title": "...",
    "priority": "medium",
    "taskType": "one-time",
    "bucket": "...",
    "dueDate": "...",
    "dueTime": "...",
    "notes": "..."
  }
}

IMPORTANT: Only return valid JSON. No markdown. No extra text.`;

    // Build conversation history for context (last 20 messages)
    const historyMessages = (history || []).slice(-20).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    let aiResponse;

    if (process.env.AI_PROVIDER === 'openai') {
      // OpenAI path
      const openaiHistory = history.slice(-20).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const body = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...openaiHistory,
          { role: 'user', content: message },
        ],
        temperature: 0.8,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      };

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error(`OpenAI error: ${resp.status}`);
      const data = await resp.json();
      aiResponse = JSON.parse(data.choices[0].message.content);

    } else {
      // Gemini path (default)
      const model = 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const contents = [
        ...historyMessages,
        { role: 'user', parts: [{ text: message }] },
      ];

      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini error ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned empty response');
      aiResponse = JSON.parse(text);
    }

    // Validate response shape
    const reply = aiResponse?.reply || "I'm here! What would you like to do?";
    const taskSuggestion = aiResponse?.taskSuggestion || null;

    return res.json({ success: true, reply, taskSuggestion });

  } catch (err) {
    console.error('[AI] chat error:', err.message);

    if (err.message?.includes('API key') || err.message?.includes('401') || err.message?.includes('403')) {
      return res.status(503).json({
        error: 'AI not configured. Add your API key.',
        code: 'NO_API_KEY',
      });
    }

    // Graceful fallback — don't break the chat
    return res.json({
      success: true,
      reply: "I'm having a moment — try again in a second?",
      taskSuggestion: null,
    });
  }
});

module.exports = router;

