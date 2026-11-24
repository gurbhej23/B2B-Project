import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

export const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim, taglineFade]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      {/* Main Centered Content */}
      <View style={styles.centerContent}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/img.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Subtle Bottom Loader & Security Tag */}
      <View style={styles.bottomSection}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.secureText}>Secured B2B Trading Platform</Text>
      </View>

      {/* Organic Warm Brand Curve (matching brand theme) */}
      <View style={styles.bottomWaveContainer} pointerEvents="none">
        <View style={styles.waveLayer1} />
        <View style={styles.waveLayer2} />
        <View style={styles.waveLayer3} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
    marginTop: -40,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.8,
    height: 150,
    maxWidth: 320,
  },
  taglineContainer: {
    alignItems: 'center',
    marginTop: 14,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate800,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: colors.primaryBg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  secureText: {
    fontSize: 11,
    color: colors.slate400,
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  bottomWaveContainer: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    right: -40,
    height: height * 0.35,
    zIndex: 1,
  },
  waveLayer1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: '#FFF8F3',
    borderTopLeftRadius: width * 0.8,
    borderTopRightRadius: width * 0.6,
    transform: [{ rotate: '-6deg' }, { scaleX: 1.2 }],
    opacity: 0.9,
  },
  waveLayer2: {
    position: 'absolute',
    bottom: -15,
    left: 20,
    right: -20,
    height: '85%',
    backgroundColor: '#FFF1E8',
    borderTopLeftRadius: width * 0.7,
    borderTopRightRadius: width * 0.8,
    transform: [{ rotate: '4deg' }, { scaleX: 1.15 }],
    opacity: 0.85,
  },
  waveLayer3: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    right: 20,
    height: '65%',
    backgroundColor: '#FFE3D1',
    borderTopLeftRadius: width * 0.9,
    borderTopRightRadius: width * 0.5,
    transform: [{ rotate: '-2deg' }, { scaleX: 1.1 }],
    opacity: 0.6,
  },
});
