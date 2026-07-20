import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { db, auth } from '../../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  getDoc,
} from 'firebase/firestore';
import WhatsAppService from '../services/WhatsAppService';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import { formatDateTime } from '../utils/dateUtils';

export default function BarbeiroHome({ navigation }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState({
    pendentes: 0,
    confirmados: 0,
    total: 0,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      await Promise.all([fetchUserProfile(), fetchAgendamentos()]);
    } catch (error) {
      console.error('Erro ao carregar:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  const fetchAgendamentos = async () => {
    try {
      const q = query(
        collection(db, 'agendamentos'),
        orderBy('createdAt', 'desc'),
      );

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      setAgendamentos(data);

      const pendentes = data.filter((ag) => ag.status === 'pendente').length;
      const confirmados = data.filter((ag) => ag.status === 'confirmado').length;

      setStats({ pendentes, confirmados, total: data.length });
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os agendamentos.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchUserProfile(), fetchAgendamentos()]);
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
              const ref = doc(db, 'agendamentos', agendamento.id);
              await updateDoc(ref, {
                status: 'confirmado',
                confirmedAt: new Date(),
              });

              // Enviar confirmação via WhatsApp se tiver telefone do cliente
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
              const ref = doc(db, 'agendamentos', agendamento.id);
              await updateDoc(ref, {
                status: 'cancelado',
                cancelledAt: new Date(),
              });

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
              const ref = doc(db, 'agendamentos', agendamento.id);
              await updateDoc(ref, {
                status: 'concluido',
                concludedAt: new Date(),
              });
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmado': return '#27ae60';
      case 'cancelado': return '#e74c3c';
      case 'concluido': return '#8e44ad';
      default: return '#f39c12';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmado': return 'Confirmado';
      case 'cancelado': return 'Cancelado';
      case 'concluido': return 'Concluído';
      default: return 'Pendente';
    }
  };

  const renderAgendamento = ({ item }) => (
    <View style={styles.agendamentoCard}>
      <View style={styles.agendamentoHeader}>
        <View style={styles.clienteInfo}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {item.clienteNome ? item.clienteNome.charAt(0).toUpperCase() : 'C'}
            </Text>
          </View>
          <View style={styles.clienteDetails}>
            <Text style={styles.clienteNome}>{item.clienteNome || 'Cliente'}</Text>
            <Text style={styles.clienteEmail}>{item.cliente}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={styles.agendamentoInfo}>
        <Text style={styles.agendamentoData}>
          📅 {item.data} às {item.horario}
        </Text>
        <Text style={styles.agendamentoServico}>
          ✂️ {item.servico || 'Corte e barba'} · R$ {item.preco || '25,00'}
        </Text>
        <Text style={styles.agendamentoCreated}>
          Solicitado em: {formatDateTime(item.createdAt)}
        </Text>
      </View>

      {item.status === 'pendente' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.confirmarButton]}
            onPress={() => confirmar(item)}
          >
            <Text style={styles.actionButtonText}>Confirmar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelarButton]}
            onPress={() => cancelar(item)}
          >
            <Text style={styles.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'confirmado' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.concluirButton]}
            onPress={() => concluir(item)}
          >
            <Text style={styles.actionButtonText}>Marcar Concluído</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelarButton]}
            onPress={() => cancelar(item)}
          >
            <Text style={styles.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Carregando agendamentos...</Text>
      </View>
    );
  }

  const barbeiroNome = userProfile?.nome
    ? userProfile.nome.split(' ')[0]
    : 'Barbeiro';

  // CORRIGIDO: usa o uid real do barbeiro logado para o AnalyticsDashboard
  const barbeiroUid = auth.currentUser?.uid || '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {barbeiroNome}!</Text>
          <Text style={styles.title}>Painel do Barbeiro</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.perfilButton}
            onPress={() => navigation.navigate('Perfil')}
          >
            <Text style={styles.perfilButtonText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={() => setShowAnalytics(!showAnalytics)}
          >
            <Text style={styles.analyticsButtonText}>
              {showAnalytics ? 'Agenda' : 'Analytics'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
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
            <Text style={styles.profileButtonText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showAnalytics ? (
        // CORRIGIDO: passa o uid real do barbeiro logado
        <AnalyticsDashboard barbeiroId={barbeiroUid} />
      ) : (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.pendentes}</Text>
              <Text style={styles.statLabel}>Pendentes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.confirmados}</Text>
              <Text style={styles.statLabel}>Confirmados</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>

          <FlatList
            data={agendamentos}
            keyExtractor={(item) => item.id}
            renderItem={renderAgendamento}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhum agendamento encontrado</Text>
                <Text style={styles.emptySubtext}>
                  Os agendamentos aparecerão aqui quando os clientes solicitarem
                </Text>
              </View>
            }
            contentContainerStyle={agendamentos.length === 0 && styles.emptyList}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  greeting: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  perfilButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecf0f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfilButtonText: {
    fontSize: 18,
  },
  analyticsButton: {
    backgroundColor: '#9b59b6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  analyticsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  profileButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
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
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 4,
  },
  agendamentoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    backgroundColor: '#3498db',
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
    color: '#2c3e50',
  },
  clienteEmail: {
    fontSize: 13,
    color: '#7f8c8d',
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
    color: '#2c3e50',
    marginBottom: 4,
  },
  agendamentoServico: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  agendamentoCreated: {
    fontSize: 12,
    color: '#bdc3c7',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmarButton: {
    backgroundColor: '#27ae60',
  },
  cancelarButton: {
    backgroundColor: '#e74c3c',
  },
  concluirButton: {
    backgroundColor: '#9b59b6',
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
    color: '#7f8c8d',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bdc3c7',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
