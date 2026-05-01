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
  if (!GEMINI_API_KEY) {
    const err = new Error('Missing GEMINI_API_KEY');
    // @ts-ignore
    err.code = 'NO_API_KEY';
    throw err;
  }
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
  const modelFallbacks = [
    preferredModel,
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
  ].filter((v, i, a) => !!v && a.indexOf(v) === i);

  const callModel = async (model) => {
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
      const errText = await response.text();
      let errMessage = `Gemini API error ${response.status}: ${errText}`;
      
      // Detect quota/rate limit errors and provide helpful message
      if (response.status === 429) {
        if (errText.includes('RESOURCE_EXHAUSTED') || errText.includes('quota')) {
          errMessage = 'AI quota exceeded. The free tier quota has been exhausted. Please wait a minute or upgrade to a paid plan for more requests.';
        } else {
          errMessage = 'AI rate limit exceeded. Please wait a moment before trying again.';
        }
      }
      
      const err = new Error(errMessage);
      // @ts-ignore
      err.httpStatus = response.status;
      err.isQuotaError = response.status === 429;
      throw err;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned empty response');

    try {
      return safeJsonParse(text);
    } catch (e) {
      throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
    }
  };

  let lastErr;
  for (const m of modelFallbacks) {
    try {
      return await callModel(m);
    } catch (e) {
      lastErr = e;
      // Retry on NOT_FOUND (404) or quota/rate limit (429) errors
      if (e.httpStatus && e.httpStatus !== 404 && e.httpStatus !== 429) throw e;
      // For 429 errors, continue to try next model in fallback chain
      console.log(`[AI] Model ${m} hit rate limit, trying next model...`);
    }
  }
  throw lastErr || new Error('Gemini request failed - all models unavailable');

}

// ---------------------------------------------------------------------------
// OpenAI Provider
// ---------------------------------------------------------------------------

function safeJsonParse(text) {
  if (!text || typeof text !== 'string') throw new Error('AI returned empty response');
  let t = text.trim();
  // Remove markdown fences
  if (t.startsWith('```')) {
    t = t.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
  }
  // Best-effort extract first JSON object
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return JSON.parse(t);
}

