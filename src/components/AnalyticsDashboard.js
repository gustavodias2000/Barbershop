import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useTheme } from '../context/ThemeContext';
import { formatMoney, precoParaCentavos } from '../utils/dateUtils';

export default function AnalyticsDashboard({ barbeiroId }) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [analytics, setAnalytics] = useState({
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

      const agSnap = await getDocs(
        query(
          collection(db, 'agendamentos'),
          where('barbeiroId', '==', barbeiroId),
          orderBy('createdAt', 'desc'),
          limit(500),           // teto razoável; use Cloud Function em produção
        ),
      );
      const agendamentos = agSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const avSnap = await getDocs(
        query(collection(db, 'avaliacoes'), where('barbeiroId', '==', barbeiroId)),
      );
      const avaliacoes = avSnap.docs.map((d) => d.data());

      const totalAgendamentos = agendamentos.length;

      // Comparação por string local — sem risco de bug de timezone
      const agendamentosHoje = agendamentos.filter((ag) => ag.data === hojeStr).length;

      const agendamentosSemana = agendamentos.filter((ag) => {
        const ts = ag.createdAt?.toDate?.();
        return ts && ts >= inicioSemana;
      }).length;

      const agendamentosMes = agendamentos.filter((ag) => {
        const ts = ag.createdAt?.toDate?.();
        return ts && ts >= inicioMes;
      }).length;

      const avaliacaoMedia =
        avaliacoes.length > 0
          ? avaliacoes.reduce((sum, av) => sum + (av.rating || 0), 0) / avaliacoes.length
          : 0;

      // Faturamento: usa precoEmCentavos (int) se disponível, cai de volta para preco string
      const faturamentoMesCentavos = agendamentos
        .filter((ag) => {
          if (ag.status !== 'confirmado' && ag.status !== 'concluido') return false;
          const ts = ag.createdAt?.toDate?.();
          return ts && ts >= inicioMes;
        })
        .reduce((sum, ag) => {
          const cents =
            ag.precoEmCentavos != null
              ? ag.precoEmCentavos
              : precoParaCentavos(ag.preco);
          return sum + cents;
        }, 0);

      const horariosCount = {};
      agendamentos.forEach((ag) => {
        if (ag.horario) horariosCount[ag.horario] = (horariosCount[ag.horario] || 0) + 1;
      });
      const horariosPopulares = Object.entries(horariosCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([horario, count]) => ({ horario, count }));

      setAnalytics({
        totalAgendamentos,
        agendamentosHoje,
        agendamentosSemana,
        agendamentosMes,
        avaliacaoMedia: Math.round(avaliacaoMedia * 10) / 10,
        totalAvaliacoes: avaliacoes.length,
        faturamentoMesCentavos,
        horariosPopulares,
      });
    } catch (error) {
      console.error('Erro ao buscar analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCard = (title, value, subtitle, color) => (
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

const getStyles = (theme) =>
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
