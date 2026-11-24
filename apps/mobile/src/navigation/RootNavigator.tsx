import React, { useState, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList, AuthStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { MainTabNavigator } from './MainTabNavigator';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { PendingApprovalScreen } from '../screens/auth/PendingApprovalScreen';
import { AccountDisabledScreen } from '../screens/auth/AccountDisabledScreen';
import { ProductDetailsScreen } from '../screens/catalogue/ProductDetailsScreen';
import { CheckoutScreen } from '../screens/cart/CheckoutScreen';
import { OrderDetailsScreen } from '../screens/orders/OrderDetailsScreen';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      <AuthStack.Screen name="AccountDisabled" component={AccountDisabledScreen} />
    </AuthStack.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const { isLoading, isAuthenticated, isPendingApproval, isDisabled } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || showSplash) {
    return <SplashScreen />;
  }

  // If customer is disabled by admin
  if (isDisabled) {
    return <AccountDisabledScreen />;
  }

  // If customer is pending approval
  if (isAuthenticated && isPendingApproval) {
    return <PendingApprovalScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { fontSize: 17, fontWeight: '800', color: colors.slate900 },
        headerTintColor: colors.primaryDark,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ProductDetails"
            component={ProductDetailsScreen}
            options={{ title: 'Product Specifications' }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ title: 'Commercial Checkout' }}
          />
          <Stack.Screen
            name="OrderDetails"
            component={OrderDetailsScreen}
            options={{ title: 'Order Details' }}
          />
          <Stack.Screen
            name="PendingApproval"
            component={PendingApprovalScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AccountDisabled"
            component={AccountDisabledScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pageBg,
    padding: 24,
  },
  splashLogoCard: {
    width: 200,
    height: 120,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  splashLogo: {
    width: '100%',
    height: '100%',
  },
  splashTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  splashSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
    textAlign: 'center',
  },
  splashLoader: {
    marginTop: 32,
  },
});
