import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <View style={styles.cardSkeleton}>
      <Skeleton height={120} borderRadius={10} style={{ marginBottom: 10 }} />
      <Skeleton width="40%" height={10} borderRadius={3} style={{ marginBottom: 6 }} />
      <Skeleton width="90%" height={14} borderRadius={3} style={{ marginBottom: 4 }} />
      <Skeleton width="70%" height={14} borderRadius={3} style={{ marginBottom: 10 }} />
      <Skeleton width="50%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
      <Skeleton width="100%" height={32} borderRadius={8} />
    </View>
  );
};

const styles = StyleSheet.create({
  cardSkeleton: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

