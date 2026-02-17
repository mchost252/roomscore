import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface Message {
  id: number;
  text: string;
  delay: number;
}

const MESSAGES: Message[] = [
  { id: 1, text: "Hey there! I'm Krios 🌟", delay: 500 },
  { id: 2, text: "Think of me as your personal habit companion — here to help you build consistency and crush your goals.", delay: 1800 },
  { id: 3, text: "Rooms are your accountability circles. You and friends join together to track habits and motivate each other.", delay: 3800 },
  { id: 4, text: "Complete tasks daily, keep your streaks alive, and celebrate wins together! 🔥", delay: 6000 },
  { id: 5, text: "Ready to start your journey?", delay: 8500 },
];

export default function AIIntroScreen() {
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
  const [showButtons, setShowButtons] = useState(false);
  const [userName, setUserName] = useState('');
  const router = useRouter();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const buttonScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    AsyncStorage.getItem('userName').then(name => {
      setUserName(name || 'there');
    });

    // Sequential message reveal
    MESSAGES.forEach((msg, index) => {
      setTimeout(() => {
        setVisibleMessages(prev => [...prev, msg.id]);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
        if (index === MESSAGES.length - 1) {
          setTimeout(() => {
            setShowButtons(true);
            Animated.spring(buttonScale, {
              toValue: 1,
              tension: 50,
              friction: 7,
              useNativeDriver: true,
            }).start();
          }, 800);
        }
      }, msg.delay);
    });
  }, []);

  const handleContinue = async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    router.replace('/(onboarding)/auth-choice');
  };

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={['#0a0a0f', '#12121a', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Subtle glow */}
      <View style={styles.glowContainer}>
        <View style={styles.glow} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/krios-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerDivider} />
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Meet Krios</Text>
          <Text style={styles.subtitle}>Your habit companion</Text>
        </View>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messageScroll}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
        >
          {MESSAGES.map((msg, index) => (
            visibleMessages.includes(msg.id) && (
              <View key={msg.id} style={styles.messageRow}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={['#6366f1', '#8b5cf6']}
                    style={styles.avatar}
                  >
                    <Ionicons name="planet" size={16} color="#fff" />
                  </LinearGradient>
                </View>
                
                {/* Message bubble */}
                <View style={styles.messageBubble}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.senderName}>Krios</Text>
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  </View>
                  <Text style={styles.messageText}>{msg.text.replace('{name}', userName)}</Text>
                </View>
              </View>
            )
          ))}

          {/* Typing indicator */}
          {visibleMessages.length < MESSAGES.length && (
            <View style={styles.messageRow}>
              <View style={styles.avatarContainer}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={styles.avatar}>
                  <Ionicons name="planet" size={16} color="#fff" />
                </LinearGradient>
              </View>
              <View style={[styles.messageBubble, styles.typingBubble]}>
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Button */}
        {showButtons && (
          <Animated.View 
            style={[
              styles.buttonContainer,
              {
                transform: [{ scale: buttonScale }]
              }
            ]}
          >
            <TouchableOpacity 
              onPress={handleContinue} 
              activeOpacity={0.8}
              style={styles.button}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>Let's Go! 🚀</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    top: -150,
    left: width / 2 - 200,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoContainer: {
    width: 32,
    height: 32,
  },
  logo: {
    width: 32,
    height: 32,
  },
  headerDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: 16,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  messageScroll: {
    flex: 1,
  },
  messageContent: {
    padding: 24,
    paddingBottom: 40,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typingBubble: {
    paddingVertical: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366f1',
  },
  aiBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  messageText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 24,
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8b5cf6',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
});
