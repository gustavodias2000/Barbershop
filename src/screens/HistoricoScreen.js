import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, auth } from '../../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  limit,
} from 'firebase/firestore';
import WhatsAppService from '../services/WhatsAppService';
import RatingComponent from '../components/RatingComponent';
import { liberarSlot } from '../services/OcupacaoService';
import { formatDateTime } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { getStatusColor, getStatusText } from '../utils/statusUtils';

const FILTROS = [
  { key: 'todos',     label: 'Todos' },
  { key: 'pendente',  label: 'Pendentes' },
  { key: 'confirmado',label: 'Confirmados' },
  { key: 'concluido', label: 'Concluídos' },
  { key: 'cancelado', label: 'Cancelados' },
];

export default function HistoricoScreen({ navigation }) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [showRating, setShowRating] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState(null);

  useEffect(() => {
    fetchAgendamentos();
  }, [filtro]);

  const fetchAgendamentos = async () => {
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) return;

      let q;
      if (filtro === 'todos') {
        q = query(
          collection(db, 'agendamentos'),
          where('cliente', '==', userEmail),
          orderBy('createdAt', 'desc'),
          limit(50),
        );
      } else {
        q = query(
          collection(db, 'agendamentos'),
          where('cliente', '==', userEmail),
          where('status', '==', filtro),
          orderBy('createdAt', 'desc'),
          limit(50),
        );
      }

      const snap = await getDocs(q);
      setAgendamentos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      Alert.alert('Erro', 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const cancelarAgendamento = async (agendamento) => {
    Alert.alert(
      'Cancelar Agendamento',
      'Tem certeza que deseja cancelar este agendamento?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'agendamentos', agendamento.id), {
                status: 'cancelado',
                cancelledAt: new Date(),
                cancelledBy: 'cliente',
              });

              await liberarSlot(
                agendamento.barbeiroId,
                agendamento.data,
                agendamento.horario,
              );

              const barbeiroPhone = agendamento.barbeiroTelefone;
              if (barbeiroPhone) {
                const mensagem = `Olá ${agendamento.barbeiroNome}!\n\nO cliente ${agendamento.clienteNome} cancelou o agendamento:\n\n📅 Data: ${agendamento.data}\n🕐 Horário: ${agendamento.horario}\n\nHorário liberado para outros clientes.`;
                await WhatsAppService.sendTextMessage(barbeiroPhone, mensagem);
              }

              Alert.alert('Sucesso', 'Agendamento cancelado com sucesso.');
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

  const reagendar = (agendamento) => {
    const barbeiro = {
      id: agendamento.barbeiroId,
      nome: agendamento.barbeiroNome,
      telefone: agendamento.barbeiroTelefone,
      especialidade: agendamento.servico,
      preco: agendamento.preco,
    };
    navigation.navigate('Agendamento', { barbeiro });
  };

  const renderAgendamento = ({ item }) => (
    <View style={s.agendamentoCard}>
      <View style={s.cardHeader}>
        <View style={s.barbeiroInfo}>
          <Text style={s.barbeiroNome}>{item.barbeiroNome}</Text>
          <Text style={s.servico}>{item.servico || 'Corte e barba'}</Text>
        </View>
        <View
          style={[s.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
          accessibilityLabel={`Status: ${getStatusText(item.status)}`}
        >
          <Text style={s.statusText}>{getStatusText(item.status)}</Text>
        </View>
      </View>

      <View style={s.agendamentoDetails}>
        <Text style={s.dataHorario}>
          📅 {item.data} às {item.horario}
        </Text>
        <Text style={s.preco}>💰 R$ {item.preco || '25,00'}</Text>
        <Text style={s.criadoEm}>
          Criado em: {formatDateTime(item.createdAt)}
        </Text>
      </View>

      {item.status === 'pendente' && (
        <View style={s.actionButtons}>
          <TouchableOpacity
            style={[s.actionButton, s.cancelButton]}
            accessibilityRole="button"
            accessibilityLabel="Cancelar este agendamento"
            onPress={() => cancelarAgendamento(item)}
          >
            <Text style={s.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {(item.status === 'cancelado' || item.status === 'concluido') && (
        <View style={s.actionButtons}>
          <TouchableOpacity
            style={[s.actionButton, s.reagendarButton]}
            accessibilityRole="button"
            accessibilityLabel={`Reagendar com ${item.barbeiroNome}`}
            onPress={() => reagendar(item)}
          >
            <Text style={s.actionButtonText}>Reagendar</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'confirmado' && (
        <View style={s.actionButtons}>
          <TouchableOpacity
            style={[s.actionButton, s.avaliarButton]}
            accessibilityRole="button"
            accessibilityLabel={`Avaliar ${item.barbeiroNome}`}
            onPress={() => {
              setSelectedAgendamento(item);
              setShowRating(true);
            }}
          >
            <Text style={s.actionButtonText}>Avaliar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionButton, s.cancelButton]}
            accessibilityRole="button"
            accessibilityLabel="Cancelar este agendamento"
            onPress={() => cancelarAgendamento(item)}
          >
            <Text style={s.actionButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderFiltros = () => (
    <View style={s.filtrosContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {FILTROS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[s.filtroButton, filtro === item.key && s.filtroButtonActive]}
            accessibilityRole="button"
            accessibilityLabel={`Filtrar por: ${item.label}`}
            accessibilityState={{ selected: filtro === item.key }}
            onPress={() => {
              setLoading(true);
              setFiltro(item.key);
            }}
          >
            <Text
              style={[
                s.filtroButtonText,
                filtro === item.key && s.filtroButtonTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={s.loadingText}>Carregando histórico...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.title}>Histórico de Agendamentos</Text>
      </View>

      {renderFiltros()}

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
            <Text style={s.emptyText}>
              {filtro === 'todos'
                ? 'Nenhum agendamento encontrado'
                : `Nenhum agendamento ${getStatusText(filtro).toLowerCase()} encontrado`}
            </Text>
            <Text style={s.emptySubtext}>
              Seus agendamentos aparecerão aqui
            </Text>
          </View>
        }
        contentContainerStyle={agendamentos.length === 0 && s.emptyList}
      />

      <RatingComponent
        visible={showRating}
        onClose={() => {
          setShowRating(false);
          setSelectedAgendamento(null);
          fetchAgendamentos();
        }}
        agendamento={selectedAgendamento}
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
    backgroundColor: theme.colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  filtrosContainer: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filtroButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 40,
    justifyContent: 'center',
  },
  filtroButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filtroButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  filtroButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  barbeiroInfo: {
    flex: 1,
    marginRight: 8,
  },
  barbeiroNome: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  servico: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
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
  agendamentoDetails: {
    marginBottom: 12,
  },
  dataHorario: {
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 4,
  },
  preco: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.success,
    marginBottom: 4,
  },
  criadoEm: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.error,
  },
  reagendarButton: {
    backgroundColor: theme.colors.primary,
  },
  avaliarButton: {
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
    fontSize: 17,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
