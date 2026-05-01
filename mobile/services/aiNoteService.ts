/**
 * AI Note Service
 *
 * Handles fetching, caching, and managing AI-generated task notes.
 *
 * Flow:
 * 1. Check AsyncStorage cache first (instant, works offline)
 * 2. If online and cache is stale/missing → fetch from backend
 * 3. Cache result locally after successful fetch
 * 4. Return cached note when offline
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AI_TASK_ASSIST_URL } from '../constants/config';
import { aiBehaviorEngine } from './aiBehaviorEngine';


const CACHE_PREFIX = '@krios:aiNote:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — notes rarely change

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIFlowStep {
  step: number;
  title: string;
  detail: string;
}

export interface AIResource {
  name: string;
  url: string;
  type: 'app' | 'website' | 'book' | 'tool';
  description: string;
}

export interface AIMilestone {
  id: number;
  label: string;
  completed: boolean;
}

export interface AINote {
  summary: string;
  flow: AIFlowStep[];
  hook: string;
  resource: AIResource | null;
  milestones: AIMilestone[];
  estimatedTime: string;
  category: string;
  generatedAt: string;
  provider: string;
  // local fields
  taskId: string;
  cachedAt: string;
  fromCache: boolean;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'text' | 'chips';
  options?: string[];
  placeholder?: string;
  optional?: boolean;
}

export interface VaguenessResult {
  isVague: boolean;
  vagueScore: number;
  questions: ClarificationQuestion[];
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cacheKey(taskId: string) {
  return `${CACHE_PREFIX}${taskId}`;
}

async function getCached(taskId: string): Promise<AINote | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(taskId));
    if (!raw) return null;
    const note: AINote = JSON.parse(raw);
    const age = Date.now() - new Date(note.cachedAt).getTime();
    if (age > CACHE_TTL_MS) return null; // stale
    return { ...note, fromCache: true };
  } catch {
    return null;
  }
}

async function setCache(taskId: string, note: AINote): Promise<void> {
  try {
    const toStore: AINote = { ...note, taskId, cachedAt: new Date().toISOString(), fromCache: false };
    await AsyncStorage.setItem(cacheKey(taskId), JSON.stringify(toStore));
  } catch (err) {
    console.warn('[AINote] Cache write failed:', err);
  }
}

async function clearCache(taskId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(taskId));
  } catch {}
}

// ---------------------------------------------------------------------------
// Milestone persistence (separate from the note itself so updates are cheap)
// ---------------------------------------------------------------------------

const MILESTONE_PREFIX = '@krios:aiMilestones:';

export async function saveMilestones(taskId: string, milestones: AIMilestone[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${MILESTONE_PREFIX}${taskId}`, JSON.stringify(milestones));
  } catch {}
}

export async function loadMilestones(taskId: string): Promise<AIMilestone[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${MILESTONE_PREFIX}${taskId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Vagueness check (calls backend — fast, no AI needed)
// ---------------------------------------------------------------------------

export async function checkVagueness(
  taskTitle: string,
  token: string
): Promise<VaguenessResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/check-vagueness`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ taskTitle }),
    });

    if (!response.ok) throw new Error('Vagueness check failed');
    return await response.json();
  } catch {
    // If offline or server error — run basic local check
    return localVaguenessCheck(taskTitle);
  }
}

/** Lightweight offline fallback vagueness check */
function localVaguenessCheck(title: string): VaguenessResult {
  const lower = title.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;
  
  // Comprehensive list of vague action words
  const vagueWords = [
    // General vague
    'do', 'done', 'finish', 'start', 'continue', 'keep', 'stop', 'quit',
    // Learning
    'learn', 'study', 'practice', 'review', 'revise', 'memorize', 'master',
    // Physical activities  
    'exercise', 'workout', 'run', 'walk', 'train', 'gym', 'fitness', 'yoga',
    // Creative
    'read', 'write', 'draw', 'paint', 'create', 'design', 'make', 'build',
    // Media
    'watch', 'listen', 'play', 'stream', 'browse', 'scroll',
    // Food
    'cook', 'meal', 'eat', 'diet', 'fast',
    // Self-care
    'meditate', 'relax', 'rest', 'sleep', 'nap', 'breathe',
    // Productivity
    'organize', 'clean', 'tidy', 'declutter', 'sort', 'file',
    // Social
    'call', 'text', 'message', 'email', 'connect', 'reach',
    // Work
    'work', 'task', 'project', 'meeting', 'plan', 'prepare',
    // Financial
    'budget', 'save', 'spend', 'pay', 'file',
    // Health
    'doctor', 'medicine', 'checkup', 'appointment',
  ];
  
  // Check for vague patterns (short tasks with action words)
  const vaguePatterns = [
    /^(go|make|get|have|do|start)\s+/i,
    /\b(thing|stuff|something|anything|everything)\b/i,
    /^\w+$/i, // Single word tasks
  ];
  
  let vagueScore = 0;

  // Very short tasks are often vague
  if (wordCount <= 2) vagueScore += 3;
  if (wordCount <= 3) vagueScore += 1;
  if (wordCount <= 4) vagueScore += 1;

  // Check vague keywords
  for (const kw of vagueWords) {
    if (lower.includes(kw)) { 
      vagueScore += 2; 
    }
  }

  // Check vague patterns
  for (const pattern of vaguePatterns) {
    if (pattern.test(lower)) { 
      vagueScore += 3; 
      break;
    }
  }

  const isVague = vagueScore >= 3;

  return {
    isVague,
    vagueScore,
    questions: [], // no questions offline — just skip clarification gracefully
  };
}

