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
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  limit,
} from 'firebase/firestore';
import WhatsAppService from '../services/WhatsAppService';
import NotificationService from '../services/NotificationService';
import { useTheme } from '../context/ThemeContext';
import { getStatusColor, getStatusText } from '../utils/statusUtils';
import { formatPreco } from '../utils/dateUtils';

export default function ClienteHome({ navigation }) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [barbeiros, setBarbeiros] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchAll();
    // Solicita permissão de push APÓS o login, no contexto correto da jornada
    NotificationService.init();
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
      if (userDoc.exists()) setUserProfile(userDoc.data());
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  const fetchBarbeiros = async () => {
    try {
      // Pagina os primeiros 50 barbeiros — suficiente para qualquer barbearia real
      const q = query(collection(db, 'barbeiros'), limit(50));
      const snap = await getDocs(q);
      setBarbeiros(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
        limit(20),
      );

      const snap = await getDocs(q);
      setAgendamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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

  const renderBarbeiro = ({ item }) => (
    <View style={s.barbeiroCard}>
      <View style={s.barbeiroInfo}>
        <View style={s.avatarContainer}>
          <Text style={s.avatarText} accessibilityElementsHidden>
            {item.nome ? item.nome.charAt(0).toUpperCase() : 'B'}
          </Text>
        </View>
        <View style={s.barbeiroDetails}>
          <Text style={s.barbeiroNome}>{item.nome || 'Barbeiro'}</Text>
          <Text style={s.barbeiroEspecialidade}>
            {item.especialidade || 'Corte e barba'}
          </Text>
          <Text style={s.barbeiroPreco}>{formatPreco(item)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={s.agendarButton}
        accessibilityRole="button"
        accessibilityLabel={`Agendar com ${item.nome || 'barbeiro'}`}
        onPress={() => navigation.navigate('Agendamento', { barbeiro: item })}
      >
        <Text style={s.agendarButtonText}>Agendar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAgendamento = ({ item }) => (
    <View style={s.agendamentoCard}>
      <View style={s.agendamentoHeader}>
        <Text style={s.agendamentoBarbeiro}>{item.barbeiroNome}</Text>
        <View
          style={[s.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
          accessibilityLabel={`Status: ${getStatusText(item.status)}`}
        >
          <Text style={s.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>
      <Text style={s.agendamentoData}>
        📅 {item.data} às {item.horario}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={s.loadingText}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  const nomeExibido = userProfile?.nome
    ? userProfile.nome.split(' ')[0]
    : auth.currentUser?.email?.split('@')[0] || 'Cliente';

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Olá, {nomeExibido}!</Text>
          <Text style={s.title}>Barbeiros Disponíveis</Text>
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
            style={s.historicoButton}
            accessibilityRole="button"
            accessibilityLabel="Ver histórico de agendamentos"
            onPress={() => navigation.navigate('Historico')}
          >
            <Text style={s.historicoButtonText}>Histórico</Text>
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

      <FlatList
        data={barbeiros}
        keyExtractor={(item) => item.id}
        renderItem={renderBarbeiro}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>Nenhum barbeiro disponível</Text>
            <Text style={s.emptySubtext}>Novos barbeiros serão exibidos aqui</Text>
          </View>
        }
        ListHeaderComponent={
          agendamentos.length > 0 ? (
            <View style={s.agendamentosSection}>
              <Text style={s.sectionTitle}>Meus Agendamentos</Text>
              {agendamentos.slice(0, 3).map((item) => (
                <View key={item.id}>{renderAgendamento({ item })}</View>
              ))}
              {agendamentos.length > 3 && (
                <TouchableOpacity
                  style={s.verMaisButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver todos os ${agendamentos.length} agendamentos`}
                  onPress={() => navigation.navigate('Historico')}
                >
                  <Text style={s.verMaisText}>
                    Ver todos ({agendamentos.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
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
    fontSize: 14,
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
  historicoButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  historicoButtonText: {
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
  agendamentosSection: {
    backgroundColor: theme.colors.surface,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  barbeiroCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
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
    backgroundColor: theme.colors.primary,
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
    color: theme.colors.text,
  },
  barbeiroEspecialidade: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  barbeiroPreco: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.success,
    marginTop: 4,
  },
  agendarButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  agendarButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  agendamentoCard: {
    backgroundColor: theme.colors.surfaceVariant,
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
    color: theme.colors.text,
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
    color: theme.colors.textSecondary,
  },
  verMaisButton: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  verMaisText: {
    color: theme.colors.primary,
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
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
