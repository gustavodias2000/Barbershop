/**
 * AgendamentoScreen — cliente agenda um horário com o barbeiro.
 *
 * Melhorias implementadas (competitivo InBarber):
 *  - Seletor de serviço: mostra lista de ServicoBarbeiro do barbeiro
 *  - Agendamento inteligente: slots gerados com base na duração do serviço
 *  - Respeita: intervalo de almoço, antecedência mínima/máxima, dias de atendimento
 *  - Verifica se o cliente está banido pelo barbeiro antes de permitir agendamento
 */
import React, { useState, useEffect, useRef } from 'react';
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
import WhatsAppService from '../services/WhatsAppService';
import PaymentModal from '../components/PaymentModal';
import { getHorariosOcupados, marcarOcupado } from '../services/OcupacaoService';
import { criarAgendamento } from '../data/repositories/AgendamentoRepository';
import { getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { entrarNaFila, jaEstaNaFila } from '../data/repositories/ListaEsperaRepository';
import useUserProfile from '../hooks/useUserProfile';
import { formatMoney, precoParaCentavos, toLocalDateString } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  RootStackParamList,
  NovoAgendamento,
  ServicoBarbeiro,
  ConfiguracaoAgenda,
} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Agendamento'>;

// ─── Helpers para geração de slots ──────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

