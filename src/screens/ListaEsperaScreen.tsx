/**
 * ListaEsperaScreen — barbeiro vê quem está aguardando um horário.
 *
 * Mostra clientes na fila de espera agrupados por data.
 * Ao cancelar um agendamento, o barbeiro pode notificar
 * o próximo da fila via WhatsApp.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import {
  listarFilaDoBarbeiro,
  atualizarStatusFila,
} from '../data/repositories/ListaEsperaRepository';
import WhatsAppService from '../services/WhatsAppService';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, EntradaListaEspera } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ListaEspera'>;

export default function ListaEsperaScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [fila, setFila] = useState<EntradaListaEspera[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFila();
  }, []);

  const loadFila = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const dados = await listarFilaDoBarbeiro(uid);
      setFila(dados);
    } catch (error) {
      console.error('Erro ao carregar lista de espera:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificar = async (entrada: EntradaListaEspera) => {
    Alert.alert(
      'Notificar cliente',
      `Enviar mensagem WhatsApp para ${entrada.clienteNome} avisando que há um horário disponível em ${entrada.data}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Notificar',
          onPress: async () => {
            try {
              if (!entrada.clienteTelefone) {
                Alert.alert(
                  'Sem telefone',
                  'Este cliente não tem telefone cadastrado para notificação.',
                );
                return;
              }

              const mensagem =
                `Olá ${entrada.clienteNome}! 👋\n\n` +
                `Tenho um horário disponível para você no dia ${entrada.data}.\n` +
                (entrada.servicoNome ? `✂️ Serviço: ${entrada.servicoNome}\n\n` : '\n') +
                `Entre em contato ou abra o app para confirmar! 🙏`;

              await WhatsAppService.sendTextMessage(
                entrada.clienteTelefone,
                mensagem,
              );
              await atualizarStatusFila(entrada.id, 'notificado');
              await loadFila();

              Alert.alert('Sucesso!', `${entrada.clienteNome} foi notificado.`);
            } catch (error) {
              console.error('Erro ao notificar:', error);
              Alert.alert('Erro', 'Não foi possível enviar a notificação.');
            }
          },
        },
      ],
    );
  };

  const handleRemover = (entrada: EntradaListaEspera) => {
    Alert.alert(
      'Remover da fila',
      `Remover ${entrada.clienteNome} da lista de espera?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await atualizarStatusFila(entrada.id, 'expirado');
            await loadFila();
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
        data={fila}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <Text style={s.subtitle}>
            Clientes aguardando um horário disponível. Notifique-os quando um
            agendamento for cancelado.
          </Text>
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>✅</Text>
            <Text style={s.emptyText}>Nenhum cliente em espera</Text>
            <Text style={s.emptySubtext}>
              Quando todos os horários estiverem ocupados, os clientes que
              quiserem agendar poderão entrar nesta lista.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
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
              <View style={s.statusBadge}>
                <Text style={s.statusText}>
                  {item.status === 'notificado' ? 'Notificado ✓' : 'Aguardando'}
                </Text>
              </View>
            </View>

            <View style={s.cardMeta}>
              <Text style={s.metaItem}>📅 Data desejada: {item.data}</Text>
              {item.servicoNome && (
                <Text style={s.metaItem}>✂️ Serviço: {item.servicoNome}</Text>
              )}
              {item.clienteTelefone && (
                <Text style={s.metaItem}>📱 {item.clienteTelefone}</Text>
              )}
            </View>

            <View style={s.cardActions}>
              <TouchableOpacity
                style={[s.actionBtn, s.notificarBtn]}
                onPress={() => handleNotificar(item)}
              >
                <Text style={s.actionBtnText}>💬 Notificar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.removerBtn]}
                onPress={() => handleRemover(item)}
              >
                <Text style={s.actionBtnText}>Remover</Text>
              </TouchableOpacity>
            </View>
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
    statusBadge: {
      backgroundColor: theme.colors.surfaceVariant,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    cardMeta: {
      gap: 4,
      marginBottom: 12,
    },
    metaItem: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      minHeight: 40,
      justifyContent: 'center',
    },
    notificarBtn: {
      backgroundColor: '#25d366',
    },
    removerBtn: {
      backgroundColor: theme.colors.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
  });
