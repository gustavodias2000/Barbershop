import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider } from './src/context/ThemeContext';
import type { RootStackParamList } from './src/types';

// Telas
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ClienteHome from './src/screens/ClienteHome';
import BarbeiroHome from './src/screens/BarbeiroHome';
import AgendamentoScreen from './src/screens/AgendamentoScreen';
import HistoricoScreen from './src/screens/HistoricoScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import PrivacidadeScreen from './src/screens/PrivacidadeScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#3498db',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          {/* Autenticação */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />

          {/* Cliente */}
          <Stack.Screen
            name="Cliente"
            component={ClienteHome}
            options={{
              title: 'Barbershop',
              headerLeft: () => null, // Impede voltar para login
            }}
          />
          <Stack.Screen
            name="Agendamento"
            component={AgendamentoScreen}
            options={{ title: 'Novo Agendamento' }}
          />
          <Stack.Screen
            name="Historico"
            component={HistoricoScreen}
            options={{ title: 'Histórico' }}
          />
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{ title: 'Pagamento' }}
          />

          {/* Barbeiro */}
          <Stack.Screen
            name="Barbeiro"
            component={BarbeiroHome}
            options={{
              title: 'Painel do Barbeiro',
              headerLeft: () => null, // Impede voltar para login
            }}
          />

          {/* Compartilhadas */}
          <Stack.Screen
            name="Perfil"
            component={PerfilScreen}
            options={{ title: 'Meu Perfil' }}
          />
          <Stack.Screen
            name="Privacidade"
            component={PrivacidadeScreen}
            options={{ title: 'Política de Privacidade' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
