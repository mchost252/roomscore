/**
 * AI Clarification Sheet
 *
 * A bottom sheet that appears after vague task creation.
 * Asks 2–3 focused questions to help the AI generate a better note.
 * Always skippable. Feels light and fast — not a form.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ClarificationQuestion } from '../services/aiNoteService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

interface Props {
  visible: boolean;
  taskTitle: string;
  questions: ClarificationQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export default function AIClarificationSheet({
  visible,
  taskTitle,
  questions,
  onSubmit,
  onSkip,
}: Props) {
  const { isDark } = useTheme();

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Reset answers when new questions come in
  useEffect(() => {
    setAnswers({});
  }, [questions]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleChipSelect = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: prev[questionId] === value ? '' : value, // toggle
    }));
  };

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    // Filter out empty answers
    const filtered = Object.fromEntries(
      Object.entries(answers).filter(([, v]) => v && v.trim() !== '')
    );
    onSubmit(filtered);
  };

  const hasAnyAnswer = Object.values(answers).some(v => v && v.trim() !== '');

  const colors = {
    bg: isDark ? '#0F0F1A' : '#FFFFFF',
    surface: isDark ? '#1A1A2E' : '#F5F5F5',
    border: isDark ? '#2A2A3E' : '#E0E0E0',
    text: isDark ? '#FFFFFF' : '#111111',
    subtext: isDark ? '#8888AA' : '#666666',
    accent: '#7C5CBF',
    accentLight: isDark ? '#2D1F4E' : '#EDE7F6',
    chipActive: '#7C5CBF',
    chipActiveTxt: '#FFFFFF',
    chipInactive: isDark ? '#1E1E30' : '#EFEFEF',
    chipInactiveTxt: isDark ? '#AAAACC' : '#555555',
    skip: isDark ? '#555577' : '#AAAAAA',
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onSkip} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kvWrapper}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.bg, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.aiDot, { backgroundColor: colors.accent }]}>
              <Text style={styles.aiDotText}>✦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Quick check ✦
              </Text>
              <Text style={[styles.headerSub, { color: colors.subtext }]} numberOfLines={1}>
                {taskTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.skipText, { color: colors.skip }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.helperText, { color: colors.subtext }]}>
            Help the AI write a better plan for you. Takes 10 seconds.
          </Text>

          {/* Questions */}
          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {questions.map((q, index) => (
              <View key={q.id} style={styles.questionBlock}>
                <Text style={[styles.questionText, { color: colors.text }]}>
                  {index + 1}. {q.question}
                  {q.optional && (
                    <Text style={{ color: colors.subtext, fontSize: 12 }}> (optional)</Text>
                  )}
                </Text>

                {q.type === 'chips' && q.options && (
                  <View style={styles.chipsRow}>
                    {q.options.map(opt => {
                      const selected = answers[q.id] === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? colors.chipActive : colors.chipInactive,
                              borderColor: selected ? colors.chipActive : colors.border,
                            },
                          ]}
                          onPress={() => handleChipSelect(q.id, opt)}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: selected ? colors.chipActiveTxt : colors.chipInactiveTxt },
                            ]}
                          >
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {q.type === 'text' && (
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: answers[q.id] ? colors.accent : colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder={q.placeholder || 'Type here...'}
                    placeholderTextColor={colors.subtext}
                    value={answers[q.id] || ''}
                    onChangeText={v => handleTextChange(q.id, v)}
                    returnKeyType="done"
                  />
                )}
              </View>
            ))}

            {/* Bottom spacing for keyboard */}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Actions */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: hasAnyAnswer ? colors.accent : colors.accentLight,
                  opacity: hasAnyAnswer ? 1 : 0.7,
                },
              ]}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.submitText,
                  { color: hasAnyAnswer ? '#FFFFFF' : colors.accent },
                ]}
              >
                {hasAnyAnswer ? '✦  Generate my plan' : 'Continue without answers'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  kvWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SHEET_HEIGHT,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  aiDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiDotText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 13,
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
  },
  scrollArea: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  questionBlock: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