// ---------------------------------------------------------------------------
// Main: fetch AI note
// ---------------------------------------------------------------------------

export async function fetchAINote(params: {
  taskId: string;
  taskTitle: string;
  taskType?: string;
  priority?: string;
  clarifications?: Record<string, string>;
  token: string;
  forceRefresh?: boolean;
}): Promise<AINote | null> {
  const { taskId, taskTitle, taskType, priority, clarifications = {}, token, forceRefresh = false } = params;

  // 1. Return cache if available and not forcing refresh
  if (!forceRefresh) {
    const cached = await getCached(taskId);
    if (cached) {
      // Merge saved milestone states
      const savedMilestones = await loadMilestones(taskId);
      if (savedMilestones) cached.milestones = savedMilestones;
      return cached;
    }
  }

  // 2. Get user profile summary to enrich AI request
  let userProfile: Record<string, any> = {};
  try {
    userProfile = await aiBehaviorEngine.getProfileSummary();
  } catch {}

// 3. Call backend AI endpoint
  try {
    const response = await fetch(AI_TASK_ASSIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        taskId,
        taskTitle,
        taskType,
        priority,
        clarifications,
        userProfile,
      }),
    });


    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err.code === 'NO_API_KEY') {
        console.warn('[AINote] AI not configured on backend yet');
        return null;
      }
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    const note: AINote = {
      ...data.note,
      taskId,
      cachedAt: new Date().toISOString(),
      fromCache: false,
    };

    // 4. Cache it
    await setCache(taskId, note);

    // 5. Track category in behavior engine
    if (note.category) {
      await aiBehaviorEngine.trackTaskCreated({
        category: note.category,
        clarifications,
      });
    }

    return note;
  } catch (err) {
    console.warn('[AINote] Fetch failed, checking cache fallback:', err);
    // Last resort: return stale cache even if expired
    try {
      const raw = await AsyncStorage.getItem(cacheKey(taskId));
      if (raw) {
        const stale: AINote = JSON.parse(raw);
        return { ...stale, fromCache: true };
      }
    } catch {}
    return null;
  }
}

// ---------------------------------------------------------------------------
// Invalidate note (e.g. when task is deleted)
// ---------------------------------------------------------------------------

export async function invalidateAINote(taskId: string): Promise<void> {
  await clearCache(taskId);
  try {
    await AsyncStorage.removeItem(`${MILESTONE_PREFIX}${taskId}`);
  } catch {}
}
