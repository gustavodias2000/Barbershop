/**
 * ComissoesScreen — o dono configura a comissão de cada profissional da
 * equipe (percentual ou valor fixo) e vê o relatório de fechamento por
 * período (soma de comissão e faturamento por profissional, a partir dos
 * agendamentos concluídos).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import {
  getNegocioPorDono,
  listarMembros,
  listarProfissionaisDoNegocio,
  definirComissao,
} from '../data/repositories/NegocioRepository';
import { listarConcluidosPorNegocio } from '../data/repositories/AgendamentoRepository';
import { formatMoney, toLocalDateString } from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Barbeiro, MembroEquipe, TipoComissao } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Comissoes'>;

interface LinhaComissao {
  barbeiro: Barbeiro;
  tipo: TipoComissao;
  valorStr: string; // percentual (0-100) ou reais, como string editável
}

type Periodo = '7dias' | '30dias' | 'mes';

function inicioDoPeriodo(periodo: Periodo): Date {
  const hoje = new Date();
  if (periodo === 'mes') {
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }
  const dias = periodo === '7dias' ? 7 : 30;
  const d = new Date(hoje);
  d.setDate(hoje.getDate() - dias);
  return d;
}

export default function ComissoesScreen({ navigation: _navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);
  const uid = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaComissao[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false);
  const [relatorio, setRelatorio] = useState<
    { barbeiro: Barbeiro; qtd: number; faturamentoCentavos: number; comissaoCentavos: number }[]
  >([]);

  const carregar = useCallback(async () => {
    if (!uid) return;
    try {
      const negocio = await getNegocioPorDono(uid);
      if (!negocio) {
        setNegocioId(null);
        setLoading(false);
        return;
      }
      setNegocioId(negocio.id);
      const [barbeiros, membros] = await Promise.all([
        listarProfissionaisDoNegocio(negocio.id),
        listarMembros(negocio.id),
      ]);
      const membrosPorId = new Map<string, MembroEquipe>(membros.map((m) => [m.barbeiroId, m]));
      const linhasProfissionais = barbeiros
        .filter((b) => membrosPorId.get(b.id)?.papel !== 'dono')
        .map((b) => {
          const m = membrosPorId.get(b.id);
          const tipo: TipoComissao = m?.comissaoTipo || 'percentual';
          const valor = tipo === 'percentual' ? m?.comissaoPercentual : (m?.comissaoFixaCentavos ?? 0) / 100;
          return {
            barbeiro: b,
            tipo,
            valorStr: valor ? String(valor).replace('.', ',') : '',
          };
        });
      setLinhas(linhasProfissionais);
    } catch (error) {
      console.error('Erro ao carregar comissões:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados de comissão.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const carregarRelatorio = useCallback(async () => {
    if (!negocioId) return;
    setCarregandoRelatorio(true);
    try {
      const dataInicio = toLocalDateString(inicioDoPeriodo(periodo));
      const dataFim = toLocalDateString(new Date());
      const concluidos = await listarConcluidosPorNegocio(negocioId, dataInicio, dataFim);

      const porBarbeiro = new Map<string, { qtd: number; faturamentoCentavos: number; comissaoCentavos: number }>();
      for (const ag of concluidos) {
        const atual = porBarbeiro.get(ag.barbeiroId) || { qtd: 0, faturamentoCentavos: 0, comissaoCentavos: 0 };
        atual.qtd += 1;
        atual.faturamentoCentavos += ag.precoEmCentavos || 0;
        atual.comissaoCentavos += ag.comissaoCentavos || 0;
        porBarbeiro.set(ag.barbeiroId, atual);
      }

      const linhasRelatorio = linhas
        .map((l) => {
          const dados = porBarbeiro.get(l.barbeiro.id);
          if (!dados) return null;
          return { barbeiro: l.barbeiro, ...dados };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.comissaoCentavos - a.comissaoCentavos);

      setRelatorio(linhasRelatorio);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
      Alert.alert('Erro', 'Não foi possível carregar o relatório. Verifique sua conexão e tente novamente.');
    } finally {
      setCarregandoRelatorio(false);
    }
  }, [negocioId, periodo, linhas]);

  useFocusEffect(
    useCallback(() => {
      if (linhas.length > 0) carregarRelatorio();
    }, [carregarRelatorio, linhas.length]),
  );

  const totalComissao = useMemo(
    () => relatorio.reduce((sum, r) => sum + r.comissaoCentavos, 0),
    [relatorio],
  );

  const atualizarLinha = (barbeiroId: string, patch: Partial<LinhaComissao>) => {
    setLinhas((prev) => prev.map((l) => (l.barbeiro.id === barbeiroId ? { ...l, ...patch } : l)));
  };

  const salvarComissao = async (linha: LinhaComissao) => {
    if (!negocioId) return;
    const valorNum = parseFloat(linha.valorStr.replace(',', '.'));
    if (!valorNum || valorNum <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }
    setSalvandoId(linha.barbeiro.id);
    try {
      const valorParaSalvar = linha.tipo === 'percentual' ? valorNum : Math.round(valorNum * 100);
      await definirComissao(negocioId, linha.barbeiro.id, linha.tipo, valorParaSalvar);
      Alert.alert('Sucesso!', `Comissão de ${linha.barbeiro.nome} atualizada.`);
    } catch (error) {
      console.error('Erro ao salvar comissão:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvandoId(null);
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

  if (!negocioId) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <Text style={s.emptyText}>
            Comissões ficam disponíveis depois que você criar sua equipe em "Minha Equipe".
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionTitle}>Comissão por profissional</Text>
        {linhas.length === 0 ? (
          <Text style={s.emptyText}>Cadastre profissionais em "Minha Equipe" primeiro.</Text>
        ) : (
          linhas.map((linha) => (
            <View key={linha.barbeiro.id} style={s.linhaCard}>
              <Text style={s.linhaNome}>{linha.barbeiro.nome}</Text>
              <View style={s.tipoRow}>
                <TouchableOpacity
                  style={[s.tipoChip, linha.tipo === 'percentual' && s.tipoChipSelected]}
                  onPress={() => atualizarLinha(linha.barbeiro.id, { tipo: 'percentual' })}
                >
                  <Text style={[s.tipoChipText, linha.tipo === 'percentual' && s.tipoChipTextSelected]}>
                    Percentual (%)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tipoChip, linha.tipo === 'fixo' && s.tipoChipSelected]}
                  onPress={() => atualizarLinha(linha.barbeiro.id, { tipo: 'fixo' })}
                >
                  <Text style={[s.tipoChipText, linha.tipo === 'fixo' && s.tipoChipTextSelected]}>
                    Valor fixo (R$)
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={s.valorRow}>
                <TextInput
                  value={linha.valorStr}
                  onChangeText={(v) => atualizarLinha(linha.barbeiro.id, { valorStr: v })}
                  style={s.valorInput}
                  placeholder={linha.tipo === 'percentual' ? 'Ex.: 40' : 'Ex.: 15,00'}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[s.salvarButton, salvandoId === linha.barbeiro.id && s.buttonDisabled]}
                  onPress={() => salvarComissao(linha)}
                  disabled={salvandoId === linha.barbeiro.id}
                >
                  {salvandoId === linha.barbeiro.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={s.salvarButtonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Relatório de fechamento</Text>
        <View style={s.periodoRow}>
          {([
            { key: '7dias', label: '7 dias' },
            { key: '30dias', label: '30 dias' },
            { key: 'mes', label: 'Mês atual' },
          ] as { key: Periodo; label: string }[]).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[s.tipoChip, periodo === opt.key && s.tipoChipSelected]}
              onPress={() => setPeriodo(opt.key)}
            >
              <Text style={[s.tipoChipText, periodo === opt.key && s.tipoChipTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {carregandoRelatorio ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} />
        ) : relatorio.length === 0 ? (
          <Text style={s.emptyText}>Nenhum atendimento concluído nesse período.</Text>
        ) : (
          <>
            <View style={s.group}>
              {relatorio.map((r, i) => (
                <View key={r.barbeiro.id} style={[s.relatorioItem, i === relatorio.length - 1 && s.itemLast]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.linhaNome}>{r.barbeiro.nome}</Text>
                    <Text style={s.relatorioMeta}>
                      {r.qtd} {r.qtd === 1 ? 'atendimento' : 'atendimentos'} · faturamento {formatMoney(r.faturamentoCentavos)}
                    </Text>
                  </View>
                  <Text style={s.relatorioComissao}>{formatMoney(r.comissaoCentavos)}</Text>
                </View>
              ))}
            </View>
            <View style={s.totalCard}>
              <Text style={s.totalLabel}>Total de comissões no período</Text>
              <Text style={s.totalValor}>{formatMoney(totalComissao)}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linhaCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  linhaNome: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  tipoRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tipoChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
  },
  tipoChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tipoChipText: { fontSize: 13, color: theme.colors.textSecondary },
  tipoChipTextSelected: { color: '#fff', fontWeight: '700' },
  valorRow: { flexDirection: 'row', gap: 10 },
  valorInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  salvarButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonDisabled: { opacity: 0.6 },
  salvarButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  periodoRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  group: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  relatorioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemLast: { borderBottomWidth: 0 },
  relatorioMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  relatorioComissao: { fontSize: 16, fontWeight: '800', color: theme.colors.success },
  totalCard: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },
  totalValor: { fontSize: 24, fontWeight: '800', color: theme.colors.primary },
});
