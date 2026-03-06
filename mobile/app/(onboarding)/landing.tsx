import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  Animated, 
  Image,
  FlatList,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Slide {
  id: number;
  icon: string;
  title: string;
  description: string;
  color: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    icon: 'planet',
    title: 'Your Personal Orbit',
    description: 'Track habits, build streaks, and transform your daily routine into something extraordinary.',
    color: '#6366f1',
  },
  {
    id: 2,
    icon: 'people',
    title: 'Together We Rise',
    description: 'Connect with friends in accountability circles. Motivate each other and celebrate progress.',
    color: '#8b5cf6',
  },
  {
    id: 3,
    icon: 'flame',
    title: 'Ignite Your Streak',
    description: 'Never break the chain. Watch your streaks grow as consistency becomes second nature.',
    color: '#f59e0b',
  },
  {
    id: 4,
    icon: 'notifications',
    title: 'Gentle Reminders',
    description: 'Smart notifications that nudges you at the right moment. Never miss a habit again.',
    color: '#ec4899',
  },
];

export default function LandingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [userName, setUserName] = useState('');
  const router = useRouter();
  
  const scrollX = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null);
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadUserName();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.delay(500),
      Animated.spring(buttonAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle logo pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoScale, {
            toValue: 1.08,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(logoGlow, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(logoScale, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(logoGlow, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ]),
      ])
    ).start();
  }, []);

  const loadUserName = async () => {
    const name = await AsyncStorage.getItem('userName');
    setUserName(name || 'there');
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setCurrentSlide(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = ({ item, index }: { item: Slide; index: number }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp',
    });

    // Individual icon animations
    const iconAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      if (currentSlide === index) {
        // Different animations for different icons
        switch (item.icon) {
          case 'flame': // Fire - flicker/shake
            Animated.loop(
              Animated.sequence([
                Animated.timing(iconAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                Animated.timing(iconAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
                Animated.timing(iconAnim, { toValue: 0.5, duration: 100, useNativeDriver: true }),
                Animated.timing(iconAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
              ])
            ).start();
            break;
          case 'notifications': // Bell - swing
            Animated.loop(
              Animated.sequence([
                Animated.timing(iconAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(iconAnim, { toValue: -1, duration: 600, useNativeDriver: true }),
                Animated.timing(iconAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.delay(1000),
              ])
            ).start();
            break;
          case 'planet': // Planet - rotate
            Animated.loop(
              Animated.timing(iconAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
            ).start();
            break;
          case 'people': // People - pulse
            Animated.loop(
              Animated.sequence([
                Animated.timing(iconAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(iconAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
              ])
            ).start();
            break;
        }
      }
    }, [currentSlide, index]);

    const getIconTransform = () => {
      switch (item.icon) {
        case 'flame':
          return {
            transform: [{
              translateX: iconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 2],
              })
            }, {
              translateY: iconAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, -3, 0],
              })
            }]
          };
        case 'notifications':
          return {
            transform: [{
              rotate: iconAnim.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ['-15deg', '0deg', '15deg'],
              })
            }]
          };
        case 'planet':
          return {
            transform: [{
              rotate: iconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              })
            }]
          };
        case 'people':
          return {
            transform: [{
              scale: iconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.1],
              })
            }]
          };
        default:
          return {};
      }
    };

    return (
      <Animated.View 
        style={[
          styles.slide,
          { 
            opacity,
          }
        ]}
      >
        {/* Icon Circle with Glow */}
        <View style={styles.iconWrapper}>
          {/* Glow layers for Android */}
          <View style={[styles.glowLayer, styles.glowOuter, { backgroundColor: item.color + '15' }]} />
          <View style={[styles.glowLayer, styles.glowMiddle, { backgroundColor: item.color + '25' }]} />
          <View style={[styles.glowLayer, styles.glowInner, { backgroundColor: item.color + '35' }]} />
          
          <View style={[
            styles.iconContainer, 
            { 
              backgroundColor: item.color + '20',
              shadowColor: item.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 20,
            }
          ]}>
            <LinearGradient
              colors={[item.color, item.color + '80']}
              style={styles.iconGradient}
            >
              <Animated.View style={getIconTransform()}>
                <Ionicons name={item.icon as any} size={44} color="#fff" />
              </Animated.View>
            </LinearGradient>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>
        
        {/* Description */}
        <Text style={styles.description}>{item.description}</Text>
      </Animated.View>
    );
  };

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      // Scroll to next slide
      scrollViewRef.current?.scrollTo({
        x: (currentSlide + 1) * width,
        animated: true,
      });
      setCurrentSlide(currentSlide + 1);
    } else {
      // Last slide - go to AI intro
      router.replace('/(onboarding)/ai-intro');
    }
  };

  const handleSkip = () => {
    router.replace('/(onboarding)/ai-intro');
  };

  const isLastSlide = currentSlide === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={['#0a0a0f', '#12121a', '#0a0a0f']}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated background orbs */}
      <View style={styles.orbContainer}>
        <Animated.View 
          style={[
            styles.orb,
            styles.orb1,
            {
              transform: [{
                translateX: scrollX.interpolate({
                  inputRange: SLIDES.map((_, i) => i * width),
                  outputRange: [0, 50, 100, 50],
                  extrapolate: 'clamp',
                })
              }]
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.orb,
            styles.orb2,
            {
              transform: [{
                translateX: scrollX.interpolate({
                  inputRange: SLIDES.map((_, i) => i * width),
                  outputRange: [0, -30, -60, -30],
                  extrapolate: 'clamp',
                })
              }]
            }
          ]} 
        />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Animated.View 
          style={[
            {
              shadowColor: '#5865F2',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: logoGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.7],
              }),
              shadowRadius: logoGlow.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 16],
              }),
            }
          ]}
        >
          <Animated.View 
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: logoScale }],
              }
            ]}
          >
            <Image
              source={require('../../assets/krios-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
        
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Welcome Message & Progress */}
      <Animated.View style={[styles.welcomeSection, { opacity: fadeAnim }]}>
        <Text style={styles.welcomeText}>Welcome, {userName}</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>Step {currentSlide + 1} of {SLIDES.length}</Text>
        </View>
      </Animated.View>

      {/* Slides */}
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { 
            useNativeDriver: true,
            listener: (event: any) => {
              const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentSlide(slideIndex);
            },
          }
        )}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((item) => (
          <View key={item.id} style={styles.slideContainer}>
            {renderItem({ item, index: item.id - 1 })}
          </View>
        ))}
      </Animated.ScrollView>

      {/* Pagination */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          
          const dotScale = scrollX.interpolate({
            inputRange,
            outputRange: [1, 3, 1],
            extrapolate: 'clamp',
          });

          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View 
              key={index} 
              style={[
                styles.dot,
                { 
                  opacity: dotOpacity,
                  transform: [{ scaleX: dotScale }]
                }
              ]}
            />
          );
        })}
      </View>

      {/* Bottom Action */}
      <Animated.View 
        style={[
          styles.bottomSection,
          { 
            opacity: buttonAnim,
            transform: [{
              translateY: buttonAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              })
            }]
          }
        ]}
      >
        <TouchableOpacity 
          onPress={handleNext}
          activeOpacity={0.8}
          style={styles.nextButton}
        >
          <LinearGradient
            colors={isLastSlide 
              ? ['#10b981', '#059669'] 
              : ['#6366f1', '#8b5cf6']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextButtonGradient}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons 
              name={isLastSlide ? 'checkmark' : 'arrow-forward'} 
              size={20} 
              color="#fff" 
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Progress text */}
        <Text style={styles.progressText}>
          {currentSlide + 1} of {SLIDES.length}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.15,
  },
  orb1: {
    width: 400,
    height: 400,
    backgroundColor: '#6366f1',
    top: -150,
    right: -100,
  },
  orb2: {
    width: 300,
    height: 300,
    backgroundColor: '#8b5cf6',
    bottom: -100,
    left: -50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  logoContainer: {
    width: 36,
    height: 36,
  },
  logo: {
    width: 36,
    height: 36,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  stepIndicator: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  stepText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: width,
    paddingHorizontal: 24,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  iconWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  glowLayer: {
    position: 'absolute',
    borderRadius: 100,
  },
  glowOuter: {
    width: 200,
    height: 200,
    opacity: 0.3,
  },
  glowMiddle: {
    width: 170,
    height: 170,
    opacity: 0.4,
  },
  glowInner: {
    width: 150,
    height: 150,
    opacity: 0.5,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },
  nextButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 16,
  },
});
