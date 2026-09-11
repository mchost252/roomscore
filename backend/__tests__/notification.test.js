jest.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../socket/io', () => ({ getIO: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { prisma } = require('../config/database');
const NotificationService = require('../services/notificationService');
const {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  buildNotificationDedupeKey,
  getNotificationMetadata,
} = require('../utils/notificationContract');

describe('notification delivery policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses stable metadata and dedupe keys for canonical events', () => {
    expect(getNotificationMetadata(NOTIFICATION_TYPES.DIRECT_MESSAGE)).toEqual({
      category: NOTIFICATION_CATEGORIES.MESSAGES,
      priority: 'high',
    });
    expect(buildNotificationDedupeKey({
      type: NOTIFICATION_TYPES.REACTION_RECEIVED,
      recipientId: 'user-1',
      entityId: 'message-1',
      occurrence: 'event-1',
    })).toBe('reaction_received:user-1:message-1:event-1');
  });

  test('merges stored preferences with safe defaults', () => {
    const preferences = NotificationService.parsePreferences(JSON.stringify({
      enabled: false,
      categories: { messages: false },
      quietHours: { enabled: true, start: '23:00' },
    }));

    expect(preferences.enabled).toBe(false);
    expect(preferences.categories.messages).toBe(false);
    expect(preferences.categories.rooms).toBe(true);
    expect(preferences.quietHours).toEqual({
      enabled: true,
      start: '23:00',
      end: '07:00',
      timezone: 'UTC',
    });
  });

  test('handles quiet hours that cross midnight', () => {
    const preferences = {
      quietHours: { enabled: true, start: '22:00', end: '07:00', timezone: 'UTC' },
    };

    expect(NotificationService.isWithinQuietHours(preferences, new Date('2026-09-11T23:30:00Z'))).toBe(true);
    expect(NotificationService.isWithinQuietHours(preferences, new Date('2026-09-11T06:30:00Z'))).toBe(true);
    expect(NotificationService.isWithinQuietHours(preferences, new Date('2026-09-11T12:00:00Z'))).toBe(false);
  });

  test('blocks disabled categories and quiet-hour push delivery', async () => {
    prisma.user.findUnique.mockResolvedValue({
      notificationPreferences: JSON.stringify({
        enabled: true,
        categories: { messages: false },
        quietHours: { enabled: true, start: '00:00', end: '23:59', timezone: 'UTC' },
      }),
    });

    await expect(
      NotificationService.shouldDeliver('user-1', NOTIFICATION_TYPES.DIRECT_MESSAGE, 'realtime'),
    ).resolves.toBe(false);
    await expect(
      NotificationService.shouldDeliver('user-1', NOTIFICATION_TYPES.SYSTEM, 'push'),
    ).resolves.toBe(false);
  });

  test('allows enabled realtime delivery during quiet hours', async () => {
    prisma.user.findUnique.mockResolvedValue({
      notificationPreferences: JSON.stringify({
        enabled: true,
        quietHours: { enabled: true, start: '00:00', end: '23:59', timezone: 'UTC' },
      }),
    });

    await expect(
      NotificationService.shouldDeliver('user-1', NOTIFICATION_TYPES.SYSTEM, 'realtime'),
    ).resolves.toBe(true);
  });
});
