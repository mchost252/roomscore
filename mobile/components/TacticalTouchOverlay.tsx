import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence, 
  runOnJS 
} from 'react-native-reanimated';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');

/**
 * TacticalTouchOverlay — High-performance global touch feedback
 * Architecture:
 * - Single Skia Canvas for zero-lag GPU drawing
 * - Circular "Ping" effect using shared values
 * - pointerEvents="none" ensures zero interference with UI
 */
const TacticalTouchOverlay = () => {
  // We use a pool of 3 pings to handle rapid taps
  const p1 = { x: useSharedValue(0), y: useSharedValue(0), scale: useSharedValue(0), opacity: useSharedValue(0) };
  const p2 = { x: useSharedValue(0), y: useSharedValue(0), scale: useSharedValue(0), opacity: useSharedValue(0) };
  const p3 = { x: useSharedValue(0), y: useSharedValue(0), scale: useSharedValue(0), opacity: useSharedValue(0) };
  
  const pings = [p1, p2, p3];
  const activeIndex = useSharedValue(0);

  const gesture = Gesture.Tap()
    .onStart((e) => {
      'worklet';
      const index = activeIndex.value;
      const p = pings[index];
      
      // Reset & Trigger Ping
      p.x.value = e.x;
      p.y.value = e.y;
      p.scale.value = 0;
      p.opacity.value = 0.6;
      
      p.scale.value = withTiming(40, { duration: 450 });
      p.opacity.value = withTiming(0, { duration: 450 });
      
      // Cycle through the pool
      activeIndex.value = (index + 1) % 3;
    })
    .maxDuration(100000); // Ensure it doesn't block other gestures

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            {pings.map((p, i) => (
              <Group key={i}>
                {/* Tactical Sonar Ping — Inner Core */}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={p.scale}
                  color="#6366f1"
                  opacity={p.opacity}
                  style="stroke"
                  strokeWidth={1.5}
                />
                {/* Secondary Wave */}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={p.scale}
                  color="#8b5cf6"
                  opacity={p.opacity}
                  style="stroke"
                  strokeWidth={0.5}
                />
              </Group>
            ))}
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
};

export default TacticalTouchOverlay;
