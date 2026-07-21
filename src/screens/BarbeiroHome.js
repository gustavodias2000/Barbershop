import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase';
import WhatsAppService from '../services/WhatsAppService';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { liberarSlot } from '../services/OcupacaoService';
import {
  listarDoBarbeiro,
  atualizarStatus,
} from '../data/repositories/AgendamentoRepository';
import useUserProfile from '../hooks/useUserProfile';
import { formatDateTime, formatPreco } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { getStatusColor, getStatusText } from '../utils/statusUtils';
import { SkeletonList } from '../components/Skeleton';

export default function BarbeiroHome({ navigation }) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const { profile: userProfile, refresh: refreshProfile } = useUserProfile();
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [stats, setStats] = useState({ pendentes: 0, confirmados: 0, total: 0 });

  useEffect(() => {
    fetchAgendamentos().finally(() => setLoading(false));
  }, []);

  const fetchAgendamentos = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const data = await listarDoBarbeiro(uid, 50);

      setAgendamentos(data);
      setStats({
        pendentes: data.filter((ag) => ag.status === 'pendente').length,
        confirmados: data.filter((ag) => ag.status === 'confirmado').length,
        total: data.length,
      });
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os agendamentos.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), fetchAgendamentos()]);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const confirmar = async (agendamento) => {
    Alert.alert(
      'Confirmar Agendamento',
      `Confirmar agendamento de ${agendamento.clienteNome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await atualizarStatus(agendamento.id, 'confirmado');

              const clienteTelefone = agendamento.clienteTelefone;
              if (clienteTelefone) {
                const barbeiroNome =
                  userProfile?.nome ||
                  auth.currentUser?.email?.split('@')[0] ||
                  'Barbeiro';

                const mensagem = WhatsAppService.gerarMensagemConfirmacao(
                  { nome: agendamento.clienteNome, telefone: clienteTelefone },
                  agendamento.data,
                  agendamento.horario,
                  barbeiroNome,
                );

                const enviado = await WhatsAppService.sendTextMessage(
                  clienteTelefone,
                  mensagem,
                );

                Alert.alert(
                  'Sucesso!',
                  enviado
                    ? 'Agendamento confirmado e cliente notificado via WhatsApp!'
                    : 'Agendamento confirmado. Cliente sem WhatsApp cadastrado.',
                );
              } else {
                Alert.alert('Sucesso!', 'Agendamento confirmado.');
              }

              await fetchAgendamentos();
            } catch (error) {
              console.error('Erro ao confirmar:', error);
              Alert.alert('Erro', 'Não foi possível confirmar o agendamento.');
            }
          },
        },
      ],
    );
  };

  const cancelar = async (agendamento) => {
    Alert.alert(
      'Cancelar Agendamento',
      `Cancelar agendamento de ${agendamento.clienteNome}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await atualizarStatus(agendamento.id, 'cancelado', {
                cancelledBy: 'barbeiro',
              });

              await liberarSlot(
                agendamento.barbeiroId,
                agendamento.data,
                agendamento.horario,
              );

              const clienteTelefone = agendamento.clienteTelefone;
              if (clienteTelefone) {
                const mensagem = WhatsAppService.gerarMensagemCancelamento(
                  { nome: agendamento.clienteNome, telefone: clienteTelefone },
                  agendamento.data,
                  agendamento.horario,
                  'Reagendamento necessário',
                );
                const enviado = await WhatsAppService.sendTextMessage(
                  clienteTelefone,
                  mensagem,
                );
                Alert.alert(
                  'Cancelado',
                  enviado
                    ? 'Agendamento cancelado e cliente notificado via WhatsApp.'
                    : 'Agendamento cancelado.',
                );
              } else {
                Alert.alert('Cancelado', 'Agendamento cancelado.');
              }

              await fetchAgendamentos();
            } catch (error) {
              console.error('Erro ao cancelar:', error);
              Alert.alert('Erro', 'Não foi possível cancelar o agendamento.');
            }
          },
        },
      ],
    );
  };

  const concluir = async (agendamento) => {
    Alert.alert(
      'Concluir Atendimento',
      `Marcar atendimento de ${agendamento.clienteNome} como concluído?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Concluir',
          onPress: async () => {
            try {
              await atualizarStatus(agendamento.id, 'concluido');
              Alert.alert('Sucesso!', 'Atendimento marcado como concluído.');
              await fetchAgendamentos();
            } catch (error) {
              console.error('Erro ao concluir:', error);
              Alert.alert('Erro', 'Não foi possível concluir o atendimento.');
            }
          },
        },
      ],
    );
  };

  const renderAgendamento = ({ item }) => (
    <View style={s.agendamentoCard}>
      <View style={s.agendamentoHeader}>
        <View style={s.clienteInfo}>
          <View style={s.avatarContainer} accessibilityElementsHidden>
            <Text style={s.avatarText}>
              {item.clienteNome ? item.clienteNome.charAt(0).toUpperCase() : 'C'}
            </Text>
          </View>
          <View style={s.clienteDetails}>
            <Text style={s.clienteNome}>{item.clienteNome || 'Cliente'}</Text>
            <Text style={s.clienteEmail}>{item.cliente}</Text>
          </View>
        </View>
        <View
          style={[s.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
          accessibilityLabel={`Status: ${getStatusText(item.status)}`}
        >
          <Text style={s.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={s.agendamentoInfo}>
        <Text style={s.agendamentoData}>
          📅 {item.data} às {item.horario}
        </Text>
        <Text style={s.agendamentoServico}>
          ✂️ {item.servico || 'Corte e barba'} · {formatPreco(item)}
        </Text>
        <Text style={s.agendamentoCreated}>
          Solicitado em: {formatDateTime(item.createdAt)}
        </Text>
      </View>

      {item.status === 'pendente' && (
        <View style={s.actionButtons}>
          <TouchableOpacity
            style={[s.actionButton, s.confirmarButton]}
            accessibilityRole="button"
            accessibilityLabel={`Confirmar agendamento de ${item.clienteNome}`}
            onPress={() => confirmar(item)}
          >
            <Text style={s.actionButtonText}>Confirmar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionButton, s.cancelarButton]}
            accessibilityRole="button"
            accessibilityLabel={`Cancelar agendamento de ${item.clienteNome}`}
            onPress={() => cancelar(item)}
          >
            <Text style={s.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'confirmado' && (
        <View style={s.actionButtons}>
          <TouchableOpacity
            style={[s.actionButton, s.concluirButton]}
            accessibilityRole="button"
            accessibilityLabel={`Marcar atendimento de ${item.clienteNome} como concluído`}
            onPress={() => concluir(item)}
          >
            <Text style={s.actionButtonText}>Marcar Concluído</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionButton, s.cancelarButton]}
            accessibilityRole="button"
            accessibilityLabel={`Cancelar agendamento confirmado de ${item.clienteNome}`}
            onPress={() => cancelar(item)}
          >
            <Text style={s.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    // Skeleton loading (item 17)
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  const barbeiroNome = userProfile?.nome
    ? userProfile.nome.split(' ')[0]
    : 'Barbeiro';
  const barbeiroUid = auth.currentUser?.uid || '';

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Olá, {barbeiroNome}!</Text>
          <Text style={s.title}>Painel do Barbeiro</Text>
        </View>
        <View style={s.headerButtons}>
          <TouchableOpacity
            style={s.perfilButton}
            accessibilityRole="button"
            accessibilityLabel="Meu perfil"
            onPress={() => navigation.navigate('Perfil')}
          >
            <Text style={s.perfilButtonText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.analyticsButton}
            accessibilityRole="button"
            accessibilityLabel={showAnalytics ? 'Ver agenda' : 'Ver analytics'}
            onPress={() => setShowAnalytics(!showAnalytics)}
          >
            <Text style={s.analyticsButtonText}>
              {showAnalytics ? 'Agenda' : 'Analytics'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.profileButton}
            accessibilityRole="button"
            accessibilityLabel="Sair do aplicativo"
            onPress={() =>
              Alert.alert('Sair', 'Deseja realmente sair?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Sair',
                  style: 'destructive',
                  onPress: async () => {
                    await auth.signOut();
                    navigation.replace('Login');
                  },
                },
              ])
            }
          >
            <Text style={s.profileButtonText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showAnalytics ? (
        <AnalyticsDashboard barbeiroId={barbeiroUid} />
      ) : (
        <>
          <View style={s.statsContainer}>
            <View style={s.statCard}>
              <Text style={s.statNumber}>{stats.pendentes}</Text>
              <Text style={s.statLabel}>Pendentes</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNumber}>{stats.confirmados}</Text>
              <Text style={s.statLabel}>Confirmados</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statNumber}>{stats.total}</Text>
              <Text style={s.statLabel}>Total</Text>
            </View>
          </View>

          <FlatList
            data={agendamentos}
            keyExtractor={(item) => item.id}
            renderItem={renderAgendamento}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={s.emptyContainer}>
                <Text style={s.emptyText}>Nenhum agendamento encontrado</Text>
                <Text style={s.emptySubtext}>
                  Os agendamentos aparecerão aqui quando os clientes solicitarem
                </Text>
              </View>
            }
            contentContainerStyle={agendamentos.length === 0 && s.emptyList}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  greeting: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  perfilButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfilButtonText: {
    fontSize: 20,
  },
  analyticsButton: {
    backgroundColor: '#8e44ad',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  analyticsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  profileButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  profileButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  agendamentoCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  agendamentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clienteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clienteDetails: {
    flex: 1,
  },
  clienteNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  clienteEmail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  agendamentoInfo: {
    marginBottom: 12,
  },
  agendamentoData: {
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 4,
  },
  agendamentoServico: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  agendamentoCreated: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  confirmarButton: {
    backgroundColor: theme.colors.success,
  },
  cancelarButton: {
    backgroundColor: theme.colors.error,
  },
  concluirButton: {
    backgroundColor: '#8e44ad',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
