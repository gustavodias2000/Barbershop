/**
 * InicioScreen — aba "Início" do barbeiro: painel-resumo do dia e da semana,
 * agora a tela de entrada no lugar da Agenda (que virou uma aba própria).
 *
 * Inspirado no dashboard do app Masters (referência trazida pelo Gustavo),
 * adaptado ao que o Barbershop já modela — sem "despesas"/"vendas
 * projetadas", que não existem no app hoje.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../firebaseConfig';
import {
  listarPorBarbeiroEPeriodo,
  contarPendentesDoBarbeiro,
} from '../data/repositories/AgendamentoRepository';
import { listarClientesDoBarbeiro } from '../data/repositories/ClienteContatoRepository';
import { listarFilaDoBarbeiro } from '../data/repositories/ListaEsperaRepository';
import useUserProfile from '../hooks/useUserProfile';
import { toLocalDateString, formatMoney, diasAteProximoAniversario, toDateObj } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import { ONBOARDING_KEY } from './OnboardingScreen';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, ClienteContato } from '../types';

// Pode ser chamado tanto de um tab navigator quanto do stack diretamente
type Props = CompositeScreenProps<
  BottomTabScreenProps<any, 'Inicio'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface DiaSemana {
  data: string;
  label: string;
  diaMes: string;
  compromissos: number;
  somaCentavos: number;
  hoje: boolean;
}

interface Aviso {
  icon: string;
  texto: string;
  onPress: () => void;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const capitalizar = (texto: string): string =>
  texto.length > 0 ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;

export default function InicioScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  const { profile } = useUserProfile();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [semana, setSemana] = useState<DiaSemana[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [filaEspera, setFilaEspera] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [novosClientesMes, setNovosClientesMes] = useState(0);
  const [aniversariantesSemana, setAniversariantesSemana] = useState<ClienteContato[]>([]);

  useEffect(() => {
    checkOnboarding();
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, []),
  );

  const checkOnboarding = async () => {
    try {
      const visto = await AsyncStorage.getItem(ONBOARDING_KEY.barbeiro);
      if (!visto) {
        navigation.navigate('Onboarding', { tipo: 'barbeiro' });
      }
    } catch (_) {}
  };

  const carregar = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const hoje = new Date();
      const hojeStr = toLocalDateString(hoje);
      const domingo = new Date(hoje);
      domingo.setDate(hoje.getDate() - hoje.getDay());
      const sabado = new Date(domingo);
      sabado.setDate(domingo.getDate() + 6);
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      const [agendamentosSemana, totalPendentes, fila, clientes] = await Promise.all([
        listarPorBarbeiroEPeriodo(uid, toLocalDateString(domingo), toLocalDateString(sabado)),
        contarPendentesDoBarbeiro(uid),
        listarFilaDoBarbeiro(uid),
        listarClientesDoBarbeiro(uid),
      ]);

      const dias: DiaSemana[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(domingo);
        d.setDate(domingo.getDate() + i);
        const dataStr = toLocalDateString(d);
        const doDia = agendamentosSemana.filter(
          (ag) => ag.data === dataStr && ag.status !== 'cancelado',
        );
        const somaCentavos = doDia
          .filter((ag) => ag.status === 'confirmado' || ag.status === 'concluido')
          .reduce((acc, ag) => acc + (ag.precoEmCentavos || 0), 0);
        return {
          data: dataStr,
          label: DIAS_SEMANA[i],
          diaMes: String(d.getDate()),
          compromissos: doDia.length,
          somaCentavos,
          hoje: dataStr === hojeStr,
        };
      });

      setSemana(dias);
      setPendentes(totalPendentes);
      setFilaEspera(fila.length);
      setTotalClientes(clientes.length);
      setNovosClientesMes(
        clientes.filter((c) => {
          const criadoEm = toDateObj(c.createdAt);
          return !!criadoEm && criadoEm >= inicioMes;
        }).length,
      );
      // Mesma lógica da AniversariantesScreen: "essa semana" = próximos 6 dias
      // (0 = hoje), sem contar quem já passou (volta pro ano seguinte).
      setAniversariantesSemana(
        clientes.filter(
          (c): c is ClienteContato & { aniversario: string } =>
            !!c.aniversario && diasAteProximoAniversario(c.aniversario) <= 6,
        ),
      );
    } catch (error) {
      console.error('Erro ao carregar painel inicial:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  };

  const hojeInfo = semana.find((d) => d.hoje);
  const dataExtenso = capitalizar(
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
  );
  const primeiroNome = (profile?.nome || 'Barbeiro').split(' ')[0];

  const avisos: Aviso[] = [];
  if (pendentes > 0) {
    avisos.push({
      icon: '🔔',
      texto: `${pendentes} agendamento${pendentes === 1 ? '' : 's'} aguardando confirmação`,
      onPress: () => navigation.navigate('Agenda' as any),
    });
  }
  if (filaEspera > 0) {
    avisos.push({
      icon: '⏳',
      texto: `${filaEspera} cliente${filaEspera === 1 ? '' : 's'} na lista de espera`,
      onPress: () => navigation.navigate('ListaEspera'),
    });
  }
  if (aniversariantesSemana.length > 0) {
    avisos.push({
      icon: '🎂',
      texto: `${aniversariantesSemana.length} aniversariante${aniversariantesSemana.length === 1 ? '' : 's'} essa semana`,
      onPress: () => navigation.navigate('Aniversariantes'),
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <Text style={s.saudacao}>Olá, {primeiroNome} 👋</Text>
        <Text style={s.data}>{dataExtenso}</Text>

        {/* Hoje */}
        <View style={s.heroCard}>
          <View style={s.heroRow}>
            <View style={s.heroMetric}>
              <Text style={s.heroValue}>{hojeInfo?.compromissos ?? 0}</Text>
              <Text style={s.heroLabel}>
                compromisso{(hojeInfo?.compromissos ?? 0) === 1 ? '' : 's'} hoje
              </Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroMetric}>
              <Text style={s.heroValue}>{formatMoney(hojeInfo?.somaCentavos ?? 0)}</Text>
              <Text style={s.heroLabel}>previsto hoje</Text>
            </View>
          </View>
          <View style={s.heroActions}>
            <TouchableOpacity
              style={s.heroButtonPrimary}
              onPress={() => navigation.navigate('AgendamentoManual')}
              accessibilityRole="button"
              accessibilityLabel="Criar novo agendamento"
            >
              <Text style={s.heroButtonPrimaryText}>＋ Agendar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.heroButtonSecondary}
              onPress={() => navigation.navigate('Agenda' as any)}
              accessibilityRole="button"
              accessibilityLabel="Ver agenda completa"
            >
              <Text style={s.heroButtonSecondaryText}>Ver agenda</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Avisos */}
        {avisos.length > 0 ? (
          <View style={s.card}>
            {avisos.map((aviso, i) => (
              <TouchableOpacity
                key={aviso.texto}
                style={[s.avisoRow, i === avisos.length - 1 && s.rowLast]}
                onPress={aviso.onPress}
                accessibilityRole="button"
                accessibilityLabel={aviso.texto}
              >
                <Text style={s.avisoIcon}>{aviso.icon}</Text>
                <Text style={s.avisoTexto}>{aviso.texto}</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={[s.card, s.tudoEmDiaCard]}>
            <Text style={s.tudoEmDia}>Tudo em dia por aqui 👍</Text>
          </View>
        )}

        {/* Esta semana */}
        <Text style={s.sectionTitle}>Esta semana</Text>
        <View style={s.card}>
          {semana.map((dia, i) => (
            <View
              key={dia.data}
              style={[s.semanaRow, i === semana.length - 1 && s.rowLast, dia.hoje && s.semanaRowHoje]}
            >
              <Text style={[s.semanaDia, dia.hoje && s.semanaDiaHoje]}>
                {dia.label} {dia.diaMes}
              </Text>
              <Text style={s.semanaCompromissos}>
                {dia.compromissos} comprom.
              </Text>
              <Text style={s.semanaSoma}>{formatMoney(dia.somaCentavos)}</Text>
            </View>
          ))}
        </View>

        {/* Clientes */}
        <Text style={s.sectionTitle}>Clientes</Text>
        <TouchableOpacity
          style={s.card}
          onPress={() => navigation.navigate('Clientes')}
          accessibilityRole="button"
          accessibilityLabel="Ver clientes"
        >
          <View style={s.clientesRow}>
            <View style={s.clientesMetric}>
              <Text style={s.clientesValor}>{totalClientes}</Text>
              <Text style={s.clientesLabel}>na agenda</Text>
            </View>
            <View style={s.clientesMetric}>
              <Text style={s.clientesValor}>{novosClientesMes}</Text>
              <Text style={s.clientesLabel}>novos este mês</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Relatórios */}
        <TouchableOpacity
          style={s.linkCard}
          onPress={() => navigation.navigate('Analytics' as any)}
          accessibilityRole="button"
          accessibilityLabel="Ver relatórios completos"
        >
          <Text style={s.linkIcon}>📊</Text>
          <Text style={s.linkTexto}>Ver relatórios completos</Text>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  saudacao: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  data: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2, marginBottom: 16 },

  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroMetric: { flex: 1 },
  heroValue: { fontSize: 30, fontWeight: '800', color: '#FFFFFF' },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 12,
  },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroButtonPrimary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  heroButtonPrimaryText: { color: theme.colors.primary, fontWeight: '700', fontSize: 14 },
  heroButtonSecondary: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  heroButtonSecondaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },

  avisoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  avisoIcon: { fontSize: 20, marginRight: 12 },
  avisoTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  chevron: { fontSize: 22, color: theme.colors.textMuted, marginLeft: 8 },

  tudoEmDiaCard: { paddingVertical: 20, alignItems: 'center' },
  tudoEmDia: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600' },

  semanaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  semanaRowHoje: { backgroundColor: theme.colors.primary + '15' },
  semanaDia: { flex: 1.1, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  semanaDiaHoje: { color: theme.colors.primary, fontWeight: '800' },
  semanaCompromissos: { flex: 1, fontSize: 13, color: theme.colors.text, textAlign: 'center' },
  semanaSoma: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.text, textAlign: 'right' },

  clientesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  clientesMetric: { flex: 1 },
  clientesValor: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  clientesLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  linkIcon: { fontSize: 20, marginRight: 12 },
  linkTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text },
});
