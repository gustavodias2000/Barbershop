/**
 * ClienteAgendamentosTab — aba "Meus Horários" do cliente.
 * Mostra agendamentos futuros (destaque) e histórico.
 */
import React, { useEffect, useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../../firebaseConfig';
import {
  listarDoCliente,
  atualizarStatus,
} from '../../data/repositories/AgendamentoRepository';
import { liberarSlot } from '../../services/OcupacaoService';
import WhatsAppService from '../../services/WhatsAppService';
import { useTheme, type Theme } from '../../context/ThemeContext';
import { getStatusColor, getStatusText } from '../../utils/statusUtils';
import { SkeletonList } from '../../components/Skeleton';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Agendamento } from '../../types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<any, 'Agendamentos'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ClienteAgendamentosTab({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Recarrega sempre que a aba fica em foco (ex: após agendar)
  useFocusEffect(
    useCallback(() => {
      fetchAgendamentos();
    }, []),
  );

  const fetchAgendamentos = async () => {
    try {
      const uid = auth.currentUser?.uid;
      const data = await listarDoCliente(uid, { max: 50 });
      setAgendamentos(data);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAgendamentos();
  };

  const cancelar = (item: Agendamento) => {
    Alert.alert(
      'Cancelar Agendamento',
      `Cancelar o horário de ${item.horario} com ${item.barbeiroNome}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await atualizarStatus(item.id, 'cancelado', { cancelledBy: 'cliente' });
              await liberarSlot(item.barbeiroId, item.data, item.horario);
              if (item.barbeiroTelefone) {
                const msg = `Olá ${item.barbeiroNome}!\n\nO cliente ${item.clienteNome} cancelou:\n📅 ${item.data} às ${item.horario}`;
                await WhatsAppService.sendTextMessage(item.barbeiroTelefone, msg);
              }
              Alert.alert('Cancelado', 'Agendamento cancelado com sucesso.');
              fetchAgendamentos();
            } catch {
              Alert.alert('Erro', 'Não foi possível cancelar. Tente novamente.');
            }
          },
        },
      ],
    );
  };

  const reagendar = (item: Agendamento) => {
    navigation.navigate('Agendamento', {
      barbeiro: {
        id: item.barbeiroId,
        nome: item.barbeiroNome,
        telefone: item.barbeiroTelefone,
        especialidade: item.servico,
        preco: item.preco,
      } as any,
    });
  };

  const renderItem = ({ item }: { item: Agendamento }) => {
    const ativo = item.status === 'pendente' || item.status === 'confirmado';
    return (
      <View style={[s.card, ativo && s.cardAtivo]}>
        <View style={s.cardHeader}>
          <View style={s.barbeiroInfo}>
            <Text style={s.barbeiroNome}>{item.barbeiroNome}</Text>
            <Text style={s.servico}>{item.servico || 'Corte e barba'}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={s.badgeText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <Text style={s.data}>📅 {item.data} às {item.horario}</Text>

        {ativo && (
          <View style={s.actions}>
            <TouchableOpacity
              style={s.btnReagendar}
              onPress={() => reagendar(item)}
              accessibilityRole="button"
            >
              <Text style={s.btnReagendarText}>Reagendar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnCancelar}
              onPress={() => cancelar(item)}
              accessibilityRole="button"
            >
              <Text style={s.btnCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  const ativos = agendamentos.filter(
    (a) => a.status === 'pendente' || a.status === 'confirmado',
  );
  const historico = agendamentos.filter(
    (a) => a.status !== 'pendente' && a.status !== 'confirmado',
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Meus Horários</Text>
        <Text style={s.subtitle}>{agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''} no total</Text>
      </View>

      <FlatList
        data={[...ativos, ...historico]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          ativos.length > 0 ? (
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>PRÓXIMOS</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>Nenhum agendamento</Text>
            <Text style={s.emptyDesc}>
              Vá na aba Barbeiros e agende o seu horário!
            </Text>
          </View>
        }
        contentContainerStyle={agendamentos.length === 0 && s.emptyContainer}
      />
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    elevation: 2,
  },
  cardAtivo: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  barbeiroInfo: { flex: 1, marginRight: 8 },
  barbeiroNome: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  servico: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  data: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  btnReagendar: {
    flex: 1,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnReagendarText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  btnCancelar: {
    flex: 1,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.error,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnCancelarText: { fontSize: 14, fontWeight: '600', color: theme.colors.error },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
});
