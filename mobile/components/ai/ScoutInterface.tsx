/**
 * ScoutInterface — Tactical AI Commander Terminal
 */
import React, { useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, 
  TouchableOpacity, ScrollView, KeyboardAvoidingView, 
  Platform, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTacticalCommander, getMessageText } from '../../hooks/ai/useTacticalCommander';
import { useTheme } from '../../context/ThemeContext';
import { UIMessage } from '@ai-sdk/react';

interface ScoutInterfaceProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  taskId?: string; // New optional taskId
}

export const ScoutInterface: React.FC<ScoutInterfaceProps> = ({ visible, onClose, roomId, userId, taskId }) => {
  const { isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  
  const {
    commanderMessages,
    commanderInput,
    updateCommanderInput,
    sendCommanderCommand,
    isCommanderLoading,
    commanderError,
  } = useTacticalCommander(roomId, userId, [], taskId);

  useEffect(() => {
    if (commanderMessages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [commanderMessages]);

  if (!visible) return null;

  return (
    <Animated.View 
      entering={SlideInDown.springify().damping(15)} 
      exiting={SlideOutDown.duration(300)}
      style={s.overlay}
    >
      <BlurView intensity={isDark ? 80 : 100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={s.container}
      >
        <View style={s.header}>
          <View style={s.statusRow}>
            <View style={[s.pulseDot, { backgroundColor: isCommanderLoading ? '#22d3ee' : '#22c55e' }]} />
            <Text style={s.headerTitle}>KRIOS COMMANDER // SCOUT_L4</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollRef}
          style={s.terminal} 
          contentContainerStyle={s.terminalContent}
          showsVerticalScrollIndicator={false}
        >
          {commanderMessages.length === 0 && (
            <Text style={s.emptyMsg}>[ STANDBY FOR INPUT ]</Text>
          )}

          {commanderMessages.map((m, i) => {
            const msg = m as any;
            return (
              <View key={msg.id || i} style={s.msgGroup}>
                <Text style={[s.roleLabel, { color: msg.role === 'user' ? '#818cf8' : '#a5b4fc' }]}>
                  {msg.role === 'user' ? '> OPERATIVE' : '> COMMANDER'}
                </Text>
                <Text style={[s.msgText, { color: isDark ? '#fff' : '#000' }]}>
                  {getMessageText(m)}
                </Text>
                {msg.parts?.filter((p: any) => p.type === 'tool-invocation').map((part: any, ti: number) => (
                  <View key={ti} style={s.toolBadge}>
                    <Ionicons name="construct-outline" size={10} color="#22d3ee" />
                    <Text style={s.toolText}>EXECUTING: {part.toolName?.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            );
          })}

          {isCommanderLoading && (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color="#22d3ee" />
              <Text style={s.loadingText}>RECEIVING DATA...</Text>
            </View>
          )}

          {commanderError && (
            <Text style={s.errorMsg}>[ COMM_LINK_ERROR ]: {commanderError.message}</Text>
          )}
        </ScrollView>

        <View style={s.inputWrapper}>
          <TextInput
            style={[s.input, { color: isDark ? '#fff' : '#000', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}
            value={commanderInput}
            onChangeText={updateCommanderInput}
            placeholder="ENTER TACTICAL COMMAND..."
            placeholderTextColor="rgba(165,180,252,0.4)"
            autoCapitalize="characters"
          />
          <TouchableOpacity 
            onPress={() => sendCommanderCommand()}
            disabled={isCommanderLoading || !commanderInput.trim()}
            style={[s.sendBtn, { opacity: !commanderInput.trim() ? 0.5 : 1 }]}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 100,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(165,180,252,0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#818cf8',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  terminal: {
    flex: 1,
  },
  terminalContent: {
    paddingBottom: 20,
  },
  msgGroup: {
    marginBottom: 20,
    gap: 4,
  },
  roleLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 9,
    fontWeight: '900',
  },
  msgText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 20,
  },
  emptyMsg: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: 'rgba(165,180,252,0.3)',
    textAlign: 'center',
    marginTop: 40,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  loadingText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#22d3ee',
  },
  errorMsg: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#ef4444',
    marginTop: 10,
  },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,211,238,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  toolText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: '#22d3ee',
  },
  inputWrapper: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 20,
  },
  input: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  sendBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
