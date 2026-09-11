import React, { useMemo, useState } from 'react';
import {
  Modal,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { RoomDetail, RoomMember, Task } from '../../types/room';

interface RoomOnboardingModalProps {
  visible: boolean;
  room?: RoomDetail | null;
  members: RoomMember[];
  tasks: Task[];
  currentUserId?: string;
  onComplete: (selectedTaskIds: string[]) => void;
  onSkip?: () => void;
}

const STEPS = [
  { label: 'Welcome', icon: 'sparkles-outline' as const },
  { label: 'People', icon: 'people-outline' as const },
  { label: 'Focus', icon: 'compass-outline' as const },
  { label: 'Missions', icon: 'checkmark-done-outline' as const },
  { label: 'Ready', icon: 'flag-outline' as const },
];

export default function RoomOnboardingModal({
  visible,
  room,
  members,
  tasks,
  currentUserId,
  onComplete,
  onSkip,
}: RoomOnboardingModalProps) {
  const { colors, isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [roomImageFailed, setRoomImageFailed] = useState(false);

  const activeMembers = useMemo(() => members.filter(member => member.isOnline).length, [members]);
  const visibleMembers = useMemo(
    () => members.filter(member => member.userId !== currentUserId).slice(0, 4),
    [members, currentUserId],
  );
  const selectedCount = selectedIds.size;
  const cardBg = isDark ? '#11111f' : '#ffffff';
  const panelBg = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(99,102,241,0.055)';
  const muted = isDark ? 'rgba(255,255,255,0.58)' : 'rgba(15,23,42,0.58)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';

  const toggleTask = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finish = () => {
    onComplete(Array.from(selectedIds));
    setStep(0);
    setSelectedIds(new Set());
  };

  const skip = () => {
    onSkip?.();
    setStep(0);
    setSelectedIds(new Set());
  };

  const next = () => {
    if (step === STEPS.length - 1) {
      finish();
      return;
    }
    setStep(current => current + 1);
  };

  const back = () => setStep(current => Math.max(0, current - 1));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={skip}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={skip} />
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.topRow}>
            <Text style={[styles.stepCount, { color: muted }]}>Step {step + 1} of {STEPS.length}</Text>
            <TouchableOpacity onPress={skip} hitSlop={12} accessibilityLabel="Skip room introduction">
              <Ionicons name="close" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: panelBg }]}>
            <View style={[styles.progress, { backgroundColor: colors.primary, width: `${((step + 1) / STEPS.length) * 100}%` }]} />
          </View>

          <View style={styles.stepper}>
            {STEPS.map((item, index) => (
              <View key={item.label} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  { backgroundColor: index <= step ? colors.primary : panelBg, borderColor: index <= step ? colors.primary : border },
                ]}>
                  <Ionicons name={item.icon} size={13} color={index <= step ? '#fff' : muted} />
                </View>
                <Text style={[styles.stepLabel, { color: index === step ? colors.text : muted }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {step === 0 && (
              <View>
                <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}20` }]}>
                  {room?.roomDp && !roomImageFailed ? (
                    <Image
                      source={{ uri: room.roomDp }}
                      style={styles.roomImage}
                      resizeMode="cover"
                      onError={() => setRoomImageFailed(true)}
                      accessibilityLabel={`${room.name || 'Room'} display picture`}
                    />
                  ) : (
                    <Ionicons name="infinite-outline" size={44} color={colors.primary} />
                  )}
                </View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>WELCOME TO YOUR ROOM</Text>
                <Text style={[styles.title, { color: colors.text }]}>
                  Find your rhythm{'\n'}with {room?.name || 'your community'}.
                </Text>
                <Text style={[styles.description, { color: muted }]}>
                  This room is a shared space for small wins, steady progress, and accountability that feels supportive.
                </Text>
                <View style={styles.statsRow}>
                  <Stat icon="people-outline" value={String(members.length)} label="Members" color={colors.primary} panelBg={panelBg} text={colors.text} muted={muted} />
                  <Stat icon="flash-outline" value={String(tasks.length)} label="Missions" color="#f59e0b" panelBg={panelBg} text={colors.text} muted={muted} />
                  <Stat icon="pulse-outline" value={String(activeMembers)} label="Online" color="#22c55e" panelBg={panelBg} text={colors.text} muted={muted} />
                </View>
              </View>
            )}

            {step === 1 && (
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>MEET THE ROOM</Text>
                <Text style={[styles.title, { color: colors.text }]}>You are not doing this alone.</Text>
                <Text style={[styles.description, { color: muted }]}>
                  See who is active, celebrate their progress, and contribute at your own pace.
                </Text>
                <View style={styles.memberList}>
                  {visibleMembers.map(member => (
                    <View key={member.id} style={[styles.memberRow, { backgroundColor: panelBg, borderColor: border }]}>
                      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.avatarText}>{member.username.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <View style={styles.memberText}>
                        <Text style={[styles.memberName, { color: colors.text }]}>{member.username}</Text>
                        <Text style={[styles.memberMeta, { color: muted }]}>{member.isOnline ? 'Active now' : 'Ready when you are'}</Text>
                      </View>
                      <Ionicons name={member.isOnline ? 'radio-button-on' : 'radio-button-off'} size={16} color={member.isOnline ? '#22c55e' : muted} />
                    </View>
                  ))}
                  {members.length > visibleMembers.length + (currentUserId ? 1 : 0) && (
                    <Text style={[styles.moreText, { color: muted }]}>
                      + {members.length - visibleMembers.length - (currentUserId ? 1 : 0)} more members
                    </Text>
                  )}
                </View>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>CHOOSE YOUR APPROACH</Text>
                <Text style={[styles.title, { color: colors.text }]}>Start small. Stay consistent.</Text>
                <Text style={[styles.description, { color: muted }]}>
                  You can join missions now or look around first. There is no pressure to select everything.
                </Text>
                {[
                  ['flash-outline', 'Pick one clear win', 'A focused start makes progress easier to see.'],
                  ['chatbubble-ellipses-outline', 'Use the room thread', 'Share context, encouragement, or proof when you need it.'],
                  ['time-outline', 'Build your own pace', 'Daily, custom, and one-time missions fit different routines.'],
                ].map(([icon, heading, detail]) => (
                  <View key={heading} style={[styles.infoRow, { backgroundColor: panelBg, borderColor: border }]}>
                    <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.primary} />
                    <View style={styles.memberText}>
                      <Text style={[styles.memberName, { color: colors.text }]}>{heading}</Text>
                      <Text style={[styles.memberMeta, { color: muted }]}>{detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>RECOMMENDED START</Text>
                <Text style={[styles.title, { color: colors.text }]}>Which missions are yours?</Text>
                <Text style={[styles.description, { color: muted }]}>
                  Select any missions you want to work on. You can change this later.
                </Text>
                {tasks.length === 0 ? (
                  <View style={[styles.empty, { backgroundColor: panelBg }]}>
                    <Ionicons name="document-text-outline" size={28} color={muted} />
                    <Text style={[styles.memberMeta, { color: muted }]}>No active missions yet. You can enter and explore.</Text>
                  </View>
                ) : tasks.map(task => {
                  const selected = selectedIds.has(task.id);
                  return (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => toggleTask(task.id)}
                      activeOpacity={0.75}
                      style={[styles.taskRow, { backgroundColor: selected ? `${colors.primary}18` : panelBg, borderColor: selected ? colors.primary : border }]}
                    >
                      <View style={[styles.checkbox, { backgroundColor: selected ? colors.primary : 'transparent', borderColor: selected ? colors.primary : border }]}>
                        {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
                      </View>
                      <View style={styles.memberText}>
                        <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{task.title}</Text>
                        <Text style={[styles.memberMeta, { color: muted }]}>{task.points} points · {(task.taskType || 'daily').toUpperCase()}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {step === 4 && (
              <View style={styles.ready}>
                <View style={[styles.readyIcon, { backgroundColor: `${colors.primary}22` }]}>
                  <Ionicons name="checkmark" size={46} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>You are ready.</Text>
                <Text style={[styles.description, { color: muted, textAlign: 'center' }]}>
                  {selectedCount > 0 ? `You selected ${selectedCount} ${selectedCount === 1 ? 'mission' : 'missions'} to start with.` : 'You are entering as a spectator for now.'}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 && (
              <TouchableOpacity onPress={back} style={[styles.backButton, { borderColor: border }]} activeOpacity={0.75}>
                <Ionicons name="arrow-back" size={18} color={colors.text} />
                <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={next} style={[styles.primaryButton, { backgroundColor: colors.primary }]} activeOpacity={0.82}>
              <Text style={styles.primaryText}>{step === STEPS.length - 1 ? 'Enter room' : 'Continue'}</Text>
              <Ionicons name={step === STEPS.length - 1 ? 'arrow-forward' : 'chevron-forward'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.footerHint, { color: muted }]}>You can revisit your mission choices anytime.</Text>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ icon, value, label, color, panelBg, text, muted }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; color: string; panelBg: string; text: string; muted: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: panelBg }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color: text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 18 },
  card: { maxHeight: '92%', borderRadius: 26, borderWidth: 1, overflow: 'hidden', elevation: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 18 },
  stepCount: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  progressTrack: { height: 4, borderRadius: 2, marginHorizontal: 22, marginTop: 12, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 2 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  stepItem: { alignItems: 'center', width: '19%' },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 9, fontWeight: '700', marginTop: 5 },
  body: { paddingHorizontal: 22 },
  bodyContent: { paddingTop: 12, paddingBottom: 14 },
  heroIcon: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  roomImage: { width: '100%', height: '100%', borderRadius: 24 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 9 },
  title: { fontSize: 27, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6, marginBottom: 11 },
  description: { fontSize: 14, lineHeight: 21, fontWeight: '500', marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minHeight: 82, borderRadius: 15, padding: 11, gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },
  memberList: { gap: 9 },
  memberRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, padding: 12, gap: 11 },
  memberText: { flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  memberName: { fontSize: 14, fontWeight: '700' },
  memberMeta: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  moreText: { fontSize: 12, textAlign: 'center', marginTop: 5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, padding: 14, gap: 12, marginBottom: 9 },
  taskRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, padding: 14, gap: 12, marginBottom: 9 },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, borderRadius: 15, alignItems: 'center', gap: 10 },
  ready: { alignItems: 'center', paddingVertical: 24 },
  readyIcon: { width: 94, height: 94, borderRadius: 47, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 22, paddingTop: 14 },
  backButton: { minHeight: 50, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 14, fontWeight: '700' },
  primaryButton: { flex: 1, minHeight: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footerHint: { textAlign: 'center', fontSize: 11, paddingVertical: 14 },
});
