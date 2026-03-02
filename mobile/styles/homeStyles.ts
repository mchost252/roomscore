import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const styles = StyleSheet.create({
  // Container & Layout
  container: { flex: 1 },
  content: { flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : 44 },
  dimOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 200 },

  // Glow Orbs
  glowOrb1: { position: 'absolute', top: -100, right: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(124, 58, 237, 0.15)' },
  glowOrb1Dark: { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
  glowOrb2: { position: 'absolute', bottom: 100, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(168, 85, 247, 0.12)' },
  glowOrb2Dark: { backgroundColor: 'rgba(168, 85, 247, 0.18)' },
  glowOrb3: { position: 'absolute', bottom: -80, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(20, 184, 166, 0.12)' },
  glowOrb3Dark: { backgroundColor: 'rgba(20, 184, 166, 0.18)' },

  // Header & Greeting
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  greeting: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  userName: { fontSize: 16, fontWeight: '700', marginTop: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  greetingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greetingLogo: { width: 22, height: 22, borderRadius: 6 },
  leadLine: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  // Mood Chips
  moodChipsContainer: { marginBottom: 16, paddingHorizontal: 20 },
  moodChipsContent: { flexDirection: 'row', gap: 8 },
  moodChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, gap: 6 },
  moodChipText: { fontSize: 13, fontWeight: '600' },

  // Calendar Section
  calendarSection: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calendarHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  calendarMonth: { fontSize: 16, fontWeight: '700' },
  calendarTaskBadges: { flexDirection: 'row', gap: 8 },
  taskBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  taskBadgeText: { fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dayLabel: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dayNumber: { fontSize: 14, fontWeight: '500' },
  todayText: { fontWeight: '700' },
  dateDots: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },
  calendarFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40 },

  // Up Next Preview
  upNextContainer: { marginHorizontal: 20, marginBottom: 12, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center' },
  upNextLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  upNextDot: { width: 10, height: 10, borderRadius: 5 },
  upNextLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  upNextTitle: { fontSize: 15, fontWeight: '600' },
  upNextRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upNextTime: { fontSize: 12 },
  upNextBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  upNextBadgeText: { fontSize: 11, fontWeight: '700' },

  // Prompt Chips
  promptContainer: { paddingHorizontal: 20, marginBottom: 12 },
  promptChipsContent: { flexDirection: 'row', gap: 8 },
  promptChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  promptChipText: { fontSize: 13, fontWeight: '500' },

  // Messages
  messagesContainer: { flex: 1, marginHorizontal: 20, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  messagesContent: { padding: 16 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, marginBottom: 12 },
  userMessage: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  aiMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 4 },
  aiLogoImage: { width: 20, height: 20 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTimestamp: { fontSize: 11, marginTop: 4, opacity: 0.6 },

  // Suggestion Cards
  suggestionCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8, marginBottom: 12 },
  suggestionBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  suggestionBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  suggestionMeta: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  suggestionPriority: { fontSize: 12, fontWeight: '600' },
  suggestionReason: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  suggestionActions: { flexDirection: 'row', gap: 8 },
  suggestionAcceptBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  suggestionAdjustBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  suggestionSkipBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },

  // Typing Indicator
  typingIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  typingDots: { flexDirection: 'row', gap: 4 },
  typingDot: { width: 8, height: 8, borderRadius: 4 },

  // Input Area
  inputContainer: { marginHorizontal: 20, marginTop: 12, borderRadius: 24, borderWidth: 1, padding: 4 },
  input: { flex: 1, fontSize: 15, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 100 },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  // Tasks Content
  tasksContent: { flex: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, overflow: 'visible' },
  tasksTabs: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 12 },
  tasksTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tasksTabText: { fontSize: 13, fontWeight: '600' },
  tasksListView: { flex: 1 },
  tasksList: { flex: 1, paddingTop: 8 },

  // Task Cards
  taskCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1 },
  taskContent: { flex: 1 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskTitle: { fontSize: 15, fontWeight: '600' },
  taskSubtitle: { fontSize: 12, marginTop: 4 },
  taskActions: { flexDirection: 'row', gap: 8 },
  taskActionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  taskPriorityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  taskProgressBg: { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  taskProgressFill: { height: '100%', borderRadius: 2 },

  // Task Inline Actions
  taskExpandedSection: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  taskInlineButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  taskInlineButtonText: { fontSize: 12, fontWeight: '600' },
  snoozeOptions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  snoozeOption: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  snoozeOptionText: { fontSize: 11, fontWeight: '500' },

  // Filter Panel
  filterPanelInline: { alignSelf: 'center', marginTop: 8, marginBottom: 4, borderRadius: 20, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  filterButtons: { flexDirection: 'row', gap: 8 },
  filterButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  filterButtonText: { fontSize: 12, fontWeight: '600' },

  // Focus Mode
  focusMode: { padding: 20 },
  focusGradient: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  focusIconContainer: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  focusTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  focusSubtitle: { fontSize: 13, marginBottom: 16 },
  focusTimerContainer: { marginBottom: 16 },
  focusTimer: { fontSize: 48, fontWeight: '700' },
  focusTimerButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  focusTimerButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  focusStartButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, gap: 8 },
  focusStartText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  focusStatsCard: { flexDirection: 'row', width: '100%', padding: 16, borderRadius: 16, borderWidth: 1 },
  focusStat: { flex: 1, alignItems: 'center' },
  focusStatDivider: { width: 1 },
  focusStatValue: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  focusStatLabel: { fontSize: 11 },
  focusedTaskHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'center', marginBottom: 12 },
  focusedTaskLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  focusedTaskTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  focusedTaskMeta: { fontSize: 12, textAlign: 'center', marginBottom: 12 },
  focusingOnText: { fontSize: 12, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },

  // Tasks Toolbar
  tasksToolbar: { marginHorizontal: 20, marginBottom: 12, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1 },
  tasksToolbarInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingVertical: 2, gap: 8 },
  toolbarKButton: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  toolbarKGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  toolbarKLogo: { width: 24, height: 24 },
  toolbarSearch: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  toolbarSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  toolbarButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  toolbarAddButton: { width: 44, height: 44, borderRadius: 22 },
  toolbarFilterButton: { width: 'auto', height: 36, borderRadius: 18, flexDirection: 'row', paddingHorizontal: 12, gap: 6 },
  toolbarFilterButtonActive: { backgroundColor: 'rgba(99, 102, 241, 0.15)' },
  toolbarFilterText: { fontSize: 12, fontWeight: '600' },
  filterBadge: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyStateText: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  emptyStateSubtext: { fontSize: 14, textAlign: 'center' },

  // Task Modal (Bottom Sheet)
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 1000 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  taskModalSheet: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10, maxHeight: '85%' },
  modalHandleBar: { alignItems: 'center', paddingVertical: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2 },
  modalCloseButton: { padding: 4 },
  taskModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  taskModalTitle: { fontSize: 22, fontWeight: '700' },
  taskModalInput: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, marginBottom: 16 },
  descriptionInput: { height: 80, paddingTop: 12, paddingBottom: 12 },

  // Bucket Chips
  bucketChipsContainer: { marginBottom: 16 },
  bucketLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  bucketChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bucketChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, gap: 6 },
  bucketChipText: { fontSize: 13, fontWeight: '600' },

  // More Options
  moreOptionsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 4 },
  moreOptionsText: { fontSize: 14, fontWeight: '600' },
  moreOptionsContainer: { marginTop: 8 },
  modalSection: { marginBottom: 16 },
  modalSectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  priorityButtons: { flexDirection: 'row', gap: 10 },
  priorityButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityButtonText: { fontSize: 13, fontWeight: '600' },
  taskModalButton: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  taskModalButtonText: { fontSize: 16, fontWeight: '700' },

  // Toast Notification
  toast: { position: 'absolute', bottom: 100, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, zIndex: 2000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  toastContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  toastText: { flex: 1, fontSize: 14, fontWeight: '600' },
  toastUndoButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toastUndoText: { fontSize: 13, fontWeight: '700' },
  toastDismiss: { padding: 4 },

  // Navigation Menus
  navMenuOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 300 },
  drawerBackdrop: { ...StyleSheet.absoluteFillObject },
  navMenuContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingHorizontal: 20 },
  navMenuHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  navMenuTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  navMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  navMenuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  navMenuLabel: { flex: 1, fontSize: 16, fontWeight: '600' },

  // Circular Navigation
  circularNavWrapper: { position: 'absolute', bottom: 100, left: '50%', marginLeft: -35, zIndex: 300 },
  circularNavContainer: { width: 70, height: 70, position: 'relative' },
  circularNavItem: { position: 'absolute', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  circularNavLabel: { position: 'absolute', bottom: -20, fontSize: 11, fontWeight: '600' },

  // Duration Picker
  durationPicker: { flexDirection: 'row', gap: 8, marginTop: 12 },
  durationOption: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  durationText: { fontSize: 13, fontWeight: '600' },

  // Focus Tasks
  focusTasksList: { marginTop: 12, marginBottom: 16 },
  focusTasksHeader: { fontSize: 13, fontWeight: '700', marginBottom: 10, paddingHorizontal: 20 },
  focusTaskItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginHorizontal: 20, marginBottom: 10, borderWidth: 1 },
  focusTaskRank: { fontSize: 20, fontWeight: '700' },

  // Why Tooltip
  whyButton: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  whyTooltip: { position: 'absolute', bottom: 30, right: 0, width: 200, padding: 12, borderRadius: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, zIndex: 100 },
  whyTooltipText: { fontSize: 12, lineHeight: 18 },
});
