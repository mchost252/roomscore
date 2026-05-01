/**
 * Room Detail Components — barrel export
 */
// New architecture components
export { default as RoomHeader } from './RoomHeader';
export { default as RoomCalendar } from './RoomCalendar';
export { default as RoomPulse } from './RoomPulse';
export { default as TaskCard } from './TaskCard';
export { default as TaskSection } from './TaskSection';

// Shared / utility components
export { default as AvatarStack } from './AvatarStack';

// Legacy components (still used by modals and sheets)
export { default as AbsoluteHeader, ROOM_HEADER_HEIGHT } from './AbsoluteHeader';
export { default as CalendarStrip } from './CalendarStrip';
export { default as StatsGrid } from './StatsGrid';
export { default as TaskFolder } from './TaskFolder';
export { default as TaskOptionsSheet } from './TaskOptionsSheet';
export { default as MemberHUDModal } from './MemberHUDModal';
