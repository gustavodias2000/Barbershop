/**
 * BloqueiosScreen — bloqueio de horário específico dentro de um dia
 * ("evento pessoal"), diferente de FolgasScreen (que bloqueia o dia
 * inteiro). Ex.: consulta médica das 14h às 15h numa terça — o resto do
 * dia continua disponível para os clientes agendarem.
 *
 * Os bloqueios são respeitados na geração de horários tanto do cliente
 * (AgendamentoScreen) quanto do agendamento manual do barbeiro
 * (AgendamentoManualScreen), via `filtrarBloqueiosHorario` em agendaSlots.ts.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { upsertBarbeiro, getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { atualizarProfissional } from '../data/repositories/NegocioRepository';
import { toLocalDateString } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, BloqueioHorario } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Bloqueios'>;

const DIAS_A_FRENTE = 60;

const HORAS = Array.from({ length: 24 }, (_, h) =>
  [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`],
).flat();

function gerarProximosDias(qtd: number) {
  const result: Array<{ date: string; label: string }> = [];
  const hoje = new Date();
  for (let i = 0; i <= qtd; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    result.push({
      date: toLocalDateString(d),
      label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
    });
  }
  return result;
}

export default function BloqueiosScreen({ navigation: _navigation, route }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  const { showToast } = useToast();

  const profissionalId = route.params?.profissionalId;
  const profissionalNome = route.params?.profissionalNome;
  const targetId = profissionalId || auth.currentUser?.uid;

  const [bloqueios, setBloqueios] = useState<BloqueioHorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dataEvento, setDataEvento] = useState<string | null>(null);
  const [horaInicio, setHoraInicio] = useState('14:00');
  const [horaFim, setHoraFim] = useState('15:00');
  const [motivo, setMotivo] = useState('');

  const dias = useMemo(() => gerarProximosDias(DIAS_A_FRENTE), []);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      if (!targetId) return;
      const barbeiro = await getBarbeiro(targetId);
      setBloqueios(barbeiro?.bloqueiosHorario ?? []);
      if (dias.length > 0) setDataEvento(dias[0].date);
    } catch (error) {
      console.error('Erro ao carregar bloqueios:', error);
    } finally {
      setLoading(false);
    }
  };

  /** @returns true se salvou com sucesso — usado para só mostrar o toast quando a escrita realmente aconteceu. */
  const salvarLista = async (novaLista: BloqueioHorario[]): Promise<boolean> => {
    setSaving(true);
    try {
      if (!targetId) return false;
      const dados = { bloqueiosHorario: novaLista };
      if (profissionalId) {
        await atualizarProfissional(profissionalId, dados);
      } else {
        await upsertBarbeiro(targetId, dados);
      }
      setBloqueios(novaLista);
      return true;
    } catch (error) {
      console.error('Erro ao salvar bloqueios:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleAdicionar = async () => {
    if (!dataEvento) {
      Alert.alert('Atenção', 'Selecione a data do evento.');
      return;
    }
    if (horaInicio >= horaFim) {
      Alert.alert('Atenção', 'O horário de início deve ser anterior ao de fim.');
      return;
    }
    const novo: BloqueioHorario = {
      id: `${Date.now()}`,
      data: dataEvento,
      horaInicio,
      horaFim,
      motivo: motivo.trim() || undefined,
    };
    const lista = [...bloqueios, novo].sort((a, b) => (a.data + a.horaInicio).localeCompare(b.data + b.horaInicio));
    const ok = await salvarLista(lista);
    if (ok) {
      showToast('Bloqueio adicionado.');
      setMotivo('');
    }
  };

  const handleRemover = async (id: string) => {
    const ok = await salvarLista(bloqueios.filter((b) => b.id !== id));
    if (ok) showToast('Bloqueio removido.', 'info');
  };

  const renderPickerRow = (label: string, options: string[], current: string, onChange: (v: string) => void) => (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[s.chip, current === opt && s.chipSelected]}
            onPress={() => onChange(opt)}
          >
            <Text style={[s.chipText, current === opt && s.chipTextSelected]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

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
      <ScrollView contentContainerStyle={s.scroll}>
        {profissionalId && (
          <View style={s.profissionalBanner}>
            <Text style={s.profissionalBannerText}>
              Editando os bloqueios de {profissionalNome || 'um profissional da equipe'}
            </Text>
          </View>
        )}

        <View style={s.hintCard}>
          <Text style={s.hintText}>
            Bloqueie um horário específico dentro de um dia (ex.: consulta médica, compromisso pessoal) sem
            precisar tirar o dia inteiro de folga. O resto do dia continua disponível para agendamentos.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Novo bloqueio</Text>

          <Text style={s.fieldLabel}>Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {dias.map((d) => (
              <TouchableOpacity
                key={d.date}
                style={[s.chip, dataEvento === d.date && s.chipSelected]}
                onPress={() => setDataEvento(d.date)}
              >
                <Text style={[s.chipText, dataEvento === d.date && s.chipTextSelected]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {renderPickerRow('Início', HORAS, horaInicio, setHoraInicio)}
          {renderPickerRow('Fim', HORAS.filter((h) => h > horaInicio), horaFim, setHoraFim)}

          <Text style={s.fieldLabel}>Motivo (opcional)</Text>
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            style={s.input}
            placeholder="Ex.: Consulta médica"
            placeholderTextColor={theme.colors.textMuted}
          />

          <TouchableOpacity
            style={[s.addButton, saving && s.buttonDisabled]}
            onPress={handleAdicionar}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.addButtonText}>Adicionar bloqueio</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>
            {bloqueios.length === 0 ? 'Nenhum bloqueio ativo' : `${bloqueios.length} bloqueio${bloqueios.length === 1 ? '' : 's'} ativo${bloqueios.length === 1 ? '' : 's'}`}
          </Text>
          {bloqueios.map((b) => (
            <View key={b.id} style={s.bloqueioRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.bloqueioData}>{b.data} · {b.horaInicio}–{b.horaFim}</Text>
                {b.motivo ? <Text style={s.bloqueioMotivo}>{b.motivo}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleRemover(b.id)} accessibilityLabel="Remover bloqueio">
                <Text style={s.removerText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 16, paddingBottom: 40 },
    profissionalBanner: {
      backgroundColor: theme.colors.primary + '20',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    profissionalBannerText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, textAlign: 'center' },
    hintCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    hintText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
    fieldGroup: { marginBottom: 12 },
    fieldLabel: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6, fontWeight: '600' },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceVariant,
      marginRight: 8,
    },
    chipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    chipText: { fontSize: 13, color: theme.colors.textSecondary },
    chipTextSelected: { color: '#fff', fontWeight: '700' },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      marginBottom: 16,
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    buttonDisabled: { opacity: 0.6 },
    bloqueioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderLight,
    },
    bloqueioData: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
    bloqueioMotivo: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
    removerText: { fontSize: 16, paddingHorizontal: 8 },
  });
