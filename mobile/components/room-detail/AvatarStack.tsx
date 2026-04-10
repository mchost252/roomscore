/**
 * AvatarStack — Overlapping avatar circles with overflow count
 *
 * Usage: <AvatarStack members={members} max={3} size={28} />
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface AvatarStackProps {
  members: { avatar?: string; username: string }[];
  max?: number;
  size?: number;
}

const AvatarStack: React.FC<AvatarStackProps> = ({
  members,
  max = 3,
  size = 26,
}) => {
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  const overlap = size * 0.35;

  return (
    <View style={styles.container}>
      {visible.map((m, i) => (
        <View
          key={i}
          style={[
            styles.avatarWrap,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: i === 0 ? 0 : -overlap,
              zIndex: max - i,
            },
          ]}
        >
          {m.avatar ? (
            <Image
              source={{ uri: m.avatar }}
              style={[
                styles.avatarImage,
                {
                  width: size - 2,
                  height: size - 2,
                  borderRadius: (size - 2) / 2,
                },
              ]}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                {
                  width: size - 2,
                  height: size - 2,
                  borderRadius: (size - 2) / 2,
                },
              ]}
            >
              <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
                {(m.username || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      ))}

      {overflow > 0 && (
        <View
          style={[
            styles.overflowBadge,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -overlap,
            },
          ]}
        >
          <Text style={[styles.overflowText, { fontSize: size * 0.35 }]}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    backgroundColor: '#1e1b4b',
    borderWidth: 1.5,
    borderColor: 'rgba(99,102,241,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  avatarFallback: {
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#c4b5fd',
    fontWeight: '700',
  },
  overflowBadge: {
    backgroundColor: 'rgba(99,102,241,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(99,102,241,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  overflowText: {
    color: '#a5b4fc',
    fontWeight: '700',
  },
});

export default React.memo(AvatarStack);
