/**
 * Krios Trophy Archive — catalog source-of-truth.
 *
 * Each entry describes a trophy's static presentation and its unlock
 * criterion. The catalog is code so we can ship many trophies without a
 * database migration. UserTrophy rows store unlock state and incremental
 * progress per user.
 *
 * 76 trophies: 39 live / 37 stubs. Design rule: no two live trophies
 * share an identical criterion — a single user action should never
 * unlock two trophies of the same shape (see catalog.test.js).
 *
 * criterion = null marks trophies whose underlying data isn't wired yet
 * (Focused needs FocusSession, Learning needs bucket, Growth needs a
 * comparison signal, Priority needs room-task priority, Mission needs a
 * project-level field). These render as "Coming soon" in the UI and never
 * unlock.
 */

const CATEGORIES = {
  beginning:    { id: 'beginning',    title: 'Beginning',    order: 1, parentIcon: 'PLACEHOLDER_BEGINNING' },
  consistency:  { id: 'consistency',  title: 'Consistency',  order: 2, parentIcon: 'PLACEHOLDER_CONSISTENCY' },
  task_master:  { id: 'task_master',  title: 'Task Master',  order: 3, parentIcon: 'PLACEHOLDER_TASK_MASTER' },
  focused:      { id: 'focused',      title: 'Focused',      order: 4, parentIcon: 'PLACEHOLDER_FOCUSED' },
  community:    { id: 'community',    title: 'Community',    order: 5, parentIcon: 'PLACEHOLDER_COMMUNITY' },
  communication:{ id: 'communication',title: 'Communication',order: 6, parentIcon: 'PLACEHOLDER_COMMUNICATION' },
  growth:       { id: 'growth',       title: 'Growth',       order: 7, parentIcon: 'PLACEHOLDER_GROWTH' },
  learning:     { id: 'learning',     title: 'Learning',     order: 8, parentIcon: 'PLACEHOLDER_LEARNING' },
  legendary:    { id: 'legendary',    title: 'Legendary',    order: 9, parentIcon: 'PLACEHOLDER_LEGENDARY' },
};

const RARITY = {
  common:    { id: 'common',    color: '#38bdf8', glow: '#38bdf880' },
  rare:      { id: 'rare',      color: '#8b5cf6', glow: '#8b5cf680' },
  epic:      { id: 'epic',      color: '#ec4899', glow: '#ec489980' },
  legendary: { id: 'legendary', color: '#f59e0b', glow: '#f59e0b80' },
};

/**
 * Criterion shape:
 *   { type: 'task_count',         scope: 'all'|'personal'|'room',  threshold: number }
 *   { type: 'active_days',        threshold: number }
 *   { type: 'streak',             threshold: number }                 // consecutive days
 *   { type: 'room_joined',        threshold: number }
 *   { type: 'room_created',       threshold: number }
 *   { type: 'room_task_count',    threshold: number }
 *   { type: 'dm_count',           threshold: number }                 // sent or received
 *   { type: 'chat_messages',      threshold: number }                 // room chat participation
 *   { type: 'category_breadth',   threshold: number }                 // distinct non-legendary categories with ≥1 unlock
 *   { type: 'all_non_legendary_unlocked' }                            // boolean
 *   { type: 'composite',          of: ['trophy_id', ...] }            // ALL referenced trophies unlocked
 *   { type: 'focus_*', ... }                                         // STUB — evaluator returns false
 *   { type: 'learning_*', ... }                                      // STUB — evaluator returns false
 *   { type: 'growth_*', ... }                                        // STUB — evaluator returns false
 *   { type: 'priority_*', ... }                                      // STUB — evaluator returns false
 *   { type: 'mission_*', ... }                                       // STUB — evaluator returns false
 */
