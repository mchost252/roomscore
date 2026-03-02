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
import { API_BASE_URL } from '../constants/config';
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
  const vagueWords = ['read', 'study', 'learn', 'exercise', 'workout', 'write', 'watch', 'cook', 'practice', 'do', 'finish'];
  const isVague = wordCount <= 4 || vagueWords.some(w => lower.includes(w));

  return {
    isVague,
    vagueScore: isVague ? 3 : 0,
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
    const response = await fetch(`${API_BASE_URL}/api/ai/task-assist`, {
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
