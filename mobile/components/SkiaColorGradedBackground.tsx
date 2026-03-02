import React from 'react';
import { Canvas, Rect, LinearGradient, RadialGradient, vec } from '@shopify/react-native-skia';
import { Dimensions, StyleSheet } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

interface Props { isDark: boolean; }

export const SkiaColorGradedBackground: React.FC<Props> = ({ isDark }) => {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Base gradient - full screen */}
      <Rect x={0} y={0} width={W} height={H}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(W, H)}
          colors={isDark
            ? ['#12122a', '#0d1428', '#080e1e', '#050810']
            : ['#ffffff', '#f5f5ff', '#f0f0fe', '#ebebff']
          }
        />
      </Rect>
      {/* Top-left accent blob */}
      <Rect x={0} y={0} width={W * 0.7} height={H * 0.45}>
        <RadialGradient
          c={vec(W * 0.15, H * 0.08)}
          r={W * 0.55}
          colors={isDark
            ? ['rgba(99,102,241,0.28)', 'transparent']
            : ['rgba(99,102,241,0.10)', 'transparent']
          }
        />
      </Rect>
      {/* Bottom-right accent blob */}
      <Rect x={W * 0.3} y={H * 0.55} width={W * 0.7} height={H * 0.45}>
        <RadialGradient
          c={vec(W * 0.85, H * 0.9)}
          r={W * 0.5}
          colors={isDark
            ? ['rgba(139,92,246,0.22)', 'transparent']
            : ['rgba(139,92,246,0.07)', 'transparent']
          }
        />
      </Rect>
      {/* Center shimmer */}
      <Rect x={W * 0.2} y={H * 0.25} width={W * 0.6} height={H * 0.5}>
        <RadialGradient
          c={vec(W * 0.5, H * 0.5)}
          r={W * 0.4}
          colors={isDark
            ? ['rgba(79,70,229,0.12)', 'transparent']
            : ['rgba(224,224,255,0.5)', 'transparent']
          }
        />
      </Rect>
    </Canvas>
  );
};