const TROPHIES = [
  // ── 01 BEGINNING ─────────────────────────────────────────────────
  // Beginning is "firsts only" — onboarding milestones. Volume belongs
  // to Task Master; day-counts to Consistency; focus to Focused.
  { id: 'first-step',         title: 'First Step',         description: 'Complete your first task',                       category: 'beginning', rarity: 'common', criterion: { type: 'task_count', scope: 'all', threshold: 1 } },
  { id: 'first-win',          title: 'First Win',          description: 'Complete your first personal task',              category: 'beginning', rarity: 'common', criterion: { type: 'task_count', scope: 'personal', threshold: 1 } },
  { id: 'first-rhythm',       title: 'First Rhythm',       description: 'Be active on Krios for 3 separate days',         category: 'beginning', rarity: 'common', criterion: { type: 'active_days', threshold: 3 } },

  // ── 02 CONSISTENCY (active days branch) ─────────────────────────
  // 3-day tier lives in Beginning as 'First Rhythm'.
  { id: 'steady',             title: 'Steady',             description: '7 active days',                                  category: 'consistency', rarity: 'common', criterion: { type: 'active_days', threshold: 7 } },
  { id: 'in-rhythm',          title: 'In Rhythm',          description: '14 active days',                                 category: 'consistency', rarity: 'rare',   criterion: { type: 'active_days', threshold: 14 } },
  { id: 'consistent',         title: 'Consistent',         description: '30 active days',                                category: 'consistency', rarity: 'rare',   criterion: { type: 'active_days', threshold: 30 } },
  { id: 'strong-rhythm',      title: 'Strong Rhythm',      description: '60 active days',                                category: 'consistency', rarity: 'epic',   criterion: { type: 'active_days', threshold: 60 } },
  { id: 'dedicated',          title: 'Dedicated',          description: '100 active days',                               category: 'consistency', rarity: 'epic',   criterion: { type: 'active_days', threshold: 100 } },
  { id: 'unshaken',           title: 'Unshaken',           description: '180 active days',                               category: 'consistency', rarity: 'legendary', criterion: { type: 'active_days', threshold: 180 } },
  { id: 'constant',           title: 'Constant',           description: '365 active days',                               category: 'consistency', rarity: 'legendary', criterion: { type: 'active_days', threshold: 365 } },

  // ── 02 CONSISTENCY (streak branch) ──────────────────────────────
  { id: 'first-streak',       title: 'First Streak',       description: '3-day streak',                                   category: 'consistency', rarity: 'common', criterion: { type: 'streak', threshold: 3 } },
  { id: 'keep-going',         title: 'Keep Going',         description: '7-day streak',                                   category: 'consistency', rarity: 'rare',   criterion: { type: 'streak', threshold: 7 } },
  { id: 'on-fire',            title: 'On Fire',            description: '14-day streak',                                  category: 'consistency', rarity: 'rare',   criterion: { type: 'streak', threshold: 14 } },
  { id: 'unstoppable-streak', title: 'Unstoppable',        description: '30-day streak',                                  category: 'consistency', rarity: 'epic',   criterion: { type: 'streak', threshold: 30 } },
  { id: 'iron-rhythm',        title: 'Iron Rhythm',        description: '60-day streak',                                  category: 'consistency', rarity: 'epic',   criterion: { type: 'streak', threshold: 60 } },
  { id: 'legendary-streak',   title: 'Legendary Streak',   description: '100-day streak',                                 category: 'consistency', rarity: 'legendary', criterion: { type: 'streak', threshold: 100 } },

  // ── 03 TASK MASTER (volume) ─────────────────────────────────────
  // Threshold 1 lives in Beginning as 'First Step'. Ladder starts at 10.
  { id: 'task-runner',        title: 'Task Runner',        description: 'Complete 10 tasks',                              category: 'task_master', rarity: 'common', criterion: { type: 'task_count', scope: 'all', threshold: 10 } },
  { id: 'task-handler',       title: 'Task Handler',       description: 'Complete 25 tasks',                              category: 'task_master', rarity: 'rare',   criterion: { type: 'task_count', scope: 'all', threshold: 25 } },
  { id: 'task-master',        title: 'Task Master',        description: 'Complete 50 tasks',                              category: 'task_master', rarity: 'rare',   criterion: { type: 'task_count', scope: 'all', threshold: 50 } },
  { id: 'task-crusher',       title: 'Task Crusher',       description: 'Complete 100 tasks',                             category: 'task_master', rarity: 'epic',   criterion: { type: 'task_count', scope: 'all', threshold: 100 } },
  { id: 'execution-mode',     title: 'Execution Mode',     description: 'Complete 250 tasks',                             category: 'task_master', rarity: 'epic',   criterion: { type: 'task_count', scope: 'all', threshold: 250 } },
  { id: 'task-veteran',       title: 'Task Veteran',       description: 'Complete 500 tasks',                             category: 'task_master', rarity: 'legendary', criterion: { type: 'task_count', scope: 'all', threshold: 500 } },
  { id: 'task-legend',        title: 'Task Legend',        description: 'Complete 1,000 tasks',                           category: 'task_master', rarity: 'legendary', criterion: { type: 'task_count', scope: 'all', threshold: 1000 } },

  // ── 03 TASK MASTER (priority — STUB) ────────────────────────────
  { id: 'priority-first',     title: 'Priority First',     description: 'Complete 10 high-priority tasks',                category: 'task_master', rarity: 'rare', criterion: null, status: 'stub' },
  { id: 'heavy-lifter',       title: 'Heavy Lifter',       description: 'Complete 25 high-priority tasks',                category: 'task_master', rarity: 'epic', criterion: null, status: 'stub' },
  { id: 'big-moves',          title: 'Big Moves',          description: 'Complete 100 high-priority tasks',               category: 'task_master', rarity: 'legendary', criterion: null, status: 'stub' },
  { id: 'mission-complete',   title: 'Mission Complete',   description: 'Complete 10 major / project-level tasks',        category: 'task_master', rarity: 'epic', criterion: null, status: 'stub' },

  // ── 04 FOCUSED (STUB — FocusSession model not wired) ────────────
  { id: 'locked-in',          title: 'Locked In',          description: 'Complete first Focus session',                   category: 'focused', rarity: 'common', criterion: null, status: 'stub' },
  { id: 'focused',            title: 'Focused',            description: '1 hour total focus time',                       category: 'focused', rarity: 'common', criterion: null, status: 'stub' },
  { id: 'deep-focus',         title: 'Deep Focus',         description: '5 hours total focus time',                      category: 'focused', rarity: 'rare',   criterion: null, status: 'stub' },
  { id: 'in-the-zone',        title: 'In The Zone',        description: '10 hours total focus time',                     category: 'focused', rarity: 'rare',   criterion: null, status: 'stub' },
  { id: 'flow-state',         title: 'Flow State',         description: '25 hours total focus time',                     category: 'focused', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'deep-worker',        title: 'Deep Worker',        description: '50 hours total focus time',                     category: 'focused', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'focus-master',       title: 'Focus Master',       description: '100 hours total focus time',                    category: 'focused', rarity: 'legendary', criterion: null, status: 'stub' },
  { id: 'mind-locked',        title: 'Mind Locked',        description: '250 hours total focus time',                    category: 'focused', rarity: 'legendary', criterion: null, status: 'stub' },
  { id: 'long-run',           title: 'Long Run',           description: 'Complete a 60-minute uninterrupted session',     category: 'focused', rarity: 'rare', criterion: null, status: 'stub' },
  { id: 'deep-dive',          title: 'Deep Dive',          description: 'Complete a 90-minute session',                  category: 'focused', rarity: 'epic', criterion: null, status: 'stub' },
  { id: 'marathon-mind',      title: 'Marathon Mind',      description: 'Complete a 2-hour session',                     category: 'focused', rarity: 'legendary', criterion: null, status: 'stub' },
  { id: 'no-distractions',    title: 'No Distractions',    description: 'Complete 10 sessions without manually ending',   category: 'focused', rarity: 'epic', criterion: null, status: 'stub' },

  // ── 05 COMMUNITY ────────────────────────────────────────────────
  { id: 'first-room',         title: 'First Room',         description: 'Join your first room',                           category: 'community', rarity: 'common', criterion: { type: 'room_joined', threshold: 1 } },
  { id: 'team-player',        title: 'Team Player',        description: 'Complete a task in a room',                      category: 'community', rarity: 'common', criterion: { type: 'room_task_count', threshold: 1 } },
  { id: 'good-company',       title: 'Good Company',       description: 'Complete 10 collaborative tasks',                category: 'community', rarity: 'rare',   criterion: { type: 'room_task_count', threshold: 10 } },
  { id: 'contributor',        title: 'Contributor',        description: 'Contribute to 25 room activities',               category: 'community', rarity: 'rare',   criterion: { type: 'room_task_count', threshold: 25 } },
  { id: 'reliable-one',       title: 'Reliable One',       description: 'Complete 50 collaborative tasks',                category: 'community', rarity: 'epic',   criterion: { type: 'room_task_count', threshold: 50 } },
  { id: 'core-member',        title: 'Core Member',        description: 'Complete a task in the same room on 30 different days', category: 'community', rarity: 'epic', criterion: null, status: 'stub' },
  { id: 'team-builder',       title: 'Team Builder',       description: 'Help complete 100 room tasks',                   category: 'community', rarity: 'legendary', criterion: { type: 'room_task_count', threshold: 100 } },
  { id: 'community-pillar',   title: 'Community Pillar',   description: 'Complete 100 room tasks and 100 room chat messages', category: 'community', rarity: 'legendary', criterion: null, status: 'stub' },
  { id: 'room-creator',       title: 'Room Creator',       description: 'Create your first room',                         category: 'community', rarity: 'common', criterion: { type: 'room_created', threshold: 1 } },
  { id: 'gathering-point',    title: 'Gathering Point',    description: 'Create 5 rooms',                                 category: 'community', rarity: 'rare',   criterion: { type: 'room_created', threshold: 5 } },
  { id: 'shared-momentum',    title: 'Shared Momentum',    description: 'Be in a room that completes 50 tasks together',  category: 'community', rarity: 'epic',   criterion: null, status: 'stub' },

  // ── 06 COMMUNICATION ────────────────────────────────────────────
  { id: 'first-connection',   title: 'First Connection',   description: 'Send or receive your first direct message',      category: 'communication', rarity: 'common', criterion: { type: 'dm_count', threshold: 1 } },
  { id: 'open-channel',       title: 'Open Channel',       description: 'Send or receive 5 direct messages',              category: 'communication', rarity: 'common', criterion: { type: 'dm_count', threshold: 5 } },
  { id: 'good-communicator',  title: 'Good Communicator',  description: 'Send or receive 25 direct messages',             category: 'communication', rarity: 'rare',   criterion: { type: 'dm_count', threshold: 25 } },
  { id: 'clear-signal',       title: 'Clear Signal',       description: 'Send 25 room chat messages',                     category: 'communication', rarity: 'rare',   criterion: { type: 'chat_messages', threshold: 25 } },
  { id: 'always-in-sync',     title: 'Always In Sync',     description: 'Send or receive 100 direct messages',           category: 'communication', rarity: 'epic',   criterion: { type: 'dm_count', threshold: 100 } },
  { id: 'connected',          title: 'Connected',          description: 'Maintain collaboration across 10 rooms',        category: 'communication', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'krios-connector',    title: 'Krios Connector',    description: 'Become a consistent contributor across rooms',   category: 'communication', rarity: 'legendary', criterion: null, status: 'stub' },

  // ── 07 GROWTH (STUB — comparison vs prior period not wired) ─────
  { id: 'first-rise',         title: 'First Rise',         description: 'Improve your completion rate over previous period', category: 'growth', rarity: 'rare',   criterion: null, status: 'stub' },
  { id: 'moving-forward',     title: 'Moving Forward',     description: 'Improve for 2 consecutive weeks',                    category: 'growth', rarity: 'rare',   criterion: null, status: 'stub' },
  { id: 'momentum',           title: 'Momentum',           description: 'Maintain positive progress for 30 days',             category: 'growth', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'leveling-up',        title: 'Leveling Up',        description: 'Beat your previous personal best',                   category: 'growth', rarity: 'rare',   criterion: null, status: 'stub' },
  { id: 'breakthrough',       title: 'Breakthrough',       description: 'Set and beat 3 personal records',                    category: 'growth', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'momentum-builder',   title: 'Momentum Builder',   description: 'Improve across 3 consecutive months',                category: 'growth', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'transformed',        title: 'Transformed',        description: 'Sustain measurable improvement for 6 months',        category: 'growth', rarity: 'legendary', criterion: null, status: 'stub' },
  { id: 'evolving',           title: 'Evolving',           description: 'Demonstrate long-term improvement across metrics',   category: 'growth', rarity: 'legendary', criterion: null, status: 'stub' },

  // ── 08 LEARNING (STUB — bucket field exists but not seeded) ─────
  { id: 'curious-mind',       title: 'Curious Mind',       description: 'Complete first learning task',                       category: 'learning', rarity: 'common', criterion: null, status: 'stub' },
  { id: 'first-lesson',       title: 'First Lesson',       description: 'Complete 5 learning tasks',                          category: 'learning', rarity: 'common', criterion: null, status: 'stub' },
  { id: 'learner',            title: 'Learner',            description: 'Complete 25 learning tasks',                         category: 'learning', rarity: 'rare',   criterion: null, status: 'stub' },
  { id: 'knowledge-builder',  title: 'Knowledge Builder',  description: 'Complete 50 learning tasks',                         category: 'learning', rarity: 'rare',   criterion: null, status: 'stub' },
  { id: 'study-rhythm',       title: 'Study Rhythm',       description: 'Learn consistently for 14 days',                     category: 'learning', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'dedicated-learner',  title: 'Dedicated Learner',  description: 'Learn consistently for 30 days',                    category: 'learning', rarity: 'epic',   criterion: null, status: 'stub' },
  { id: 'knowledge-seeker',   title: 'Knowledge Seeker',   description: 'Complete 100 learning tasks',                        category: 'learning', rarity: 'legendary', criterion: null, status: 'stub' },
  { id: 'lifelong-learner',   title: 'Lifelong Learner',   description: 'Maintain learning activity for 6 months',            category: 'learning', rarity: 'legendary', criterion: null, status: 'stub' },

  // ── 09 LEGENDARY ───────────────────────────────────────────────
  // Trimmed: breadth thresholds capped at what live categories can
  // award (6 today); vague "ultimate" ultimates folded into
  // 'complete-journey'.
  { id: 'rising-star',        title: 'Rising Star',        description: 'Earn trophies across 3 categories',              category: 'legendary', rarity: 'rare',       criterion: { type: 'category_breadth', threshold: 3 } },
  { id: 'multi-talented',     title: 'Multi-Talented',     description: 'Earn trophies across 5 categories',              category: 'legendary', rarity: 'epic',       criterion: { type: 'category_breadth', threshold: 5 } },
  { id: 'complete-journey',   title: 'The Complete Journey', description: 'Unlock every non-legendary trophy',            category: 'legendary', rarity: 'legendary', criterion: { type: 'all_non_legendary_unlocked' } },
];

const byId = new Map(TROPHIES.map((t) => [t.id, t]));

function getTrophy(id) {
  return byId.get(id) || null;
}

function listTrophies({ includeStubs = true } = {}) {
  return includeStubs ? TROPHIES : TROPHIES.filter((t) => t.criterion);
}

function groupByCategory(trophies = TROPHIES) {
  const groups = new Map();
  for (const cat of Object.values(CATEGORIES)) {
    groups.set(cat.id, { ...cat, trophies: [] });
  }
  for (const trophy of trophies) {
    const group = groups.get(trophy.category);
    if (group) group.trophies.push(trophy);
  }
  return [...groups.values()].filter((g) => g.trophies.length > 0);
}

module.exports = {
  CATEGORIES,
  RARITY,
  TROPHIES,
  getTrophy,
  listTrophies,
  groupByCategory,
};