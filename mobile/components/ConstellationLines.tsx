import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Line, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../constants/theme';

interface Connection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
}

interface ConstellationLinesProps {
  connections?: Connection[];
  style?: any;
}

const AnimatedLine = Animated.createAnimatedComponent(Line);

/**
 * Constellation Connection Lines
 * Animated lines connecting particles to create constellation effect
 */
export const ConstellationLines: React.FC<ConstellationLinesProps> = ({
  connections = [
    { x1: 10, y1: 20, x2: 50, y2: 10, delay: 0 },
    { x1: 50, y1: 10, x2: 85, y2: 15, delay: 0.5 },
    { x1: 15, y1: 70, x2: 30, y2: 85, delay: 1 },
    { x1: 70, y1: 90, x2: 90, y2: 75, delay: 1.5 },
    { x1: 5, y1: 45, x2: 15, y2: 70, delay: 2 },
  ],
  style,
}) => {
  const { isDark } = useTheme();

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <SvgLinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={isDark ? "#60A5FA" : "#3B82F6"} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={isDark ? "#F59E0B" : "#D97706"} stopOpacity="0.5" />
          </SvgLinearGradient>
        </Defs>

        {connections.map((conn, index) => (
          <ConnectionLine key={index} {...conn} />
        ))}
      </Svg>
    </View>
  );
};

const ConnectionLine: React.FC<Connection> = ({ x1, y1, x2, y2, delay }) => {
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 2000,
          delay: delay * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, []);

  return (
    <AnimatedLine
      x1={`${x1}%`}
      y1={`${y1}%`}
      x2={`${x2}%`}
      y2={`${y2}%`}
      stroke="url(#lineGradient)"
      strokeWidth="1"
      opacity={opacity}
    />
  );
};

export default ConstellationLines;
