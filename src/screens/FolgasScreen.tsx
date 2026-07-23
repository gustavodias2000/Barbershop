/**
 * FolgasScreen — o barbeiro marca datas específicas como indisponíveis
 * (férias, feriados, imprevistos). Essas datas somem do calendário do
 * cliente em AgendamentoScreen, evitando agendamentos em dias que o
 * barbeiro não vai atender.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { upsertBarbeiro, getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { toLocalDateString } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Folgas'>;

// Quantos dias à frente o barbeiro pode marcar folga
const DIAS_A_FRENTE = 90;

interface DiaCandidato {
  date: string;
  diaSemana: string;
  diaMes: string;
  mes: string;
}

function gerarProximosDias(qtd: number): DiaCandidato[] {
  const result: DiaCandidato[] = [];
  const hoje = new Date();
  for (let i = 0; i <= qtd; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    result.push({
      date: toLocalDateString(d),
      diaSemana: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      diaMes: String(d.getDate()).padStart(2, '0'),
      mes: d.toLocaleDateString('pt-BR', { month: 'short' }),
    });
  }
  return result;
}

export default function FolgasScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [bloqueadas, setBloqueadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dias = useMemo(() => gerarProximosDias(DIAS_A_FRENTE), []);

  useEffect(() => {
    loadFolgas();
  }, []);

  const loadFolgas = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const barbeiro = await getBarbeiro(uid);
      setBloqueadas(new Set(barbeiro?.datasBloqueadas ?? []));
    } catch (error) {
      console.error('Erro ao carregar folgas:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDia = (date: string) => {
    setBloqueadas((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await upsertBarbeiro(uid, {
        datasBloqueadas: Array.from(bloqueadas).sort(),
      });
      Alert.alert('Sucesso!', 'Dias de folga salvos.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao salvar folgas:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.hintCard}>
        <Text style={s.hintText}>
          Toque em uma data para bloqueá-la. Datas bloqueadas não aparecem
          para os clientes no calendário de agendamento.
        </Text>
        {bloqueadas.size > 0 && (
          <Text style={s.countText}>
            {bloqueadas.size} {bloqueadas.size === 1 ? 'dia bloqueado' : 'dias bloqueados'}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={s.grid}>
        {dias.map((dia) => {
          const isBloqueada = bloqueadas.has(dia.date);
          return (
            <TouchableOpacity
              key={dia.date}
              style={[s.diaCard, isBloqueada && s.diaCardBloqueada]}
              onPress={() => toggleDia(dia.date)}
              accessibilityRole="button"
              accessibilityLabel={`${dia.diaSemana} ${dia.diaMes} de ${dia.mes}${isBloqueada ? ', bloqueado' : ', disponível'}`}
              accessibilityState={{ selected: isBloqueada }}
            >
              <Text style={[s.diaSemanaText, isBloqueada && s.diaTextBloqueada]}>
                {dia.diaSemana}
              </Text>
              <Text style={[s.diaMesText, isBloqueada && s.diaTextBloqueada]}>
                {dia.diaMes}
              </Text>
              <Text style={[s.mesText, isBloqueada && s.diaTextBloqueada]}>
                {dia.mes}
              </Text>
              {isBloqueada && <Text style={s.diaCardIcon}>🚫</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveButton, saving && s.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Salvar dias de folga"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveButtonText}>Salvar Dias de Folga</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    hintCard: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    hintText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    countText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
      marginTop: 8,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 12,
      gap: 8,
      paddingBottom: 24,
    },
    diaCard: {
      width: '22%',
      minWidth: 72,
      minHeight: 72,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    diaCardBloqueada: {
      backgroundColor: theme.colors.error + '20',
      borderColor: theme.colors.error,
    },
    diaCardIcon: {
      fontSize: 12,
      marginTop: 2,
    },
    diaSemanaText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    diaMesText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    mesText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    diaTextBloqueada: {
      color: theme.colors.error,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: theme.colors.textMuted,
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
