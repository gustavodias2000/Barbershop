/**
 * BarbeiroHome — aba "Agenda" do Bottom Tab Navigator do barbeiro.
 * Exibe os agendamentos do dia, stats e ações (confirmar/cancelar/concluir).
 */
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
import { auth } from '../../firebaseConfig';
import WhatsAppService from '../services/WhatsAppService';
import {
  listarDoBarbeiro,
  listarPorNegocio,
  atualizarStatus,
} from '../data/repositories/AgendamentoRepository';
import { getNegocioPorDono, getMembro } from '../data/repositories/NegocioRepository';
import { liberarSlot } from '../services/OcupacaoService';
import useUserProfile from '../hooks/useUserProfile';
import { formatDateTime, formatPreco } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import { getStatusColor, getStatusText } from '../utils/statusUtils';
import { SkeletonList } from '../components/Skeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_KEY } from './OnboardingScreen';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Agendamento } from '../types';

// Pode ser chamado tanto de um tab navigator quanto do stack diretamente
type Props = CompositeScreenProps<
  BottomTabScreenProps<any, 'Agenda'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function BarbeiroHome({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const { profile: userProfile, refresh: refreshProfile } = useUserProfile();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ pendentes: 0, confirmados: 0, total: 0 });
  // Presente quando o usuário logado é dono de uma equipe — nesse caso a
  // agenda mostra os agendamentos de TODOS os profissionais do negócio.
  const [negocioId, setNegocioId] = useState<string | null>(null);

  useEffect(() => {
    checkOnboarding();
    fetchAgendamentos().finally(() => setLoading(false));
  }, []);

  const checkOnboarding = async () => {
    try {
      const visto = await AsyncStorage.getItem(ONBOARDING_KEY.barbeiro);
      if (!visto) {
        navigation.navigate('Onboarding', { tipo: 'barbeiro' });
      }
    } catch (_) {}
  };

  const fetchAgendamentos = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const negocio = await getNegocioPorDono(uid);
      setNegocioId(negocio?.id ?? null);
      let data: Agendamento[];
      if (negocio) {
        // `listarPorNegocio` só enxerga agendamentos criados DEPOIS que a
        // conta virou equipe (negocioId denormalizado). Sem isso, os
        // agendamentos antigos do próprio dono (sem negocioId) sumiriam da
        // agenda assim que ele criasse a equipe. Busca as duas fontes e
        // remove duplicatas (agendamentos novos do dono aparecem nas duas).
        const [doNegocio, proprios] = await Promise.all([
          listarPorNegocio(negocio.id, 50),
          listarDoBarbeiro(uid, 50),
        ]);
        const porId = new Map<string, Agendamento>();
        [...doNegocio, ...proprios].forEach((ag) => {
          if (ag.id) porId.set(ag.id, ag);
        });
        data = Array.from(porId.values()).sort((a, b) => {
          const aMs = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
          const bMs = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
      } else {
        data = await listarDoBarbeiro(uid, 50);
      }
      setAgendamentos(data);
      setStats({
        pendentes:  data.filter((ag) => ag.status === 'pendente').length,
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

  const confirmar = async (ag: Agendamento) => {
    Alert.alert('Confirmar', `Confirmar agendamento de ${ag.clienteNome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            await atualizarStatus(ag.id, 'confirmado');
            if (ag.clienteTelefone) {
              const barbeiroNome = userProfile?.nome || auth.currentUser?.email?.split('@')[0] || 'Barbeiro';
              const msg = WhatsAppService.gerarMensagemConfirmacao(
                { nome: ag.clienteNome, telefone: ag.clienteTelefone },
                ag.data, ag.horario, barbeiroNome,
              );
              const enviado = await WhatsAppService.sendTextMessage(ag.clienteTelefone, msg);
              Alert.alert('Sucesso!', enviado
                ? 'Confirmado e cliente notificado via WhatsApp!'
                : 'Confirmado. Cliente sem WhatsApp cadastrado.');
            } else {
              Alert.alert('Sucesso!', 'Agendamento confirmado.');
            }
            await fetchAgendamentos();
          } catch {
            Alert.alert('Erro', 'Não foi possível confirmar.');
          }
        },
      },
    ]);
  };

  const cancelar = async (ag: Agendamento) => {
    Alert.alert('Cancelar', `Cancelar agendamento de ${ag.clienteNome}?`, [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await atualizarStatus(ag.id, 'cancelado', { cancelledBy: 'barbeiro' });
            await liberarSlot(ag.barbeiroId, ag.data, ag.horario);
            if (ag.clienteTelefone) {
              const msg = WhatsAppService.gerarMensagemCancelamento(
                { nome: ag.clienteNome, telefone: ag.clienteTelefone },
                ag.data, ag.horario, 'Reagendamento necessário',
              );
              await WhatsAppService.sendTextMessage(ag.clienteTelefone, msg);
            }
            Alert.alert('Cancelado', 'Agendamento cancelado.');
            await fetchAgendamentos();
          } catch {
            Alert.alert('Erro', 'Não foi possível cancelar.');
          }
        },
      },
    ]);
  };

  const concluir = async (ag: Agendamento) => {
    Alert.alert('Concluir', `Marcar atendimento de ${ag.clienteNome} como concluído?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Concluir',
        onPress: async () => {
          try {
            const extras: Record<string, unknown> = {};
            // Calcula a comissão do profissional (se a equipe tiver uma
            // configurada) no momento em que o atendimento é concluído.
            if (ag.negocioId && ag.precoEmCentavos) {
              const membro = await getMembro(ag.negocioId, ag.barbeiroId);
              if (membro?.comissaoTipo === 'percentual' && membro.comissaoPercentual) {
                extras.comissaoCentavos = Math.round(
                  (ag.precoEmCentavos * membro.comissaoPercentual) / 100,
                );
              } else if (membro?.comissaoTipo === 'fixo' && membro.comissaoFixaCentavos) {
                extras.comissaoCentavos = membro.comissaoFixaCentavos;
              }
            }
            await atualizarStatus(ag.id, 'concluido', extras);
            Alert.alert('Sucesso!', 'Atendimento concluído.');
            await fetchAgendamentos();
          } catch {
            Alert.alert('Erro', 'Não foi possível concluir.');
          }
        },
      },
    ]);
  };

  const barbeiroUid = auth.currentUser?.uid ?? '';

  const renderAgendamento = ({ item }: { item: Agendamento }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.clienteInfo}>
          <View style={s.avatar} accessibilityElementsHidden>
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

      <View style={s.cardBody}>
        {negocioId && item.barbeiroNome && (
          <Text style={s.infoProfissional}>💈 {item.barbeiroNome}</Text>
        )}
        <Text style={s.infoData}>📅 {item.data} às {item.horario}</Text>
        <Text style={s.infoServico}>✂️ {item.servico || 'Corte e barba'} · {formatPreco(item)}</Text>
        <Text style={s.infoCreated}>Solicitado em: {formatDateTime(item.createdAt)}</Text>
        {item.clienteUid ? (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('HistoricoCliente', {
                clienteUid: item.clienteUid,
                clienteNome: item.clienteNome,
                barbeiroId: item.barbeiroId || barbeiroUid,
              })
            }
            accessibilityRole="button"
          >
            <Text style={s.verHistorico}>📋 Ver histórico do cliente</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {item.status === 'pendente' && (
        <View style={s.actions}>
          <TouchableOpacity style={[s.btn, s.btnConfirmar]} onPress={() => confirmar(item)}>
            <Text style={s.btnText}>Confirmar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnCancelar]} onPress={() => cancelar(item)}>
            <Text style={s.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status === 'confirmado' && (
        <View style={s.actions}>
          <TouchableOpacity style={[s.btn, s.btnConcluir]} onPress={() => concluir(item)}>
            <Text style={s.btnText}>Marcar Concluído</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnCancelar]} onPress={() => cancelar(item)}>
            <Text style={s.btnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  const barbeiroNome = userProfile?.nome
    ? userProfile.nome.split(' ')[0]
    : 'Barbeiro';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header simples — sem botões de navegação (movidos para tabs) */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Olá, {barbeiroNome}!</Text>
          <Text style={s.title}>Agenda</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={s.stats}>
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
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>Nenhum agendamento</Text>
            <Text style={s.emptyDesc}>
              Os agendamentos dos clientes aparecerão aqui.{'\n'}
              Configure seus serviços na aba Configurações.
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  greeting: { fontSize: 13, color: theme.colors.textSecondary },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  stats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  statNumber: { fontSize: 24, fontWeight: '800', color: theme.colors.primary },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clienteInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#000', fontSize: 16, fontWeight: '800' },
  clienteDetails: { flex: 1 },
  clienteNome: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  clienteEmail: { fontSize: 13, color: theme.colors.textSecondary },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardBody: { marginBottom: 12 },
  infoProfissional: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, marginBottom: 4 },
  infoData: { fontSize: 15, color: theme.colors.text, marginBottom: 3 },
  infoServico: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 3 },
  infoCreated: { fontSize: 12, color: theme.colors.textMuted },
  verHistorico: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 6,
  },
  actions: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  btnConfirmar: { backgroundColor: theme.colors.success },
  btnCancelar: { backgroundColor: theme.colors.error },
  btnConcluir: { backgroundColor: '#8e44ad' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  emptyDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