function minutesToTime(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Gera os slots de um bloco de horário simples (início/fim), respeitando a
 * duração do serviço, o buffer pós-atendimento e um intervalo de pausa
 * opcional (usado para o almoço no bloco principal).
 */
function gerarSlotsBloco(
  inicio: string,
  fim: string,
  duracaoMinutos: number,
  buffer: number,
  pausaInicio: number | null = null,
  pausaFim: number | null = null,
): string[] {
  const slots: string[] = [];
  let current = timeToMinutes(inicio);
  const end = timeToMinutes(fim);

  while (current + duracaoMinutos <= end) {
    // Pula se o slot (ou qualquer parte dele) cai dentro da pausa
    if (pausaInicio !== null && pausaFim !== null) {
      const slotFim = current + duracaoMinutos;
      if (current < pausaFim && slotFim > pausaInicio) {
        current = pausaFim; // avança para depois da pausa
        continue;
      }
    }
    slots.push(minutesToTime(current));
    current += duracaoMinutos + buffer;
  }
  return slots;
}

/**
 * Gera os slots disponíveis com base na configuração do barbeiro e duração do
 * serviço: bloco principal (respeitando o intervalo de almoço) e, se
 * configurado, um segundo bloco — "turno extra" (ex.: período noturno).
 * Após cada slot, reserva o intervalo de descanso/limpeza (buffer) configurado.
 */
function gerarSlots(config: ConfiguracaoAgenda, duracaoMinutos: number): string[] {
  const buffer = config.intervaloAposAtendimentoMinutos || 0;

  const almocoInicio = config.almocoInicio ? timeToMinutes(config.almocoInicio) : null;
  const almocoFim = config.almocoFim ? timeToMinutes(config.almocoFim) : null;

  const slots = gerarSlotsBloco(
    config.horaInicio,
    config.horaFim,
    duracaoMinutos,
    buffer,
    almocoInicio,
    almocoFim,
  );

  if (config.turnoExtraAtivo && config.turnoExtraInicio && config.turnoExtraFim) {
    slots.push(
      ...gerarSlotsBloco(config.turnoExtraInicio, config.turnoExtraFim, duracaoMinutos, buffer),
    );
  }

  return slots;
}

/**
 * Retorna os próximos N dias que estão dentro do período permitido
 * (antecedenciaMaximaDias) e nos dias de atendimento configurados,
 * excluindo datas marcadas como folga pelo barbeiro.
 */
function getDatesDisponiveis(
  config: ConfiguracaoAgenda,
  datasBloqueadas: string[] = [],
): Array<{ date: string; display: string }> {
  const result: Array<{ date: string; display: string }> = [];
  const hoje = new Date();
  const maxDias = config.antecedenciaMaximaDias || 30;
  const bloqueadas = new Set(datasBloqueadas);

  for (let i = 0; i <= maxDias; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    const diaSemana = d.getDay(); // 0=dom...6=sab
    if (!config.diasAtendimento.includes(diaSemana)) continue;

    const dateStr = toLocalDateString(d);
    if (bloqueadas.has(dateStr)) continue;

    const display = d.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
    result.push({ date: dateStr, display });
  }
  return result;
}

// ─── Componente ──────────────────────────────────────────────────────────────

const CONFIG_PADRAO: ConfiguracaoAgenda = {
  horaInicio: '09:00',
  horaFim: '18:00',
  almocoInicio: '12:00',
  almocoFim: '13:00',
  antecedenciaMinutos: 30,
  antecedenciaMaximaDias: 30,
  diasAtendimento: [1, 2, 3, 4, 5, 6],
};

export default function AgendamentoScreen({ route, navigation }: Props) {
  const { barbeiro } = route.params;
  const { theme } = useTheme();
  const s = getStyles(theme);

  const { profile: userProfile } = useUserProfile();
  const scrollRef = useRef<ScrollView>(null);

  const [config, setConfig] = useState<ConfiguracaoAgenda>(CONFIG_PADRAO);
  const [servicos, setServicos] = useState<ServicoBarbeiro[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoBarbeiro | null>(null);
  const [datesDisponiveis, setDatesDisponiveis] = useState<Array<{ date: string; display: string }>>([]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdAgendamento, setCreatedAgendamento] = useState<(NovoAgendamento & { id?: string }) | null>(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [mensagemPosAgendamento, setMensagemPosAgendamento] = useState<string | null>(null);

  const todayStr = toLocalDateString(new Date());

  // ─── Carrega configuração e serviços do barbeiro ──────────────────────────

  useEffect(() => {
    loadBarbeiroDados();
  }, []);

  const loadBarbeiroDados = async () => {
    try {
      const uid = auth.currentUser?.uid;
      const dados = await getBarbeiro(barbeiro.id);

      // Verifica se o cliente está banido
      if (uid && dados?.clientesBanidos?.some((b) => b.uid === uid)) {
        Alert.alert(
          'Acesso bloqueado',
          'Você não pode agendar com este barbeiro.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }

      const cfg = dados?.configuracaoAgenda ?? CONFIG_PADRAO;
      setConfig(cfg);

      const svcs = dados?.servicos ?? [];
      setServicos(svcs);
      if (svcs.length > 0) setServicoSelecionado(svcs[0]);

      setMensagemPosAgendamento(dados?.mensagemPosAgendamento ?? null);

      const dates = getDatesDisponiveis(cfg, dados?.datasBloqueadas ?? []);
      setDatesDisponiveis(dates);
      if (dates.length > 0) setSelectedDate(dates[0].date);
    } catch (error) {
      console.error('Erro ao carregar dados do barbeiro:', error);
      // Fallback gracioso: usa defaults
      const dates = getDatesDisponiveis(CONFIG_PADRAO);
      setDatesDisponiveis(dates);
      if (dates.length > 0) setSelectedDate(dates[0].date);
    } finally {
      setLoading(false);
    }
  };

  // ─── Atualiza horários quando muda data ou serviço ───────────────────────

  useEffect(() => {
    if (selectedDate && servicoSelecionado) {
      setWaitlistJoined(false);
      fetchHorariosDisponiveis();
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 260, animated: true });
      }, 150);
    }
  }, [selectedDate, servicoSelecionado]);

  /**
   * Verifica se um horário já passou, considerando a antecedência mínima do barbeiro.
   */
  const isTimeInPast = (horario: string): boolean => {
    if (selectedDate !== todayStr) return false;
    const [hh, mm] = horario.split(':').map(Number);
    const now = new Date();
    const slotMs = (hh * 60 + mm) * 60 * 1000;
    const buffer = config.antecedenciaMinutos || 30;
    const nowMs = (now.getHours() * 60 + now.getMinutes() + buffer) * 60 * 1000;
    return slotMs <= nowMs;
  };

  const fetchHorariosDisponiveis = async () => {
    if (!servicoSelecionado) return;
    setLoadingHorarios(true);
    try {
      const todosOsSlots = gerarSlots(config, servicoSelecionado.duracaoMinutos);
      const ocupados = await getHorariosOcupados(barbeiro.id, selectedDate);

      // Um slot está ocupado se qualquer sub-slot de 30 min dentro dele está bloqueado
      const slotsLivres = todosOsSlots.filter((slot) => {
        if (isTimeInPast(slot)) return false;
        // Verifica se o slot (ou os sub-slots cobertos por ele) está ocupado
        const slotMin = timeToMinutes(slot);
        for (let i = 0; i < servicoSelecionado.duracaoMinutos; i += 30) {
          const subSlot = minutesToTime(slotMin + i);
          if (ocupados.includes(subSlot)) return false;
        }
        return true;
      });

      setAvailableTimes(slotsLivres);
      setSelectedTime(null);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      setAvailableTimes([]);
    } finally {
      setLoadingHorarios(false);
    }
  };

  // ─── Lista de espera ─────────────────────────────────────────────────────

  const handleEntrarFila = async () => {
    if (!selectedDate || !servicoSelecionado) {
      Alert.alert('Atenção', 'Selecione uma data e um serviço antes de entrar na lista.');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }
    try {
      const jaEsta = await jaEstaNaFila(barbeiro.id, uid, selectedDate);
      if (jaEsta) {
        Alert.alert('Aviso', 'Você já está na lista de espera para esta data.');
        setWaitlistJoined(true);
        return;
      }
      const userEmail = auth.currentUser?.email || '';
      const clienteNome = userProfile?.nome || userEmail.split('@')[0];
      await entrarNaFila({
        barbeiroId: barbeiro.id,
        clienteUid: uid,
        clienteNome,
        clienteEmail: userEmail,
        clienteTelefone: userProfile?.telefone,
        data: selectedDate,
        servicoId: servicoSelecionado.id,
        servicoNome: servicoSelecionado.nome,
      });
      setWaitlistJoined(true);
      Alert.alert(
        '✅ Lista de espera!',
        `Você foi adicionado à lista de espera para ${selectedDate}. ${barbeiro.nome} irá te notificar quando abrir um horário.`,
      );
    } catch (error) {
      console.error('Erro ao entrar na fila:', error);
      Alert.alert('Erro', 'Não foi possível entrar na lista de espera. Tente novamente.');
    }
  };

  // ─── Confirmação do agendamento ───────────────────────────────────────────

  const confirmarAgendamento = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Atenção', 'Selecione uma data e um horário.');
      return;
    }
    if (!servicoSelecionado) {
      Alert.alert('Atenção', 'Selecione um serviço.');
      return;
    }

    setLoading(true);
    try {
      const userEmail = auth.currentUser?.email;
      if (!userEmail) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }

      const clienteNome = userProfile?.nome || userEmail.split('@')[0];
      const clienteTelefone = userProfile?.telefone || '';
      const barbeiroTelefone = barbeiro.telefone || '';

      const novoAgendamento: NovoAgendamento = {
        barbeiroId: barbeiro.id,
        barbeiroNome: barbeiro.nome,
        barbeiroTelefone,
        cliente: userEmail,
        clienteUid: auth.currentUser?.uid || '',
        clienteNome,
        clienteTelefone,
        status: 'pendente',
        data: selectedDate,
        horario: selectedTime,
        servico: servicoSelecionado.nome,
        preco: (servicoSelecionado.precoEmCentavos / 100).toFixed(2).replace('.', ','),
        precoEmCentavos: servicoSelecionado.precoEmCentavos,
      };

      const novoId = await criarAgendamento(novoAgendamento);

      // Marca todos os sub-slots de 30 min cobertos pelo serviço (+ buffer de
      // descanso/limpeza pós-atendimento) como ocupados
      const slotMin = timeToMinutes(selectedTime);
      const duracaoComBuffer =
        servicoSelecionado.duracaoMinutos + (config.intervaloAposAtendimentoMinutos || 0);
      for (let i = 0; i < duracaoComBuffer; i += 30) {
        await marcarOcupado(barbeiro.id, selectedDate, minutesToTime(slotMin + i));
      }

      setCreatedAgendamento({ ...novoAgendamento, id: novoId } as NovoAgendamento & { id: string });
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Erro ao agendar:', error);
      Alert.alert('Erro', 'Não foi possível realizar o agendamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!createdAgendamento) return;
    const agendamentoFeito = createdAgendamento;

    try {
      const clienteInfo = {
        nome: agendamentoFeito.clienteNome,
        email: auth.currentUser?.email ?? undefined,
      };

      const mensagem = WhatsAppService.gerarMensagemAgendamento(
        { ...barbeiro, telefone: agendamentoFeito.barbeiroTelefone },
        clienteInfo,
        agendamentoFeito.data,
        agendamentoFeito.horario,
      );

      const barbeiroPhone = agendamentoFeito.barbeiroTelefone;
      const whatsappEnviado = barbeiroPhone
        ? await WhatsAppService.sendTextMessage(barbeiroPhone, mensagem)
        : false;

      navigation.replace('AgendamentoConfirmado', {
        agendamento: agendamentoFeito,
        barbeiro,
        whatsappEnviado,
        mensagemPosAgendamento,
      });
    } catch (error) {
      console.error('Erro pós-pagamento:', error);
      navigation.replace('AgendamentoConfirmado', {
        agendamento: agendamentoFeito,
        barbeiro,
        whatsappEnviado: false,
        mensagemPosAgendamento,
      });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
      <ScrollView ref={scrollRef} style={s.container}>
        {/* Cabeçalho do barbeiro */}
        <View style={s.header}>
          <Text style={s.title}>Agendar com {barbeiro.nome}</Text>
          <Text style={s.subtitle}>{barbeiro.especialidade || 'Barbearia'}</Text>
        </View>

        {/* Aviso quando barbeiro não tem serviços cadastrados */}
        {servicos.length === 0 && !loading && (
          <View style={s.alertBanner}>
            <Text style={s.alertBannerIcon}>⚠️</Text>
            <View style={s.alertBannerText}>
              <Text style={s.alertBannerTitle}>Serviços não configurados</Text>
              <Text style={s.alertBannerDesc}>
                Este barbeiro ainda não cadastrou os serviços disponíveis. Tente novamente mais tarde ou entre em contato.
              </Text>
            </View>
          </View>
        )}

        {/* Seleção de serviço */}
        {servicos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Selecione o Serviço</Text>
            {servicos.map((sv) => (
              <TouchableOpacity
                key={sv.id}
                style={[
                  s.servicoCard,
                  servicoSelecionado?.id === sv.id && s.servicoCardSelected,
                ]}
                onPress={() => {
                  setServicoSelecionado(sv);
                  setSelectedTime(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Serviço ${sv.nome}, ${sv.duracaoMinutos} minutos, ${formatMoney(sv.precoEmCentavos)}`}
                accessibilityState={{ selected: servicoSelecionado?.id === sv.id }}
              >
                <View style={s.servicoInfo}>
                  <Text
                    style={[
                      s.servicoNome,
                      servicoSelecionado?.id === sv.id && s.servicoNomeSelected,
                    ]}
                  >
                    {sv.nome}
                  </Text>
                  <Text
                    style={[
                      s.servicoMeta,
                      servicoSelecionado?.id === sv.id && s.servicoMetaSelected,
                    ]}
                  >
                    ⏱ {sv.duracaoMinutos} min
                  </Text>
                </View>
                <Text
                  style={[
                    s.servicoPreco,
                    servicoSelecionado?.id === sv.id && s.servicoPrecoSelected,
                  ]}
                >
                  {formatMoney(sv.precoEmCentavos)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Seleção de data */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Selecione a Data</Text>
          {datesDisponiveis.length === 0 ? (
            <Text style={s.noTimesText}>
              Nenhuma data disponível. O barbeiro ainda não configurou a agenda.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateScroll}>
              {datesDisponiveis.map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    s.dateButton,
                    selectedDate === day.date && s.selectedDateButton,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Data ${day.display}`}
                  accessibilityState={{ selected: selectedDate === day.date }}
                  onPress={() => setSelectedDate(day.date)}
                >
                  <Text
                    style={[
                      s.dateButtonText,
                      selectedDate === day.date && s.selectedDateButtonText,
                    ]}
                  >
                    {day.display}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Seleção de horário */}
        {selectedDate && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Selecione o Horário</Text>

            {loadingHorarios ? (
              <View style={s.loadingHorarios}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={s.loadingHorariosText}>Verificando disponibilidade...</Text>
              </View>
            ) : availableTimes.length > 0 ? (
              <View style={s.timeGrid}>
                {availableTimes.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      s.timeButton,
                      selectedTime === time && s.selectedTimeButton,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Horário ${time}`}
                    accessibilityState={{ selected: selectedTime === time }}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text
                      style={[
                        s.timeButtonText,
                        selectedTime === time && s.selectedTimeButtonText,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={s.noTimesContainer}>
                <Text style={s.noTimesText}>
                  {selectedDate === todayStr
                    ? 'Não há horários disponíveis para hoje. Escolha outro dia.'
                    : 'Não há horários disponíveis para esta data.'}
                </Text>
                {selectedDate !== todayStr && (
                  waitlistJoined ? (
                    <View style={s.waitlistConfirmado}>
                      <Text style={s.waitlistConfirmadoText}>
                        ✅ Você está na lista de espera para esta data!
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={s.waitlistButton}
                      onPress={handleEntrarFila}
                    >
                      <Text style={s.waitlistButtonText}>
                        📋 Entrar na lista de espera
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            )}
          </View>
        )}

        {/* Modal de pagamento */}
        <PaymentModal
          visible={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setCreatedAgendamento(null);
          }}
          agendamento={createdAgendamento}
          onPaymentSuccess={handlePaymentSuccess}
        />

        {/* Resumo e botão confirmar */}
        {selectedDate && selectedTime && servicoSelecionado ? (
          <View style={s.confirmSection}>
            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Resumo do Agendamento</Text>
              {[
                { label: 'Barbeiro', value: barbeiro.nome },
                { label: 'Serviço', value: servicoSelecionado.nome },
                { label: 'Duração', value: `${servicoSelecionado.duracaoMinutos} min` },
                { label: 'Data', value: selectedDate },
                { label: 'Horário', value: selectedTime },
              ].map((row) => (
                <View key={row.label} style={s.summaryRow}>
                  <Text style={s.summaryLabel}>{row.label}:</Text>
                  <Text style={s.summaryValue}>{row.value}</Text>
                </View>
              ))}
              <View style={[s.summaryRow, s.summaryTotal]}>
                <Text style={s.summaryTotalLabel}>Total:</Text>
                <Text style={s.summaryPrice}>
                  {formatMoney(servicoSelecionado.precoEmCentavos)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.confirmButton, loading && s.confirmButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Confirmar agendamento"
              accessibilityState={{ disabled: loading }}
              onPress={confirmarAgendamento}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.confirmButtonText}>Confirmar Agendamento</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
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
    container: {
      flex: 1,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      backgroundColor: theme.colors.surface,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      alignItems: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    section: {
      backgroundColor: theme.colors.surface,
      margin: 16,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 12,
    },
    // Serviços
    servicoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceVariant,
      marginBottom: 8,
    },
    servicoCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '15',
    },
    servicoInfo: {
      flex: 1,
    },
    servicoNome: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 2,
    },
    servicoNomeSelected: {
      color: theme.colors.primary,
    },
    servicoMeta: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    servicoMetaSelected: {
      color: theme.colors.primary,
    },
    servicoPreco: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.success,
    },
    servicoPrecoSelected: {
      color: theme.colors.primary,
    },
    // Datas
    dateScroll: {
      flexDirection: 'row',
    },
    dateButton: {
      backgroundColor: theme.colors.surfaceVariant,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 44,
      justifyContent: 'center',
    },
    selectedDateButton: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    dateButtonText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    selectedDateButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    // Horários
    loadingHorarios: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      gap: 12,
    },
    loadingHorariosText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    timeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    timeButton: {
      backgroundColor: theme.colors.surfaceVariant,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minWidth: 70,
      minHeight: 44,
      justifyContent: 'center',
    },
    selectedTimeButton: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    timeButtonText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    selectedTimeButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    noTimesContainer: {
      padding: 20,
      alignItems: 'center',
    },
    noTimesText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    waitlistButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    waitlistButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    waitlistConfirmado: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    waitlistConfirmadoText: {
      fontSize: 14,
      color: theme.colors.success,
      fontWeight: '600',
      textAlign: 'center',
    },
    // Resumo
    confirmSection: {
      margin: 16,
      marginBottom: 32,
    },
    summaryCard: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    summaryTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    summaryLabel: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
    summaryValue: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: '500',
      flex: 1,
      textAlign: 'right',
      marginLeft: 8,
    },
    summaryTotal: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    summaryTotalLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    summaryPrice: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.success,
    },
    confirmButton: {
      backgroundColor: theme.colors.success,
      paddingVertical: 16,
      borderRadius: 8,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
    },
    confirmButtonDisabled: {
      backgroundColor: theme.colors.textMuted,
    },
    confirmButtonText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: 'bold',
    },
    // Banner de aviso quando barbeiro não tem serviços cadastrados
    alertBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: '#FEF3C7',
      borderColor: '#F59E0B',
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
      margin: 16,
      marginBottom: 0,
    },
    alertBannerIcon: {
      fontSize: 20,
      marginRight: 10,
      marginTop: 1,
    },
    alertBannerText: {
      flex: 1,
    },
    alertBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#92400E',
      marginBottom: 3,
    },
    alertBannerDesc: {
      fontSize: 13,
      color: '#92400E',
      lineHeight: 18,
    },
  });
