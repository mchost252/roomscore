import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalTask } from './taskService';
import { getTaskStatus } from '../utils/taskStatusConfig';

/**
 * Smart Notification Service
 * 
 * Handles intelligent, adaptive notifications for tasks:
 * - Morning digest (8am)
 * - Due task reminders (every 2 hours if overdue)
 * - Evening preview (8pm)
 * - Adaptive timing based on user's active hours
 */

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<any> => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationPreferences {
  morningDigestTime: number; // hour (0-23)
  eveningPreviewTime: number; // hour (0-23)
  dueReminderInterval: number; // minutes
  enabled: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  morningDigestTime: 8, // 8am
  eveningPreviewTime: 20, // 8pm
  dueReminderInterval: 120, // 2 hours
  enabled: true,
};

class NotificationService {
  private preferences: NotificationPreferences = DEFAULT_PREFERENCES;

  async initialize() {
    // Notifications only work on native platforms
    if (Platform.OS === 'web') {
      console.log('Notifications not supported on web');
      return false;
    }
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Load preferences
    const stored = await AsyncStorage.getItem('notificationPreferences');
    if (stored) {
      this.preferences = JSON.parse(stored);
    }

    // Set up notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('task-reminders', {
        name: 'Task Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
      });
    }

    return true;
  }

  async updatePreferences(prefs: Partial<NotificationPreferences>) {
    this.preferences = { ...this.preferences, ...prefs };
    await AsyncStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
  }

  /**
   * Schedule morning digest notification
   * "Good morning! You have 3 ongoing tasks today"
   */
  async scheduleMorningDigest(tasks: PersonalTask[]) { return; // disabled for now
    if (Platform.OS === 'web' || !this.preferences.enabled) return;

    const ongoingCount = tasks.filter(t => 
      !t.isCompleted && getTaskStatus(t.dueDate ? new Date(t.dueDate) : null) === 'ongoing'
    ).length;

    if (ongoingCount === 0) return;

    const trigger = new Date();
    trigger.setHours(this.preferences.morningDigestTime, 0, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Good morning! ☀️',
        body: `You have ${ongoingCount} task${ongoingCount > 1 ? 's' : ''} to focus on today`,
        data: { type: 'morning-digest' },
        badge: ongoingCount,
      },
      trigger: { date: trigger } as any,
      identifier: 'morning-digest',
    });
  }

  /**
   * Schedule evening preview notification
   * "Tomorrow you have 5 tasks scheduled"
   */
  async scheduleEveningPreview(tasks: PersonalTask[]) { return; // disabled for now
    if (Platform.OS === 'web' || !this.preferences.enabled) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const upcomingCount = tasks.filter(t => {
      if (!t.dueDate || t.isCompleted) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate.getDate() === tomorrow.getDate() &&
             dueDate.getMonth() === tomorrow.getMonth() &&
             dueDate.getFullYear() === tomorrow.getFullYear();
    }).length;

    if (upcomingCount === 0) return;

    const trigger = new Date();
    trigger.setHours(this.preferences.eveningPreviewTime, 0, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Tomorrow\'s Preview 📅',
        body: `You have ${upcomingCount} task${upcomingCount > 1 ? 's' : ''} scheduled for tomorrow`,
        data: { type: 'evening-preview' },
      },
      trigger: { date: trigger } as any,
      identifier: 'evening-preview',
    });
  }

  /**
   * Schedule reminders for overdue tasks
   * Repeats every 2 hours until completed
   */
  async scheduleDueReminders(tasks: PersonalTask[]) {
    if (Platform.OS === 'web' || !this.preferences.enabled) return;

    const dueTasks = tasks.filter(t => 
      !t.isCompleted && getTaskStatus(t.dueDate ? new Date(t.dueDate) : null) === 'due'
    );

    if (dueTasks.length === 0) return;

    // Cancel existing due reminders - cancel each individually
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const dueReminderIds = scheduled
      .filter(n => n.identifier.startsWith('due-reminder-'))
      .map(n => n.identifier);
    
    // Cancel each notification individually
    for (const id of dueReminderIds) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (e) {
        console.warn('Failed to cancel notification:', id);
      }
    }

    // Schedule new reminders
    for (const task of dueTasks) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Overdue Task',
          body: task.title,
          data: { type: 'due-reminder', taskId: task.id },
        },
        trigger: {
          seconds: this.preferences.dueReminderInterval * 60,
          repeats: true,
        } as any,
        identifier: `due-reminder-${task.id}`,
      });
    }
  }

  /**
   * Smart scheduler - analyzes user's active hours and optimizes notification timing
   */
  async scheduleSmartNotifications(tasks: PersonalTask[]) {
    await this.scheduleMorningDigest(tasks);
    await this.scheduleEveningPreview(tasks);
    await this.scheduleDueReminders(tasks);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAll() {
    if (Platform.OS === 'web') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get currently scheduled notifications (for debugging)
   */
  async getScheduled() {
    if (Platform.OS === 'web') return [];
    return await Notifications.getAllScheduledNotificationsAsync();
  }
}

export default new NotificationService();
