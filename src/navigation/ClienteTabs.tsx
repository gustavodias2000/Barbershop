/**
 * ClienteTabs — Bottom Tab Navigator para o fluxo do cliente.
 *
 * Abas:
 *  1. Barbeiros    — lista de barbeiros disponíveis para agendar
 *  2. Agendamentos — histórico e próximos agendamentos do cliente
 *  3. Perfil       — perfil do cliente + sair
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

import ClienteHome from '../screens/ClienteHome';
import ClienteAgendamentosTab from '../screens/tabs/ClienteAgendamentosTab';
import ClientePerfilTab from '../screens/tabs/ClientePerfilTab';

type ClienteTabParamList = {
  Barbeiros: undefined;
  Agendamentos: undefined;
  PerfilCliente: undefined;
};

const Tab = createBottomTabNavigator<ClienteTabParamList>();

const ICONS: Record<string, string> = {
  Barbeiros:     '✂️',
  Agendamentos:  '📅',
  PerfilCliente: '👤',
};

export default function ClienteTabs() {
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
        name="Barbeiros"
        component={ClienteHome}
        options={{ title: 'Barbeiros' }}
      />
      <Tab.Screen
        name="Agendamentos"
        component={ClienteAgendamentosTab}
        options={{ title: 'Meus Horários' }}
      />
      <Tab.Screen
        name="PerfilCliente"
        component={ClientePerfilTab}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}
