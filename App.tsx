import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider } from './src/context/ThemeContext';
import type { RootStackParamList } from './src/types';

// Navegação por tabs
import BarbeiroTabs from './src/navigation/BarbeiroTabs';
import ClienteTabs from './src/navigation/ClienteTabs';

// Telas
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import AgendamentoScreen from './src/screens/AgendamentoScreen';
import AgendamentoConfirmadoScreen from './src/screens/AgendamentoConfirmadoScreen';
import HistoricoScreen from './src/screens/HistoricoScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import PrivacidadeScreen from './src/screens/PrivacidadeScreen';
import ConfigAgendaScreen from './src/screens/ConfigAgendaScreen';
import FolgasScreen from './src/screens/FolgasScreen';
import ConfigServicosScreen from './src/screens/ConfigServicosScreen';
import SetupBarbeiroScreen from './src/screens/SetupBarbeiroScreen';
import ClientesScreen from './src/screens/ClientesScreen';
import TemplatesMensagemScreen from './src/screens/TemplatesMensagemScreen';
import ClientesBanidosScreen from './src/screens/ClientesBanidosScreen';
import HistoricoClienteScreen from './src/screens/HistoricoClienteScreen';
import QRCodeScreen from './src/screens/QRCodeScreen';
import SuporteScreen from './src/screens/SuporteScreen';
import ListaEsperaScreen from './src/screens/ListaEsperaScreen';
import RecorrenciasScreen from './src/screens/RecorrenciasScreen';
import CriarRecorrenciaScreen from './src/screens/CriarRecorrenciaScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0F1923',
            },
            headerTintColor: '#F59E0B',
            headerTitleStyle: {
              fontWeight: '700',
              color: '#F8FAFC',
              fontSize: 17,
            },
            headerShadowVisible: false,
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

          {/* Cliente — Tab Navigator */}
          <Stack.Screen
            name="Cliente"
            component={ClienteTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Agendamento"
            component={AgendamentoScreen}
            options={{ title: 'Novo Agendamento' }}
          />
          <Stack.Screen
            name="AgendamentoConfirmado"
            component={AgendamentoConfirmadoScreen}
            options={{ title: 'Agendamento', headerBackVisible: false }}
          />
          <Stack.Screen
            name="Historico"
            component={HistoricoScreen}
            options={{ title: 'Histórico' }}
          />

          {/* Barbeiro — Tab Navigator */}
          <Stack.Screen
            name="Barbeiro"
            component={BarbeiroTabs}
            options={{ headerShown: false }}
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

          {/* Configurações do barbeiro */}
          <Stack.Screen
            name="ConfigAgenda"
            component={ConfigAgendaScreen}
            options={{ title: 'Horário de Atendimento' }}
          />
          <Stack.Screen
            name="Folgas"
            component={FolgasScreen}
            options={{ title: 'Dias de Folga' }}
          />
          <Stack.Screen
            name="ConfigServicos"
            component={ConfigServicosScreen}
            options={{ title: 'Meus Serviços' }}
          />
          <Stack.Screen
            name="SetupBarbeiro"
            component={SetupBarbeiroScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Clientes"
            component={ClientesScreen}
            options={{ title: 'Clientes' }}
          />
          <Stack.Screen
            name="TemplatesMensagem"
            component={TemplatesMensagemScreen}
            options={{ title: 'Templates WhatsApp' }}
          />
          <Stack.Screen
            name="ClientesBanidos"
            component={ClientesBanidosScreen}
            options={{ title: 'Clientes Banidos' }}
          />
          <Stack.Screen
            name="HistoricoCliente"
            component={HistoricoClienteScreen}
            options={({ route }) => ({
              title: `Histórico — ${route.params.clienteNome}`,
            })}
          />
          <Stack.Screen
            name="QRCode"
            component={QRCodeScreen}
            options={{ title: 'QR Code de Agendamento' }}
          />
          <Stack.Screen
            name="Suporte"
            component={SuporteScreen}
            options={{ title: 'Ajuda e Suporte' }}
          />
          <Stack.Screen
            name="ListaEspera"
            component={ListaEsperaScreen}
            options={{ title: 'Lista de Espera' }}
          />
          <Stack.Screen
            name="Recorrencias"
            component={RecorrenciasScreen}
            options={{ title: 'Recorrências' }}
          />
          <Stack.Screen
            name="CriarRecorrencia"
            component={CriarRecorrenciaScreen}
            options={({ route }) => ({
              title: `Recorrência — ${route.params.clienteNome}`,
            })}
          />
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
