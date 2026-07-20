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
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import WhatsAppService from '../services/WhatsAppService';
import NotificationService from '../services/NotificationService';

export default function ClienteHome({ navigation }) {
  const [barbeiros, setBarbeiros] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchAll();
    // Configurar notificações push
    NotificationService.getFCMToken();
  }, []);

  const fetchAll = async () => {
    try {
      await Promise.all([fetchUserProfile(), fetchBarbeiros(), fetchAgendamentos()]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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

  const fetchBarbeiros = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'barbeiros'));
      const data = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBarbeiros(data);
    } catch (error) {
      console.error('Erro ao buscar barbeiros:', error);
    }
  };

  const fetchAgendamentos = async () => {
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) return;

      const q = query(
        collection(db, 'agendamentos'),
        where('cliente', '==', userEmail),
        orderBy('createdAt', 'desc'),
      );

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgendamentos(data);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchUserProfile(), fetchBarbeiros(), fetchAgendamentos()]);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setRefreshing(false);
    }
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

  const renderBarbeiro = ({ item }) => (
    <View style={styles.barbeiroCard}>
      <View style={styles.barbeiroInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {item.nome ? item.nome.charAt(0).toUpperCase() : 'B'}
          </Text>
        </View>
        <View style={styles.barbeiroDetails}>
          <Text style={styles.barbeiroNome}>{item.nome || 'Barbeiro'}</Text>
          <Text style={styles.barbeiroEspecialidade}>
            {item.especialidade || 'Corte e barba'}
          </Text>
          <Text style={styles.barbeiroPreco}>R$ {item.preco || '25,00'}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.agendarButton}
        onPress={() => navigation.navigate('Agendamento', { barbeiro: item })}
      >
        <Text style={styles.agendarButtonText}>Agendar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAgendamento = ({ item }) => (
    <View style={styles.agendamentoCard}>
      <View style={styles.agendamentoHeader}>
        <Text style={styles.agendamentoBarbeiro}>{item.barbeiroNome}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.agendamentoData}>
        📅 {item.data} às {item.horario}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  const nomeExibido = userProfile?.nome
    ? userProfile.nome.split(' ')[0]
    : auth.currentUser?.email?.split('@')[0] || 'Cliente';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá, {nomeExibido}!</Text>
          <Text style={styles.title}>Barbeiros Disponíveis</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.perfilButton}
            onPress={() => navigation.navigate('Perfil')}
          >
            <Text style={styles.perfilButtonText}>👤</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.historicoButton}
            onPress={() => navigation.navigate('Historico')}
          >
            <Text style={styles.historicoButtonText}>Histórico</Text>
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

      <FlatList
        data={barbeiros}
        keyExtractor={(item) => item.id}
        renderItem={renderBarbeiro}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum barbeiro disponível</Text>
            <Text style={styles.emptySubtext}>Novos barbeiros serão exibidos aqui</Text>
          </View>
        }
        ListHeaderComponent={
          agendamentos.length > 0 ? (
            <View style={styles.agendamentosSection}>
              <Text style={styles.sectionTitle}>Meus Agendamentos</Text>
              {agendamentos.slice(0, 3).map((item) => (
                <View key={item.id}>{renderAgendamento({ item })}</View>
              ))}
              {agendamentos.length > 3 && (
                // CORRIGIDO: botão "Ver todos" agora navega para Historico
                <TouchableOpacity
                  style={styles.verMaisButton}
                  onPress={() => navigation.navigate('Historico')}
                >
                  <Text style={styles.verMaisText}>
                    Ver todos ({agendamentos.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
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
    fontSize: 14,
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
  historicoButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  historicoButtonText: {
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
  agendamentosSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  // CORRIGIDO: barbeiroCard agora tem estrutura correta (View fechada)
  barbeiroCard: {
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
  barbeiroInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  barbeiroDetails: {
    flex: 1,
  },
  barbeiroNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  barbeiroEspecialidade: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  barbeiroPreco: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27ae60',
    marginTop: 4,
  },
  agendarButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  agendarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  agendamentoCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  agendamentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  agendamentoBarbeiro: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    marginRight: 8,
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
  agendamentoData: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  verMaisButton: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  verMaisText: {
    color: '#3498db',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bdc3c7',
    textAlign: 'center',
  },
});
