/**
 * AgendamentoManualScreen — o próprio barbeiro cria um agendamento em nome
 * de um cliente (walk-in, telefonema, cliente sem o app) — gap competitivo
 * com o Masters: "hoje só o cliente inicia o agendamento".
 *
 * Reaproveita a mesma lógica de geração de slots do fluxo do cliente
 * (src/utils/agendaSlots.ts), incluindo bloqueios de horário e ocupação —
 * a agenda nunca sai de sincronia entre os dois fluxos.
 *
 * O agendamento é criado já como "confirmado": é o próprio barbeiro que
 * está decidindo o horário, não faz sentido pedir confirmação de si mesmo.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import WhatsAppService from '../services/WhatsAppService';
import { getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { listarClientesDoBarbeiro } from '../data/repositories/ClienteContatoRepository';
import { criarAgendamento } from '../data/repositories/AgendamentoRepository';
import { getHorariosOcupados, marcarOcupado } from '../services/OcupacaoService';
import useUserProfile from '../hooks/useUserProfile';
import {
  gerarSlots,
  getDatesDisponiveis,
  filtrarBloqueiosHorario,
  isTimeInPast,
  timeToMinutes,
  minutesToTime,
} from '../utils/agendaSlots';
import { maskPhone, formatPhoneToE164, formatMoney, toLocalDateString } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  RootStackParamList,
  ConfiguracaoAgenda,
  ServicoBarbeiro,
  BloqueioHorario,
  ClienteContato,
  NovoAgendamento,
} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AgendamentoManual'>;

const CONFIG_PADRAO: ConfiguracaoAgenda = {
  horaInicio: '09:00',
  horaFim: '18:00',
  almocoInicio: '12:00',
  almocoFim: '13:00',
  antecedenciaMinutos: 0,
  antecedenciaMaximaDias: 90,
  diasAtendimento: [0, 1, 2, 3, 4, 5, 6],
};

export default function AgendamentoManualScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  const { profile: userProfile } = useUserProfile();

  const [config, setConfig] = useState<ConfiguracaoAgenda>(CONFIG_PADRAO);
  const [servicos, setServicos] = useState<ServicoBarbeiro[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioHorario[]>([]);
  const [clientes, setClientes] = useState<ClienteContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Cliente
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteContato | null>(null);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [modoNovoCliente, setModoNovoCliente] = useState(false);

  // Serviço / data / horário
  const [servicoSelecionado, setServicoSelecionado] = useState<ServicoBarbeiro | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [datesDisponiveis, setDatesDisponiveis] = useState<Array<{ date: string; display: string }>>([]);

  const todayStr = toLocalDateString(new Date());
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      if (!uid) return;
      const [dados, listaClientes] = await Promise.all([
        getBarbeiro(uid),
        listarClientesDoBarbeiro(uid),
      ]);
      const cfg = dados?.configuracaoAgenda ?? CONFIG_PADRAO;
      setConfig(cfg);
      setBloqueios(dados?.bloqueiosHorario ?? []);
      const svcs = dados?.servicos ?? [];
      setServicos(svcs);
      if (svcs.length > 0) setServicoSelecionado(svcs[0]);
      setClientes(listaClientes);

      const dates = getDatesDisponiveis(cfg, dados?.datasBloqueadas ?? []);
      setDatesDisponiveis(dates);
      if (dates.length > 0) setSelectedDate(dates[0].date);

      // Pré-preenche cliente vindo de ClientesScreen (ação "Agendar")
      if (route.params?.clienteId) {
        const preSelecionado = listaClientes.find((c) => c.id === route.params?.clienteId);
        if (preSelecionado) setClienteSelecionado(preSelecionado);
      } else if (route.params?.clienteNome) {
        setModoNovoCliente(true);
        setNovoClienteNome(route.params.clienteNome);
        if (route.params.clienteTelefone) {
          setNovoClienteTelefone(maskPhone(route.params.clienteTelefone.replace(/^55/, '')));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados para agendamento manual:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate && servicoSelecionado) fetchHorarios();
  }, [selectedDate, servicoSelecionado]);

  const fetchHorarios = async () => {
    if (!uid || !servicoSelecionado || !selectedDate) return;
    setLoadingHorarios(true);
    try {
      let slots = gerarSlots(config, servicoSelecionado.duracaoMinutos);
      slots = filtrarBloqueiosHorario(slots, servicoSelecionado.duracaoMinutos, selectedDate, bloqueios);
      const ocupados = await getHorariosOcupados(uid, selectedDate);

      const livres = slots.filter((slot) => {
        if (isTimeInPast(slot, selectedDate, todayStr, config.antecedenciaMinutos)) return false;
        const slotMin = timeToMinutes(slot);
        for (let i = 0; i < servicoSelecionado.duracaoMinutos; i += 30) {
          if (ocupados.includes(minutesToTime(slotMin + i))) return false;
        }
        return true;
      });
      setAvailableTimes(livres);
      setSelectedTime(null);
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      setAvailableTimes([]);
    } finally {
      setLoadingHorarios(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes;
    const termo = buscaCliente.trim().toLowerCase();
    return clientes.filter((c) => c.nome.toLowerCase().includes(termo));
  }, [clientes, buscaCliente]);

  const handleConfirmar = async () => {
    if (!uid || !servicoSelecionado || !selectedDate || !selectedTime) {
      Alert.alert('Atenção', 'Selecione o serviço, a data e o horário.');
      return;
    }
    const nomeCliente = modoNovoCliente ? novoClienteNome.trim() : clienteSelecionado?.nome;
    if (!nomeCliente) {
      Alert.alert('Atenção', 'Selecione um cliente da lista ou informe o nome.');
      return;
    }
    const telefoneCliente = modoNovoCliente
      ? (novoClienteTelefone ? formatPhoneToE164(novoClienteTelefone) : undefined)
      : clienteSelecionado?.telefone;

    setSalvando(true);
    try {
      const dados = await getBarbeiro(uid);
      const barbeiroNome = userProfile?.nome || dados?.nome || 'Barbeiro';

      const novoAgendamento: NovoAgendamento = {
        barbeiroId: uid,
        barbeiroNome,
        barbeiroTelefone: dados?.telefone || '',
        ...(dados?.negocioId ? { negocioId: dados.negocioId } : {}),
        cliente: '',
        clienteUid: '',
        clienteNome: nomeCliente,
        ...(telefoneCliente ? { clienteTelefone: telefoneCliente } : {}),
        status: 'confirmado',
        data: selectedDate,
        horario: selectedTime,
        servico: servicoSelecionado.nome,
        preco: (servicoSelecionado.precoEmCentavos / 100).toFixed(2).replace('.', ','),
        precoEmCentavos: servicoSelecionado.precoEmCentavos,
        origem: 'manual',
      };

      await criarAgendamento(novoAgendamento);

      const slotMin = timeToMinutes(selectedTime);
      const duracaoComBuffer = servicoSelecionado.duracaoMinutos + (config.intervaloAposAtendimentoMinutos || 0);
      for (let i = 0; i < duracaoComBuffer; i += 30) {
        await marcarOcupado(uid, selectedDate, minutesToTime(slotMin + i));
      }

      let avisoWhatsapp = '';
      if (telefoneCliente) {
        const msg = WhatsAppService.gerarMensagemConfirmacao(
          { nome: nomeCliente, telefone: telefoneCliente },
          selectedDate, selectedTime, barbeiroNome,
        );
        const enviado = await WhatsAppService.sendTextMessage(telefoneCliente, msg);
        avisoWhatsapp = enviado ? ' O cliente foi avisado pelo WhatsApp.' : '';
      }

      Alert.alert('Agendamento criado!', `${nomeCliente} — ${selectedDate} às ${selectedTime}.${avisoWhatsapp}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao criar agendamento manual:', error);
      Alert.alert('Erro', 'Não foi possível criar o agendamento. Tente novamente.');
    } finally {
      setSalvando(false);
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
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Cliente */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Cliente</Text>
          <View style={s.modoToggle}>
            <TouchableOpacity
              style={[s.modoButton, !modoNovoCliente && s.modoButtonSelected]}
              onPress={() => setModoNovoCliente(false)}
            >
              <Text style={[s.modoButtonText, !modoNovoCliente && s.modoButtonTextSelected]}>Da minha agenda</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modoButton, modoNovoCliente && s.modoButtonSelected]}
              onPress={() => setModoNovoCliente(true)}
            >
              <Text style={[s.modoButtonText, modoNovoCliente && s.modoButtonTextSelected]}>Novo cliente</Text>
            </TouchableOpacity>
          </View>

          {modoNovoCliente ? (
            <>
              <TextInput
                value={novoClienteNome}
                onChangeText={setNovoClienteNome}
                style={s.input}
                placeholder="Nome do cliente"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="words"
              />
              <TextInput
                value={novoClienteTelefone}
                onChangeText={(t) => setNovoClienteTelefone(maskPhone(t))}
                style={s.input}
                placeholder="Telefone (opcional, para avisar por WhatsApp)"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </>
          ) : (
            <>
              <TextInput
                value={buscaCliente}
                onChangeText={setBuscaCliente}
                style={s.input}
                placeholder="Buscar cliente pelo nome..."
                placeholderTextColor={theme.colors.textMuted}
              />
              {clientesFiltrados.length === 0 ? (
                <Text style={s.hint}>
                  Nenhum cliente encontrado. Cadastre em "Clientes" ou use "Novo cliente" acima.
                </Text>
              ) : (
                <FlatList
                  data={clientesFiltrados.slice(0, 8)}
                  keyExtractor={(c) => c.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[s.clienteRow, clienteSelecionado?.id === item.id && s.clienteRowSelected]}
                      onPress={() => setClienteSelecionado(item)}
                    >
                      <Text style={[s.clienteRowNome, clienteSelecionado?.id === item.id && s.clienteRowNomeSelected]}>
                        {item.nome}
                      </Text>
                      {item.telefone ? <Text style={s.clienteRowTelefone}>{item.telefone}</Text> : null}
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}
        </View>

        {/* Serviço */}
        {servicos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Serviço</Text>
            {servicos.map((sv) => (
              <TouchableOpacity
                key={sv.id}
                style={[s.servicoCard, servicoSelecionado?.id === sv.id && s.servicoCardSelected]}
                onPress={() => { setServicoSelecionado(sv); setSelectedTime(null); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.servicoNome}>{sv.nome}</Text>
                  <Text style={s.servicoMeta}>⏱ {sv.duracaoMinutos} min</Text>
                </View>
                <Text style={s.servicoPreco}>{formatMoney(sv.precoEmCentavos)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Data */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {datesDisponiveis.map((day) => (
              <TouchableOpacity
                key={day.date}
                style={[s.dateButton, selectedDate === day.date && s.dateButtonSelected]}
                onPress={() => setSelectedDate(day.date)}
              >
                <Text style={[s.dateButtonText, selectedDate === day.date && s.dateButtonTextSelected]}>
                  {day.display}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Horário */}
        {selectedDate && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Horário</Text>
            {loadingHorarios ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : availableTimes.length > 0 ? (
              <View style={s.timeGrid}>
                {availableTimes.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[s.timeButton, selectedTime === time && s.timeButtonSelected]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text style={[s.timeButtonText, selectedTime === time && s.timeButtonTextSelected]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={s.hint}>Não há horários livres nessa data.</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[s.confirmButton, salvando && s.buttonDisabled]}
          onPress={handleConfirmar}
          disabled={salvando}
        >
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmButtonText}>Criar Agendamento</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  modoToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modoButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modoButtonSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  modoButtonText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  modoButtonTextSelected: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    marginBottom: 10,
  },
  hint: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
  clienteRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: theme.colors.surfaceVariant,
  },
  clienteRowSelected: { backgroundColor: theme.colors.primary + '20', borderWidth: 1, borderColor: theme.colors.primary },
  clienteRowNome: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  clienteRowNomeSelected: { color: theme.colors.primary },
  clienteRowTelefone: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  servicoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
    marginBottom: 8,
  },
  servicoCardSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  servicoNome: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  servicoMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  servicoPreco: { fontSize: 15, fontWeight: '700', color: theme.colors.success },
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
  dateButtonSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dateButtonText: { fontSize: 13, color: theme.colors.textSecondary },
  dateButtonTextSelected: { color: '#fff', fontWeight: '700' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  timeButtonSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  timeButtonText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  timeButtonTextSelected: { color: '#fff', fontWeight: '700' },
  confirmButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
