/**
 * AI Chat Service
 *
 * Manages:
 * - Persistent conversation history (AsyncStorage, rolling 50 msgs)
 * - Chat summary for older context (so AI always has full picture)
 * - Sending messages to backend /api/ai/chat
 * - Returning structured response: { reply, taskSuggestion }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../constants/config';

const HISTORY_KEY = '@krios:chatHistory';
const MAX_STORED = 50;   // keep last 50 messages in storage
const MAX_SENT   = 20;   // send last 20 to AI for context

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO string
}

export interface TaskSuggestion {
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  taskType: 'daily' | 'weekly' | 'one-time';
  bucket?: string;
  dueDate?: string;   // ISO date string
  dueTime?: string;   // "HH:MM" 24h
  notes?: string;
}

export interface ChatResponse {
  reply: string;
  taskSuggestion: TaskSuggestion | null;
}

// ---------------------------------------------------------------------------
// History persistence
// ---------------------------------------------------------------------------

export async function loadHistory(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(messages: ChatMessage[]): Promise<void> {
  try {
    // Keep only the last MAX_STORED messages
    const trimmed = messages.slice(-MAX_STORED);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[AIChatService] Failed to save history:', err);
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {}
}

export function makeMessage(role: 'user' | 'assistant', text: string): ChatMessage {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Send message to backend
// ---------------------------------------------------------------------------

export async function sendChatMessage(params: {
  message: string;
  history: ChatMessage[];
  token: string;
}): Promise<ChatResponse> {
  const { message, history, token } = params;

  // Send only last MAX_SENT messages as context
  const contextHistory = history.slice(-MAX_SENT).map(m => ({
    role: m.role,
    text: m.text,
  }));

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history: contextHistory }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (err.code === 'NO_API_KEY') {
        return {
          reply: "I'm not fully set up yet — the AI key needs to be added on the server. I'll be ready soon! ✦",
          taskSuggestion: null,
        };
      }
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    return {
      reply: data.reply || "I'm here! What would you like to do?",
      taskSuggestion: data.taskSuggestion || null,
    };
  } catch (err) {
    console.warn('[AIChatService] Send failed:', err);
    return {
      reply: "Couldn't reach the server — check your connection and try again.",
      taskSuggestion: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Parse natural language date/time helpers (local, no AI needed)
// Used to display friendly labels on the task preview card
// ---------------------------------------------------------------------------

export function formatDueLabel(dueDate?: string, dueTime?: string): string {
  if (!dueDate && !dueTime) return '';

  const parts: string[] = [];

  if (dueDate) {
    const d = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) parts.push('Today');
    else if (d.toDateString() === tomorrow.toDateString()) parts.push('Tomorrow');
    else parts.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  }

  if (dueTime) {
    const [h, m] = dueTime.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    parts.push(`${hour}:${String(m).padStart(2, '0')} ${ampm}`);
  }

  return parts.join(' · ');
}

export function priorityEmoji(priority: string): string {
  switch (priority) {
    case 'urgent': return '🔴';
    case 'high':   return '🟠';
    case 'medium': return '🟡';
    case 'low':    return '🟢';
    default:       return '🟡';
  }
}

export function taskTypeLabel(type: string): string {
  switch (type) {
    case 'daily':   return 'Daily';
    case 'weekly':  return 'Weekly';
    default:        return 'One-time';
  }
}
