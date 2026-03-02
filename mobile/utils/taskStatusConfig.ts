/**
 * Task Status Configuration
 * 
 * Defines how tasks are categorized as Ongoing, Upcoming, or Due.
 * You can easily modify this logic in the future without touching the main app code.
 */

export interface TaskStatusConfig {
  ongoing: (dueDate: Date | null, today: Date) => boolean;
  upcoming: (dueDate: Date | null, today: Date) => boolean;
  due: (dueDate: Date | null, today: Date) => boolean;
}

const isSameDay = (a: Date, b: Date): boolean => {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
};

const isAfter = (date: Date, compareDate: Date): boolean => {
  return date.getTime() > compareDate.getTime();
};

const isBefore = (date: Date, compareDate: Date): boolean => {
  return date.getTime() < compareDate.getTime();
};

/**
 * Default Task Status Logic
 * - Ongoing: Due date is TODAY
 * - Upcoming: Due date is TOMORROW or later (future)
 * - Due: Due date is in the PAST (overdue)
 */
export const defaultTaskStatusConfig: TaskStatusConfig = {
  ongoing: (dueDate, today) => {
    if (!dueDate) return false;
    return isSameDay(dueDate, today);
  },
  
  upcoming: (dueDate, today) => {
    if (!dueDate) return false;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dueDateMidnight = new Date(dueDate);
    dueDateMidnight.setHours(0, 0, 0, 0);
    
    return dueDateMidnight >= tomorrow;
  },
  
  due: (dueDate, today) => {
    if (!dueDate) return false;
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    
    const dueDateMidnight = new Date(dueDate);
    dueDateMidnight.setHours(0, 0, 0, 0);
    
    return dueDateMidnight < todayMidnight;
  },
};

/**
 * Get task status badge info
 */
export type TaskStatus = 'ongoing' | 'upcoming' | 'due' | null;

export function getTaskStatus(
  dueDate: Date | null,
  config: TaskStatusConfig = defaultTaskStatusConfig
): TaskStatus {
  const today = new Date();
  
  if (config.due(dueDate, today)) return 'due';
  if (config.ongoing(dueDate, today)) return 'ongoing';
  if (config.upcoming(dueDate, today)) return 'upcoming';
  
  return null;
}

export const taskStatusColors = {
  ongoing: {
    bg: '#3b82f6',
    text: '#ffffff',
    label: 'Ongoing',
    icon: 'play-circle' as const,
  },
  upcoming: {
    bg: '#8b5cf6',
    text: '#ffffff',
    label: 'Upcoming',
    icon: 'time' as const,
  },
  due: {
    bg: '#ef4444',
    text: '#ffffff',
    label: 'Due',
    icon: 'alert-circle' as const,
  },
};
