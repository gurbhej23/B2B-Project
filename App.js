import React from 'react';
import { StyleSheet, Text, View, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>WORKSPACE ROOT DETECTED</Text>
        </View>
        <Text style={styles.title}>Necessity India B2B</Text>
        <Text style={styles.subtitle}>Mobile App Setup</Text>
        <Text style={styles.text}>
          Expo was launched from the repository root directory instead of the mobile app workspace.
        </Text>
        <View style={styles.codeContainer}>
          <Text style={styles.codeComment}># Run from your project terminal:</Text>
          <Text style={styles.codeText}>pnpm dev:mobile</Text>
          <Text style={styles.codeComment}># Or change directory into mobile app:</Text>
          <Text style={styles.codeText}>cd apps/mobile</Text>
          <Text style={styles.codeText}>npx expo start --clear</Text>
        </View>
        <Text style={styles.info}>
          Running from apps/mobile starts the complete B2B ordering app with Expo Router navigation and live backend connectivity.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#131b2e',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  badgeText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  text: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  codeContainer: {
    backgroundColor: '#0a0f1d',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  codeComment: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  codeText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  info: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
});
