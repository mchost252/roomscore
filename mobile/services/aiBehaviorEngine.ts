/**
 * AI Behavior Engine
 *
 * Learns user preferences locally (AsyncStorage) and syncs to backend.
 * After enough data points, the AI can skip clarification questions it
 * already knows the answer to.
 *
 * Tracks:
 * - Task categories used (reading, fitness, learning, etc.)
 * - Genre/sub-preferences per category (sci-fi, cardio, etc.)
 * - Completion rates per task type
 * - Time-of-day patterns
 * - Preferred apps/resources
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@krios:aiProfile';
const SKIP_THRESHOLD = 3; // after 3 tasks of same type, skip clarification

export interface CategoryProfile {
  count: number;
  lastUsed: string;
  preferences: Record<string, string | number>;
  completionRate: number;
  totalCompleted: number;
}

export interface AIUserProfile {
  categories: Record<string, CategoryProfile>;
  totalTasksCreated: number;
  totalTasksCompleted: number;
  preferredTimeOfDay: string | null;
  lastUpdated: string;
  version: number;
}

const defaultProfile = (): AIUserProfile => ({
  categories: {},
  totalTasksCreated: 0,
  totalTasksCompleted: 0,
  preferredTimeOfDay: null,
  lastUpdated: new Date().toISOString(),
  version: 1,
});

class AIBehaviorEngine {
  private profile: AIUserProfile | null = null;
  private dirty = false;

  // ---------------------------------------------------------------------------
  // Load / Save
  // ---------------------------------------------------------------------------

  async load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      this.profile = raw ? JSON.parse(raw) : defaultProfile();
    } catch {
      this.profile = defaultProfile();
    }
  }

  async save(): Promise<void> {
    if (!this.dirty || !this.profile) return;
    try {
      this.profile.lastUpdated = new Date().toISOString();
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
      this.dirty = false;
    } catch (err) {
      console.warn('[AIBehaviorEngine] Save failed:', err);
    }
  }

  private async getProfile(): Promise<AIUserProfile> {
    if (!this.profile) await this.load();
    return this.profile!;
  }

  // ---------------------------------------------------------------------------
  // Track task creation
  // ---------------------------------------------------------------------------

  async trackTaskCreated(params: {
    category: string;
    clarifications?: Record<string, string>;
  }): Promise<void> {
    const profile = await this.getProfile();
    const { category, clarifications = {} } = params;

    profile.totalTasksCreated += 1;

    if (!profile.categories[category]) {
      profile.categories[category] = {
        count: 0,
        lastUsed: new Date().toISOString(),
        preferences: {},
        completionRate: 0,
        totalCompleted: 0,
      };
    }

    const cat = profile.categories[category];
    cat.count += 1;
    cat.lastUsed = new Date().toISOString();

    // Store clarification answers as preferences (most recent wins)
    Object.entries(clarifications).forEach(([key, value]) => {
      if (value) cat.preferences[key] = value;
    });

    // Track time of day
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) profile.preferredTimeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) profile.preferredTimeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) profile.preferredTimeOfDay = 'evening';
    else profile.preferredTimeOfDay = 'night';

    this.dirty = true;
    await this.save();
  }

  // ---------------------------------------------------------------------------
  // Track task completion
  // ---------------------------------------------------------------------------

  async trackTaskCompleted(category: string): Promise<void> {
    const profile = await this.getProfile();
    profile.totalTasksCompleted += 1;

    if (profile.categories[category]) {
      const cat = profile.categories[category];
      cat.totalCompleted += 1;
      cat.completionRate = Math.round((cat.totalCompleted / cat.count) * 100);
    }

    this.dirty = true;
    await this.save();
  }

  // ---------------------------------------------------------------------------
  // Should we skip clarification?
  // ---------------------------------------------------------------------------

  async shouldSkipClarification(category: string): Promise<boolean> {
    const profile = await this.getProfile();
    const cat = profile.categories[category];
    if (!cat) return false;
    return cat.count >= SKIP_THRESHOLD;
  }

  // ---------------------------------------------------------------------------
  // Get known preferences for a category
  // ---------------------------------------------------------------------------

  async getPreferences(category: string): Promise<Record<string, string | number>> {
    const profile = await this.getProfile();
    return profile.categories[category]?.preferences ?? {};
  }

  // ---------------------------------------------------------------------------
  // Get compact profile summary to send with AI requests
  // ---------------------------------------------------------------------------

  async getProfileSummary(): Promise<Record<string, any>> {
    const profile = await this.getProfile();

    const topCategories = Object.entries(profile.categories)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .reduce((acc, [key, val]) => {
        acc[key] = {
          count: val.count,
          completionRate: val.completionRate,
          preferences: val.preferences,
        };
        return acc;
      }, {} as Record<string, any>);

    return {
      topCategories,
      totalTasks: profile.totalTasksCreated,
      preferredTimeOfDay: profile.preferredTimeOfDay,
    };
  }

  // ---------------------------------------------------------------------------
  // Sync profile to backend
  // ---------------------------------------------------------------------------

  async syncToBackend(apiCall: (preferences: Record<string, any>) => Promise<void>): Promise<void> {
    try {
      const summary = await this.getProfileSummary();
      await apiCall(summary);
    } catch (err) {
      console.warn('[AIBehaviorEngine] Backend sync failed (non-critical):', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  async reset(): Promise<void> {
    this.profile = defaultProfile();
    this.dirty = true;
    await this.save();
  }
}

export const aiBehaviorEngine = new AIBehaviorEngine();
