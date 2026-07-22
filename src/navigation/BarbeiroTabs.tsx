/**
 * BarbeiroTabs — Bottom Tab Navigator para o fluxo do barbeiro.
 *
 * Abas:
 *  1. Agenda      — lista de agendamentos do dia / todos
 *  2. Config      — configurações administrativas
 *  3. Analytics   — dashboard de métricas
 *  4. Perfil      — perfil do barbeiro + sair
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

import BarbeiroHome from '../screens/BarbeiroHome';
import BarbeiroConfigTab from '../screens/tabs/BarbeiroConfigTab';
import BarbeiroAnalyticsTab from '../screens/tabs/BarbeiroAnalyticsTab';
import BarbeiroPerfilTab from '../screens/tabs/BarbeiroPerfilTab';

type BarbeiroTabParamList = {
  Agenda: undefined;
  Config: undefined;
  Analytics: undefined;
  Perfil: undefined;
};

const Tab = createBottomTabNavigator<BarbeiroTabParamList>();

const ICONS: Record<string, string> = {
  Agenda:    '📋',
  Config:    '⚙️',
  Analytics: '📊',
  Perfil:    '👤',
};

export default function BarbeiroTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: { name: string } }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }: { focused: boolean }) => (
          <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
            {ICONS[route.name]}
          </Text>
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 80 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen
        name="Agenda"
        component={BarbeiroHome}
        options={{ title: 'Agenda' }}
      />
      <Tab.Screen
        name="Config"
        component={BarbeiroConfigTab}
        options={{ title: 'Configurações' }}
      />
      <Tab.Screen
        name="Analytics"
        component={BarbeiroAnalyticsTab}
        options={{ title: 'Analytics' }}
      />
      <Tab.Screen
        name="Perfil"
        component={BarbeiroPerfilTab}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}
