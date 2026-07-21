import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { db } from '../../firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  getCountFromServer,
  getAggregateFromServer,
  count,
  sum,
  average,
} from 'firebase/firestore';
import { useTheme, type Theme } from '../context/ThemeContext';
import { formatMoney } from '../utils/dateUtils';
import type { Agendamento } from '../types';

interface HorarioPopular {
  horario: string;
  count: number;
}

interface AnalyticsData {
  totalAgendamentos: number;
  agendamentosHoje: number;
  agendamentosSemana: number;
  agendamentosMes: number;
  avaliacaoMedia: number;
  totalAvaliacoes: number;
  faturamentoMesCentavos: number;
  horariosPopulares: HorarioPopular[];
}

export default function AnalyticsDashboard({ barbeiroId }: { barbeiroId: string }) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalAgendamentos: 0,
    agendamentosHoje: 0,
    agendamentosSemana: 0,
    agendamentosMes: 0,
    avaliacaoMedia: 0,
    totalAvaliacoes: 0,
    faturamentoMesCentavos: 0,
    horariosPopulares: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (barbeiroId) fetchAnalytics();
  }, [barbeiroId]);

  /**
   * Item 20 da auditoria: métricas via AGREGAÇÃO SERVER-SIDE do Firestore
   * (count/sum/average). O cálculo acontece no servidor do Google e o app
   * recebe apenas o número final — ~1 leitura por 1000 registros varridos,
   * em vez de baixar centenas de documentos. Escala para qualquer volume.
   */
  const fetchAnalytics = async () => {
    try {
      const hoje = new Date();

      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      inicioSemana.setHours(0, 0, 0, 0);

      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      // "Hoje" em string local YYYY-MM-DD — evita bug UTC
      const hojeStr = [
        hoje.getFullYear(),
        String(hoje.getMonth() + 1).padStart(2, '0'),
        String(hoje.getDate()).padStart(2, '0'),
      ].join('-');

      const ags = collection(db, 'agendamentos');
      const doBarbeiro = where('barbeiroId', '==', barbeiroId);

      const [
        totalSnap,
        hojeSnap,
        semanaSnap,
        mesSnap,
        avaliacoesSnap,
        faturamentoSnap,
        recentesSnap,
      ] = await Promise.all([
        // Contagens — o servidor conta, o app recebe só o número
        getCountFromServer(query(ags, doBarbeiro)),
        getCountFromServer(query(ags, doBarbeiro, where('data', '==', hojeStr))),
        getCountFromServer(
          query(ags, doBarbeiro, where('createdAt', '>=', inicioSemana)),
        ),
        getCountFromServer(query(ags, doBarbeiro, where('createdAt', '>=', inicioMes))),

        // Avaliações — média e total em uma única agregação
        getAggregateFromServer(
          query(collection(db, 'avaliacoes'), where('barbeiroId', '==', barbeiroId)),
          { media: average('rating'), total: count() },
        ),

        // Faturamento do mês — soma de centavos no servidor.
        // (Docs antigos sem precoEmCentavos não entram na soma; novos sempre têm.)
        getAggregateFromServer(
          query(
            ags,
            doBarbeiro,
            where('status', 'in', ['confirmado', 'concluido']),
            where('createdAt', '>=', inicioMes),
          ),
          { total: sum('precoEmCentavos') },
        ),

        // Horários populares: única métrica que precisa dos docs —
        // amostra dos 100 agendamentos mais recentes
        getDocs(query(ags, doBarbeiro, orderBy('createdAt', 'desc'), limit(100))),
      ]);

      const horariosCount: Record<string, number> = {};
      recentesSnap.docs.forEach((d) => {
        const ag = d.data() as Agendamento;
        if (ag.horario) horariosCount[ag.horario] = (horariosCount[ag.horario] || 0) + 1;
      });
      const horariosPopulares: HorarioPopular[] = Object.entries(horariosCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([horario, qtd]) => ({ horario, count: qtd }));

      const media = avaliacoesSnap.data().media ?? 0;

      setAnalytics({
        totalAgendamentos: totalSnap.data().count,
        agendamentosHoje: hojeSnap.data().count,
        agendamentosSemana: semanaSnap.data().count,
        agendamentosMes: mesSnap.data().count,
        avaliacaoMedia: Math.round(media * 10) / 10,
        totalAvaliacoes: avaliacoesSnap.data().total,
        faturamentoMesCentavos: faturamentoSnap.data().total,
        horariosPopulares,
      });
    } catch (error) {
      console.error('Erro ao buscar analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCard = (
    title: string,
    value: string | number,
    subtitle: string,
    color: string,
  ) => (
    <View style={[s.card, { borderLeftColor: color }]}>
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={[s.cardValue, { color }]}>{value}</Text>
      {subtitle ? <Text style={s.cardSubtitle}>{subtitle}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={s.loadingText}>Carregando métricas...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container}>
      <Text style={s.sectionTitle}>Resumo Geral</Text>
      <View style={s.row}>
        {renderCard('Hoje', analytics.agendamentosHoje, 'agendamentos', theme.colors.error)}
        {renderCard('Semana', analytics.agendamentosSemana, 'agendamentos', '#f39c12')}
      </View>
      <View style={s.row}>
        {renderCard('Mês', analytics.agendamentosMes, 'agendamentos', theme.colors.success)}
        {renderCard('Total', analytics.totalAgendamentos, 'agendamentos', theme.colors.primary)}
      </View>

      <Text style={s.sectionTitle}>Performance</Text>
      <View style={s.row}>
        {renderCard(
          'Avaliação',
          `${analytics.avaliacaoMedia}/5`,
          `${analytics.totalAvaliacoes} avaliações`,
          '#9b59b6',
        )}
        {renderCard(
          'Faturamento Mês',
          formatMoney(analytics.faturamentoMesCentavos),
          'confirmados + concluídos',
          theme.colors.success,
        )}
      </View>

      {analytics.horariosPopulares.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Horários Mais Populares</Text>
          <View style={s.popularContainer}>
            {analytics.horariosPopulares.map((item, index) => (
              <View key={index} style={s.popularRow}>
                <Text style={s.popularHour}>{item.horario}</Text>
                <Text style={s.popularCount}>{item.count} agendamentos</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginHorizontal: 16,
      marginTop: 20,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      marginHorizontal: 16,
      gap: 12,
      marginBottom: 12,
    },
    card: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 12,
      borderLeftWidth: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    cardValue: {
      fontSize: 22,
      fontWeight: 'bold',
      marginBottom: 2,
    },
    cardSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    popularContainer: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    popularRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    popularHour: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    popularCount: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });
