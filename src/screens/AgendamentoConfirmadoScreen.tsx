/**
 * AgendamentoConfirmadoScreen — tela de confirmação completa exibida após o
 * agendamento ser pago/criado (substitui o Alert nativo usado antes).
 *
 * Inspirada no padrão de mercado (ex.: Masters): resumo do agendamento,
 * status do envio ao barbeiro, contato direto (ligação), endereço com link
 * de mapa, atalho para adicionar ao calendário e cancelamento na mesma tela.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { atualizarStatus } from '../data/repositories/AgendamentoRepository';
import { liberarSlot } from '../services/OcupacaoService';
import CalendarService from '../services/CalendarService';
import { formatMoney } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AgendamentoConfirmado'>;

export default function AgendamentoConfirmadoScreen({ route, navigation }: Props) {
  const { agendamento, barbeiro, whatsappEnviado, mensagemPosAgendamento } = route.params;
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [cancelando, setCancelando] = useState(false);
  const [cancelado, setCancelado] = useState(false);

  const handleLigar = () => {
    const telefone = agendamento.barbeiroTelefone || barbeiro.telefone;
    if (!telefone) {
      Alert.alert('Sem telefone', 'Este barbeiro não cadastrou um telefone de contato.');
      return;
    }
    const digits = telefone.replace(/\D/g, '');
    Linking.openURL(`tel:${digits}`).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o discador.');
    });
  };

  const handleAbrirMapa = () => {
    // Prefere as coordenadas (geocoding via Google Places) quando existirem
    // — pino exato no mapa. Sem elas, cai para a busca por texto de sempre.
    const temCoordenadas = barbeiro.latitude != null && barbeiro.longitude != null;
    const endereco = barbeiro.enderecoFormatado || barbeiro.endereco;
    if (!temCoordenadas && !endereco) return;

    const url = temCoordenadas
      ? `https://www.google.com/maps/search/?api=1&query=${barbeiro.latitude},${barbeiro.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco!)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o mapa.');
    });
  };

  const handleAdicionarCalendario = async () => {
    await CalendarService.addAgendamentoToCalendar(agendamento);
  };

  const handleCancelar = () => {
    Alert.alert(
      'Cancelar agendamento',
      `Deseja cancelar o horário de ${agendamento.horario} com ${agendamento.barbeiroNome}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            if (!agendamento.id) {
              // Agendamento criado sem id capturado — orienta o cliente a cancelar
              // pela aba "Meus Horários", onde o id sempre está disponível.
              Alert.alert(
                'Cancelamento indisponível aqui',
                'Cancele este agendamento na aba "Meus Horários".',
              );
              return;
            }
            setCancelando(true);
            try {
              await atualizarStatus(agendamento.id, 'cancelado', { cancelledBy: 'cliente' });
              await liberarSlot(agendamento.barbeiroId, agendamento.data, agendamento.horario);
              setCancelado(true);
            } catch (error) {
              console.error('Erro ao cancelar:', error);
              Alert.alert('Erro', 'Não foi possível cancelar. Tente novamente.');
            } finally {
              setCancelando(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.successBadge}>
          <Text style={s.successIcon}>{cancelado ? '🚫' : '✅'}</Text>
          <Text style={s.successTitle}>
            {cancelado ? 'Agendamento cancelado' : 'Agendamento confirmado!'}
          </Text>
          <Text style={s.successSubtitle}>
            {cancelado
              ? 'Você pode agendar um novo horário quando quiser.'
              : whatsappEnviado
                ? `${agendamento.barbeiroNome} foi avisado por WhatsApp.`
                : 'Entre em contato para confirmar diretamente.'}
          </Text>
        </View>

        {!cancelado && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Detalhes</Text>
              {[
                { label: 'Barbeiro', value: agendamento.barbeiroNome },
                { label: 'Serviço', value: agendamento.servico || 'Corte e barba' },
                { label: 'Data', value: agendamento.data },
                { label: 'Horário', value: agendamento.horario },
              ].map((row) => (
                <View key={row.label} style={s.row}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowValue}>{row.value}</Text>
                </View>
              ))}
              <View style={[s.row, s.rowTotal]}>
                <Text style={s.rowTotalLabel}>Total</Text>
                <Text style={s.rowTotalValue}>{formatMoney(agendamento.precoEmCentavos)}</Text>
              </View>
            </View>

            {mensagemPosAgendamento ? (
              <View style={s.mensagemCard}>
                <Text style={s.mensagemIcon}>💬</Text>
                <Text style={s.mensagemText}>{mensagemPosAgendamento}</Text>
              </View>
            ) : null}

            <View style={s.card}>
              <Text style={s.cardTitle}>Contato e local</Text>

              <TouchableOpacity
                style={s.actionRow}
                onPress={handleLigar}
                accessibilityRole="button"
                accessibilityLabel={`Ligar para ${agendamento.barbeiroNome}`}
              >
                <Text style={s.actionIcon}>📞</Text>
                <Text style={s.actionText}>Ligar para {agendamento.barbeiroNome}</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>

              {barbeiro.enderecoFormatado || barbeiro.endereco ? (
                <TouchableOpacity
                  style={s.actionRow}
                  onPress={handleAbrirMapa}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir endereço no mapa"
                >
                  <Text style={s.actionIcon}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.actionText}>Ver no mapa</Text>
                    <Text style={s.actionSubtext} numberOfLines={1}>
                      {barbeiro.enderecoFormatado || barbeiro.endereco}
                    </Text>
                  </View>
                  <Text style={s.chevron}>›</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={s.actionRow}
                onPress={handleAdicionarCalendario}
                accessibilityRole="button"
                accessibilityLabel="Adicionar ao calendário"
              >
                <Text style={s.actionIcon}>🗓️</Text>
                <Text style={s.actionText}>Adicionar ao Calendário</Text>
                <Text style={s.chevron}>›</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.cancelButton, cancelando && s.cancelButtonDisabled]}
              onPress={handleCancelar}
              disabled={cancelando}
              accessibilityRole="button"
              accessibilityLabel="Cancelar agendamento"
            >
              {cancelando ? (
                <ActivityIndicator color={theme.colors.error} />
              ) : (
                <Text style={s.cancelButtonText}>Cancelar Agendamento</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={s.doneButton}
          onPress={() => navigation.popToTop()}
          accessibilityRole="button"
          accessibilityLabel="Concluir"
        >
          <Text style={s.doneButtonText}>Concluir</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      padding: 16,
      paddingBottom: 40,
    },
    successBadge: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    successIcon: {
      fontSize: 48,
      marginBottom: 8,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    successSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    rowLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    rowValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
      marginLeft: 8,
    },
    rowTotal: {
      marginTop: 4,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    rowTotalLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    rowTotalValue: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.success,
    },
    mensagemCard: {
      flexDirection: 'row',
      backgroundColor: theme.colors.primary + '15',
      borderRadius: 10,
      padding: 14,
      marginBottom: 16,
      alignItems: 'flex-start',
    },
    mensagemIcon: {
      fontSize: 18,
      marginRight: 10,
    },
    mensagemText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
      minHeight: 44,
    },
    actionIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    actionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    actionSubtext: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    chevron: {
      fontSize: 20,
      color: theme.colors.textMuted,
      marginLeft: 8,
    },
    cancelButton: {
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.error,
      minHeight: 48,
      justifyContent: 'center',
      marginBottom: 12,
    },
    cancelButtonDisabled: {
      opacity: 0.6,
    },
    cancelButtonText: {
      color: theme.colors.error,
      fontSize: 15,
      fontWeight: '700',
    },
    doneButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
    },
    doneButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });
