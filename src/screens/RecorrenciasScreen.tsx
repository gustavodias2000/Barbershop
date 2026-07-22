/**
 * RecorrenciasScreen — barbeiro gerencia agendamentos recorrentes.
 *
 * Lista todas as recorrências ativas e inativas,
 * permite ativar/desativar e remover.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import {
  listarRecorrenciasDoBarbeiro,
  toggleRecorrencia,
  removerRecorrencia,
} from '../data/repositories/RecorrenciaRepository';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Recorrencia, FrequenciaRecorrencia } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Recorrencias'>;

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const FREQ_LABEL: Record<FrequenciaRecorrencia, string> = {
  semanal: 'Toda semana',
  quinzenal: 'A cada 2 semanas',
  mensal: 'Todo mês',
};

export default function RecorrenciasScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecorrencias();
  }, []);

  const loadRecorrencias = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const dados = await listarRecorrenciasDoBarbeiro(uid);
      setRecorrencias(dados);
    } catch (error) {
      console.error('Erro ao carregar recorrências:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (rec: Recorrencia) => {
    try {
      await toggleRecorrencia(rec.id, !rec.ativo);
      setRecorrencias((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, ativo: !r.ativo } : r)),
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível alterar a recorrência.');
    }
  };

  const handleRemover = (rec: Recorrencia) => {
    Alert.alert(
      'Remover recorrência',
      `Remover o agendamento recorrente de ${rec.clienteNome} (${rec.servicoNome})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removerRecorrencia(rec.id);
              setRecorrencias((prev) => prev.filter((r) => r.id !== rec.id));
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível remover a recorrência.');
            }
          },
        },
      ],
    );
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
      <FlatList
        data={recorrencias}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <Text style={s.subtitle}>
            Clientes com agendamentos periódicos. Ative ou desative conforme necessário.
          </Text>
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>🔄</Text>
            <Text style={s.emptyText}>Nenhuma recorrência cadastrada</Text>
            <Text style={s.emptySubtext}>
              Crie recorrências a partir do histórico de um cliente para registrar
              atendimentos periódicos (semanal, quinzenal ou mensal).
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.card, !item.ativo && s.cardInativo]}>
            <View style={s.cardHeader}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {item.clienteNome?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={s.clienteInfo}>
                <Text style={s.clienteNome}>{item.clienteNome}</Text>
                <Text style={s.clienteEmail}>{item.clienteEmail}</Text>
              </View>
              <Switch
                value={item.ativo}
                onValueChange={() => handleToggle(item)}
                trackColor={{ true: theme.colors.primary }}
                thumbColor="#fff"
                accessibilityLabel={`Ativar recorrência de ${item.clienteNome}`}
              />
            </View>

            <View style={s.cardMeta}>
              <Text style={s.metaItem}>✂️ {item.servicoNome}</Text>
              <Text style={s.metaItem}>
                📅 {DIAS_SEMANA[item.diaSemana]} às {item.horario}
              </Text>
              <Text style={s.metaItem}>🔄 {FREQ_LABEL[item.frequencia]}</Text>
              {item.ultimoAgendamento && (
                <Text style={s.metaItem}>
                  ⏱ Último: {item.ultimoAgendamento}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={s.removerBtn}
              onPress={() => handleRemover(item)}
            >
              <Text style={s.removerBtnText}>Remover</Text>
            </TouchableOpacity>
          </View>
        )}
      />
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
    list: {
      padding: 16,
      paddingBottom: 40,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 24,
      lineHeight: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    cardInativo: {
      opacity: 0.6,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    avatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    clienteInfo: {
      flex: 1,
    },
    clienteNome: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    clienteEmail: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    cardMeta: {
      gap: 4,
      marginBottom: 12,
    },
    metaItem: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    removerBtn: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      minHeight: 36,
      justifyContent: 'center',
    },
    removerBtnText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
  });
