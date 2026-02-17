import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
}

interface CircularKMenuProps {
  menuItems: MenuItem[];
}

export const CircularKMenu: React.FC<CircularKMenuProps> = ({ menuItems }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    setIsOpen(!isOpen);

    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'],
  });

  return (
    <View style={styles.container}>
      {/* Menu Items - Expand UPWARD */}
      {menuItems.map((item, index) => {
        const radius = 100;
        const angle = (index * 60) - 120; // Spread upward
        const angleRad = (angle * Math.PI) / 180;
        
        const translateX = scaleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, radius * Math.cos(angleRad)],
        });

        const translateY = scaleAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, radius * Math.sin(angleRad)],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.menuItemContainer,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <TouchableOpacity onPress={() => { item.onPress(); toggleMenu(); }}>
              <LinearGradient
                colors={[item.color, item.color + 'CC']}
                style={styles.menuItem}
              >
                <Ionicons name={item.icon} size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* K Logo Button */}
      <TouchableOpacity onPress={toggleMenu} style={styles.kButton}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <LinearGradient
            colors={['#5865F2', '#7c3aed']}
            style={styles.kLogo}
          >
            <Image
              source={require('../assets/krios-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kButton: {
    shadowColor: '#5865F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  kLogo: {
    width: 68, // Increased size
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 40, // Increased logo size
    height: 40,
  },
  menuItemContainer: {
    position: 'absolute',
  },
  menuItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
