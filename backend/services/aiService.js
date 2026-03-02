/**
 * AI Service — Provider-Agnostic Task Assistant
 *
 * Supports: Gemini (Google) or OpenAI (GPT-4o)
 * Switch provider via env: AI_PROVIDER=gemini | openai
 *
 * Returns structured JSON notes for task threads.
 */

const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the system + user prompt for task assistance.
 * @param {object} params
 * @param {string} params.taskTitle
 * @param {string} params.taskType  - daily | weekly | one-time
 * @param {string} params.priority  - low | medium | high
 * @param {object} params.clarifications - { question: answer } pairs
 * @param {object} params.userProfile - learned preferences
 */
function buildPrompt({ taskTitle, taskType, priority, clarifications = {}, userProfile = {} }) {
  const clarificationText = Object.entries(clarifications)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join('\n') || 'None provided.';

  const profileText = Object.keys(userProfile).length > 0
    ? JSON.stringify(userProfile, null, 2)
    : 'No profile data yet.';

  const systemPrompt = `You are Krios AI, a smart personal task assistant embedded inside a productivity app.
Your job is to help users complete their tasks more easily and enjoyably.
You are thoughtful, encouraging, and practical. You keep things concise but useful.
You always respond with a valid JSON object — nothing else, no markdown fences.`;

  const userPrompt = `A user just created this task:
Title: "${taskTitle}"
Type: ${taskType || 'one-time'}
Priority: ${priority || 'medium'}

Clarification answers provided:
${clarificationText}

User preference profile (what we know about them):
${profileText}

Generate a structured task assistance note. Return ONLY a valid JSON object with this exact shape:
{
  "summary": "One sentence summarizing the task and what the AI will help with.",
  "flow": [
    { "step": 1, "title": "Step title", "detail": "Short actionable description" }
  ],
  "hook": "A short, interesting fact or motivational angle about this task (1-2 sentences). Make it feel personal and exciting.",
  "resource": {
    "name": "App or website name",
    "url": "https://...",
    "type": "app | website | book | tool",
    "description": "One line on why this resource helps with the task"
  },
  "milestones": [
    { "id": 1, "label": "Milestone label", "completed": false }
  ],
  "estimatedTime": "e.g. 30 mins, 1 week, ongoing",
  "category": "detected category e.g. reading | fitness | learning | creative | productivity | social | health | finance | other"
}

Rules:
- flow: 3 to 6 steps, practical and specific to the actual task
- milestones: 2 to 4 checkable milestones — progress markers, not same as steps
- hook: never generic — tie it to the specific task
- resource: pick the single most useful real app/site for this task
- If the task is simple and needs no resource, set resource to null
- estimatedTime: realistic based on task type
- All text should feel warm, human, and encouraging`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// Gemini Provider
// ---------------------------------------------------------------------------

async function callGemini({ systemPrompt, userPrompt }) {
  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');

  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// OpenAI Provider
// ---------------------------------------------------------------------------

async function callOpenAI({ systemPrompt, userPrompt }) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned empty response');

  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Vagueness Check (lightweight, no AI call needed)
// ---------------------------------------------------------------------------

const VAGUE_KEYWORDS = [
  'something', 'stuff', 'things', 'whatever', 'maybe', 'perhaps',
  'read', 'study', 'learn', 'exercise', 'workout', 'practice', 'improve',
  'work on', 'do', 'finish', 'write', 'cook', 'clean', 'organize', 'fix',
  'watch', 'listen', 'research', 'explore', 'check',
];

const VAGUE_PATTERNS = [
  /^(a |an )?(novel|book|article|video|movie|show|series|podcast|course)$/i,
  /^(go to the |go )?(gym|store|market|bank|doctor|dentist)$/i,
  /^(learn|study|practice)\s+\w+$/i,
  /^(read|watch|listen to)\s+(a |an |some )?\w+$/i,
  /^(work on|finish|complete)\s+.{0,20}$/i,
];

/**
 * Detect if a task title is vague and needs clarification.
 * Returns { isVague, questions[] }
 */
function detectVagueness(taskTitle) {
  const lower = taskTitle.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  let vagueScore = 0;

  // Very short tasks are often vague
  if (wordCount <= 2) vagueScore += 2;
  if (wordCount <= 4) vagueScore += 1;

  // Check vague keywords
  for (const kw of VAGUE_KEYWORDS) {
    if (lower.includes(kw)) { vagueScore += 1; }
  }

  // Check vague patterns
  for (const pattern of VAGUE_PATTERNS) {
    if (pattern.test(lower)) { vagueScore += 2; break; }
  }

  const isVague = vagueScore >= 2;
  const questions = isVague ? generateClarificationQuestions(lower) : [];

  return { isVague, vagueScore, questions };
}

/**
 * Generate smart clarification questions based on task content.
 */
function generateClarificationQuestions(taskLower) {
  const questions = [];

  if (/\b(novel|book|read|story|chapter)\b/.test(taskLower)) {
    questions.push({
      id: 'genre',
      question: 'What genre or type of book?',
      type: 'chips',
      options: ['Fiction', 'Non-fiction', 'Sci-fi', 'Fantasy', 'Self-help', 'Biography', 'Mystery', 'Other'],
    });
    questions.push({
      id: 'bookTitle',
      question: 'Do you have a specific title in mind?',
      type: 'text',
      placeholder: 'e.g. Dune, Atomic Habits... (or skip)',
      optional: true,
    });
  } else if (/\b(exercise|workout|gym|fitness|run|walk|train)\b/.test(taskLower)) {
    questions.push({
      id: 'exerciseType',
      question: 'What kind of workout?',
      type: 'chips',
      options: ['Cardio', 'Strength', 'Yoga', 'HIIT', 'Swimming', 'Running', 'Cycling', 'Other'],
    });
    questions.push({
      id: 'duration',
      question: 'How long per session?',
      type: 'chips',
      options: ['15 mins', '30 mins', '45 mins', '1 hour', '1.5 hours'],
    });
  } else if (/\b(learn|study|course|tutorial)\b/.test(taskLower)) {
    questions.push({
      id: 'subject',
      question: 'What subject or skill?',
      type: 'text',
      placeholder: 'e.g. Python, Guitar, Spanish...',
      optional: false,
    });
    questions.push({
      id: 'level',
      question: 'Your current level?',
      type: 'chips',
      options: ['Complete beginner', 'Some experience', 'Intermediate', 'Advanced'],
    });
  } else if (/\b(write|writing|journal|essay|blog|story)\b/.test(taskLower)) {
    questions.push({
      id: 'writeType',
      question: 'What kind of writing?',
      type: 'chips',
      options: ['Journal', 'Essay', 'Blog post', 'Short story', 'Report', 'Other'],
    });
    questions.push({
      id: 'writeLength',
      question: 'Roughly how long?',
      type: 'chips',
      options: ['A few lines', '1 page', '2-5 pages', '5+ pages', 'Ongoing'],
      optional: true,
    });
  } else if (/\b(watch|movie|show|series|film|episode)\b/.test(taskLower)) {
    questions.push({
      id: 'watchType',
      question: 'What are you watching?',
      type: 'chips',
      options: ['Movie', 'TV Series', 'Documentary', 'YouTube', 'Anime', 'Other'],
    });
    questions.push({
      id: 'watchTitle',
      question: 'Got a specific title?',
      type: 'text',
      placeholder: 'e.g. Inception, Breaking Bad...',
      optional: true,
    });
  } else if (/\b(cook|cooking|recipe|meal|food)\b/.test(taskLower)) {
    questions.push({
      id: 'mealType',
      question: 'What kind of meal?',
      type: 'chips',
      options: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Meal prep'],
    });
    questions.push({
      id: 'cuisine',
      question: 'Any cuisine preference?',
      type: 'text',
      placeholder: 'e.g. Italian, Asian, Local... (optional)',
      optional: true,
    });
  } else {
    // Generic fallback questions
    questions.push({
      id: 'goal',
      question: 'What\'s the main goal here?',
      type: 'text',
      placeholder: 'Describe what success looks like...',
      optional: false,
    });
    questions.push({
      id: 'timeframe',
      question: 'How long do you want to spend on this?',
      type: 'chips',
      options: ['Quick (< 1hr)', 'Half a day', 'A few days', 'Weeks', 'Ongoing'],
      optional: true,
    });
  }

  return questions.slice(0, 3); // Max 3 questions always
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Generate a structured AI task note.
 * @param {object} params
 * @returns {Promise<object>} Structured note JSON
 */
async function generateTaskNote(params) {
  const { systemPrompt, userPrompt } = buildPrompt(params);

  let result;
  if (AI_PROVIDER === 'openai') {
    result = await callOpenAI({ systemPrompt, userPrompt });
  } else {
    result = await callGemini({ systemPrompt, userPrompt });
  }

  // Validate and sanitize response
  return {
    summary: result.summary || '',
    flow: Array.isArray(result.flow) ? result.flow.slice(0, 6) : [],
    hook: result.hook || '',
    resource: result.resource || null,
    milestones: Array.isArray(result.milestones)
      ? result.milestones.map((m, i) => ({ ...m, id: m.id || i + 1, completed: false }))
      : [],
    estimatedTime: result.estimatedTime || '',
    category: result.category || 'other',
    generatedAt: new Date().toISOString(),
    provider: AI_PROVIDER,
  };
}

module.exports = { generateTaskNote, detectVagueness, generateClarificationQuestions };