async function callOpenAI({ systemPrompt, userPrompt }) {
  if (!OPENAI_API_KEY) {
    const err = new Error('Missing OPENAI_API_KEY');
    // @ts-ignore
    err.code = 'NO_API_KEY';
    throw err;
  }
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

  try {
    return safeJsonParse(text);
  } catch (e) {
    throw new Error(`OpenAI returned invalid JSON: ${text.slice(0, 200)}`);
  }
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

  // ========== FOOD & COOKING ==========
  if (/\b(cook|cooking|recipe|meal|food|eat|diet|nutrition|breakfast|lunch|dinner|snack|dessert|baking|bake|prepare)\b/.test(taskLower)) {
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
    questions.push({
      id: 'dietGoal',
      question: 'Diet goal?',
      type: 'chips',
      options: ['Weight loss', 'Muscle gain', 'Maintenance', 'Keto', 'Vegan', 'Balanced'],
      optional: true,
    });
  }
  // ========== READING ==========
  else if (/\b(novel|book|read|reading|story|chapter|comic|manga|article|blog|post|textbook|manual)\b/.test(taskLower)) {
    questions.push({
      id: 'genre',
      question: 'What genre or type?',
      type: 'chips',
      options: ['Fiction', 'Non-fiction', 'Sci-fi', 'Fantasy', 'Self-help', 'Biography', 'Mystery', 'Romance', 'Business', 'Other'],
    });
    questions.push({
      id: 'bookTitle',
      question: 'Do you have a specific title in mind?',
      type: 'text',
      placeholder: 'e.g. Dune, Atomic Habits... (or skip)',
      optional: true,
    });
    questions.push({
      id: 'readingGoal',
      question: 'Reading goal?',
      type: 'chips',
      options: ['Finish a book', 'Read X pages/day', 'Learn a topic', 'Relax/enjoy', 'Study material'],
      optional: true,
    });
  }
  // ========== EXERCISE & FITNESS ==========
  else if (/\b(exercise|workout|gym|fitness|run|walking|walk|train|training|sport|yoga|pilates|stretch|hiit|cardio|strength|muscle|weight|lift)\b/.test(taskLower)) {
    questions.push({
      id: 'exerciseType',
      question: 'What kind of workout?',
      type: 'chips',
      options: ['Cardio', 'Strength', 'Yoga', 'HIIT', 'Swimming', 'Running', 'Cycling', 'Stretching', 'Sports', 'Other'],
    });
    questions.push({
      id: 'duration',
      question: 'How long per session?',
      type: 'chips',
      options: ['15 mins', '30 mins', '45 mins', '1 hour', '1.5 hours', '2+ hours'],
    });
    questions.push({
      id: 'fitnessGoal',
      question: 'Main goal?',
      type: 'chips',
      options: ['Weight loss', 'Muscle gain', 'Endurance', 'Flexibility', 'General health', 'Sport specific'],
      optional: true,
    });
  }
  // ========== LEARNING & STUDY ==========
  else if (/\b(learn|study|course|tutorial|class|lecture|practice|skill|language|programming|coding|math|science|history|geography|music|instrument|piano|guitar|dance)\b/.test(taskLower)) {
    questions.push({
      id: 'subject',
      question: 'What subject or skill?',
      type: 'text',
      placeholder: 'e.g. Python, Guitar, Spanish, Piano...',
      optional: false,
    });
    questions.push({
      id: 'level',
      question: 'Your current level?',
      type: 'chips',
      options: ['Complete beginner', 'Some experience', 'Intermediate', 'Advanced', 'Expert'],
    });
    questions.push({
      id: 'learningGoal',
      question: 'Goal?',
      type: 'chips',
      options: ['Hobby', 'Career growth', 'Certification', 'Personal development', 'Academic', 'Just for fun'],
      optional: true,
    });
  }
  // ========== WRITING ==========
  else if (/\b(write|writing|journal|essay|blog|story|novel|poem|script|content|email|report|document|note|diary|memory)\b/.test(taskLower)) {
    questions.push({
      id: 'writeType',
      question: 'What kind of writing?',
      type: 'chips',
      options: ['Journal', 'Essay', 'Blog post', 'Short story', 'Report', 'Email', 'Creative writing', 'Notes', 'Other'],
    });
    questions.push({
      id: 'writeLength',
      question: 'Roughly how long?',
      type: 'chips',
      options: ['A few lines', '1 page', '2-5 pages', '5+ pages', 'Ongoing/Daily'],
      optional: true,
    });
    questions.push({
      id: 'writingGoal',
      question: 'Purpose?',
      type: 'chips',
      options: ['Self-reflection', 'Work/School', 'Creative expression', 'Memory keeping', 'Communication'],
      optional: true,
    });
  }
  // ========== WATCHING ==========
  else if (/\b(watch|watching|movie|show|series|film|episode|documentary|youtube|video|stream|tv|anime|cartoon|netflix|prime|disney)\b/.test(taskLower)) {
    questions.push({
      id: 'watchType',
      question: 'What are you watching?',
      type: 'chips',
      options: ['Movie', 'TV Series', 'Documentary', 'YouTube', 'Anime', 'Sports', 'News', 'Other'],
    });
    questions.push({
      id: 'watchTitle',
      question: 'Got a specific title?',
      type: 'text',
      placeholder: 'e.g. Inception, Breaking Bad...',
      optional: true,
    });
    questions.push({
      id: 'watchGoal',
      question: 'Purpose?',
      type: 'chips',
      options: ['Entertainment', 'Learning', 'Relaxation', 'Social', 'Background'],
      optional: true,
    });
  }
  // ========== MEDITATION & MINDFULNESS ==========
  else if (/\b(meditat|meditation|mindful|breathe|breathing|relax|relaxation|nap|rest|sleep|peace|calm|zen|spirit|pray|prayer|affirmation|gratitude|journaling)\b/.test(taskLower)) {
    questions.push({
      id: 'meditationType',
      question: 'What type?',
      type: 'chips',
      options: ['Meditation', 'Breathing exercise', 'Nap', 'Sleep', 'Prayer', 'Affirmations', 'Gratitude practice', 'Other'],
    });
    questions.push({
      id: 'duration',
      question: 'How long?',
      type: 'chips',
      options: ['5 mins', '10 mins', '15 mins', '30 mins', '1 hour', 'As needed'],
    });
    questions.push({
      id: 'goal',
      question: 'Goal?',
      type: 'chips',
      options: ['Stress relief', 'Better sleep', 'Focus', 'Spiritual', 'Emotional balance', 'Just relax'],
      optional: true,
    });
  }
  // ========== CLEANING & ORGANIZING ==========
  else if (/\b(clean|cleaning|organize|organizing|tidy|declutter|laundry|wash|dish|vacuum|sweep|mop|garden|garden|pet|care)\b/.test(taskLower)) {
    questions.push({
      id: 'cleaningType',
      question: 'What needs doing?',
      type: 'chips',
      options: ['General cleaning', 'Laundry', 'Dishes', 'Vacuuming', 'Organizing', 'Bathroom', 'Kitchen', 'Outdoor', 'Other'],
    });
    questions.push({
      id: 'area',
      question: 'Which area?',
      type: 'text',
      placeholder: 'e.g. Bedroom, Kitchen, Garage...',
      optional: true,
    });
    questions.push({
      id: 'frequency',
      question: 'How often?',
      type: 'chips',
      options: ['Daily', 'Weekly', 'Bi-weekly', 'Monthly', 'One-time deep clean'],
      optional: true,
    });
  }
  // ========== SHOPPING & ERRANDS ==========
  else if (/\b(shop|shopping|buy|purchase|errand|errands|grocery|groceries|store|market|mall|order|delivery|pickup)\b/.test(taskLower)) {
    questions.push({
      id: 'shopType',
      question: 'What are you getting?',
      type: 'chips',
      options: ['Groceries', 'Household items', 'Clothing', 'Electronics', 'Gifts', 'Medicine', 'Other'],
    });
    questions.push({
      id: 'shopMethod',
      question: 'How?',
      type: 'chips',
      options: ['In-store', 'Online delivery', 'Pickup', 'Both'],
    });
    questions.push({
      id: 'budget',
      question: 'Budget?',
      type: 'chips',
      options: ['Under $50', '$50-100', '$100-200', '$200+', 'No limit'],
      optional: true,
    });
  }
  // ========== WORK & CAREER ==========
  else if (/\b(work|task|tasks|project|meeting|email|meeting|deadline|report|presentation|document|plan|schedule|calendar|office|job|career|business|client|customer)\b/.test(taskLower)) {
    questions.push({
      id: 'workType',
      question: 'What type of work?',
      type: 'chips',
      options: ['Deep work', 'Email/Communication', 'Meeting', 'Planning', 'Administrative', 'Creative', 'Research', 'Other'],
    });
    questions.push({
      id: 'priority',
      question: 'Priority level?',
      type: 'chips',
      options: ['Urgent', 'High', 'Medium', 'Low', 'When time permits'],
    });
    questions.push({
      id: 'timeEstimate',
      question: 'Time estimate?',
      type: 'chips',
      options: ['Quick (< 30min)', '1 hour', '2-3 hours', 'Half day', 'Full day', 'Ongoing'],
      optional: true,
    });
  }
  // ========== FINANCE & ADMIN ==========
  else if (/\b(budget|finance|tax|taxes|bill|bills|pay|payment|account|bank|invest|investment|saving|expense|cost|price|order|refund|return)\b/.test(taskLower)) {
    questions.push({
      id: 'financeType',
      question: 'What needs doing?',
      type: 'chips',
      options: ['Pay bills', 'Budget review', 'Tax preparation', 'Investment', 'Invoice', 'Review expenses', 'Other'],
    });
    questions.push({
      id: 'urgency',
      question: 'How urgent?',
      type: 'chips',
      options: ['Overdue', 'Due today', 'Due this week', 'This month', 'No deadline'],
    });
    questions.push({
      id: 'amount',
      question: 'Amount involved?',
      type: 'text',
      placeholder: 'e.g. $500 (or skip)',
      optional: true,
    });
  }
  // ========== HEALTH & MEDICAL ==========
  else if (/\b(doctor|medical|health|checkup|appointment|therapy|counsel|medicine|medication|pill|vitamin|supplement|doctor|dentist|optometrist|physical|therapy|mental|health|therapy)\b/.test(taskLower)) {
    questions.push({
      id: 'healthType',
      question: 'What type?',
      type: 'chips',
      options: ['Doctor visit', 'Therapy', 'Dental', 'Vision', 'Medication', 'Checkup', 'Mental health', 'Other'],
    });
    questions.push({
      id: 'urgency',
      question: 'How urgent?',
      type: 'chips',
      options: ['Emergency', 'Soon as possible', 'This week', 'This month', 'Routine/Checkup'],
    });
    questions.push({
      id: 'insurance',
      question: 'Insurance?',
      type: 'chips',
      options: ['Yes - need to use', 'No - paying out of pocket', 'Not sure'],
      optional: true,
    });
  }
  // ========== SOCIAL & FAMILY ==========
  else if (/\b(call|text|message|email|friend|friends|family|parent|child|kid|kids|son|daughter|wife|husband|partner|spouse|brother|sister|grandparent|relatives|visit|hangout|meetup|social)\b/.test(taskLower)) {
    questions.push({
      id: 'socialType',
      question: 'What do you need to do?',
      type: 'chips',
      options: ['Call', 'Text/Message', 'Video call', 'In-person visit', 'Plan meetup', 'Send gift'],
    });
    questions.push({
      id: 'who',
      question: 'Who?',
      type: 'text',
      placeholder: 'e.g. Mom, Best friend, Team...',
      optional: true,
    });
    questions.push({
      id: 'frequency',
      question: 'How often?',
      type: 'chips',
      options: ['Daily', 'Weekly', 'Monthly', 'Occasionally', 'One-time'],
      optional: true,
    });
  }
  // ========== HOBBIES & CREATIVE ==========
  else if (/\b(draw|drawing|paint|painting|photo|photography|music|sing|song|play|instrument|game|gaming|video.?game|board.?game|craft|knit|sew|sewing|knitting|woodwork|lego|lego|collect|collection|hobby|creative|DIY)\b/.test(taskLower)) {
    questions.push({
      id: 'hobbyType',
      question: 'What hobby?',
      type: 'chips',
      options: ['Drawing/Painting', 'Photography', 'Music', 'Gaming', 'Crafts', 'Building/LEGO', 'Collections', 'DIY', 'Other'],
    });
    questions.push({
      id: 'hobbyGoal',
      question: 'Goal?',
      type: 'chips',
      options: ['Practice/Skill up', 'Create something', 'Relax/Unwind', 'Share/Showcase', 'Learn new', 'Just for fun'],
      optional: true,
    });
    questions.push({
      id: 'timeSpent',
      question: 'How long?',
      type: 'chips',
      options: ['30 mins', '1 hour', '2 hours', 'Half day', 'Full day', 'As long as I want'],
      optional: true,
    });
  }
  // ========== Default fallback ==========
  else {
    // Generic fallback questions
    questions.push({
      id: 'goal',
      question: 'What does success look like?',
      type: 'text',
      placeholder: 'Describe your goal...',
      optional: false,
    });
    questions.push({
      id: 'timeframe',
      question: 'How long should this take?',
      type: 'chips',
      options: ['Quick (< 1hr)', 'Half day', 'A few days', 'Weeks', 'Ongoing'],
      optional: true,
    });
    questions.push({
      id: 'priority',
      question: 'Priority?',
      type: 'chips',
      options: ['Must do today', 'This week', 'When I can', 'Someday'],
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
