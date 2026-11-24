import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../types/navigation';
import { HomeScreen } from '../screens/home/HomeScreen';
import { CatalogueScreen } from '../screens/catalogue/CatalogueScreen';
import { CartScreen } from '../screens/cart/CartScreen';
import { OrdersListScreen } from '../screens/orders/OrdersListScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import { useCart } from '../context/CartContext';
import { colors } from '../theme/colors';
import { Icon } from '../components/common/Icon';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { itemCount } = useCart();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.white,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.textPrimary,
          letterSpacing: -0.2,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 62 : 64,
          paddingBottom: Platform.OS === 'android' ? 8 : 10,
          paddingTop: 8,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          headerShown: false, // HomeScreen renders its own branded premium B2B header
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <Icon name="home" size={20} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="CatalogueTab"
        component={CatalogueScreen}
        options={{
          title: 'Wholesale Catalogue',
          tabBarLabel: 'Catalogue',
          tabBarIcon: ({ color }) => (
            <Icon name="catalogue" size={20} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: 'Wholesale Cart',
          tabBarLabel: 'Cart',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.white,
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: 18,
          },
          tabBarIcon: ({ color }) => (
            <Icon name="cart" size={20} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersListScreen}
        options={{
          title: 'Wholesale Orders',
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color }) => (
            <Icon name="orders" size={20} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountScreen}
        options={{
          title: 'Customer Account',
          tabBarLabel: 'Account',
          tabBarIcon: ({ color }) => (
            <Icon name="account" size={20} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
