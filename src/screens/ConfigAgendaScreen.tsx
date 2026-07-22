/**
 * ConfigAgendaScreen — barbeiro configura horários de atendimento:
 * - Hora de início e fim
 * - Intervalo de almoço
 * - Antecedência mínima para agendamento
 * - Antecedência máxima (quantos dias à frente o cliente pode agendar)
 * - Dias de atendimento
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { upsertBarbeiro, getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, ConfiguracaoAgenda } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfigAgenda'>;

const HORAS = Array.from({ length: 24 }, (_, h) =>
  [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`],
).flat();

const ANTECEDENCIAS = [
  { label: 'Sem restrição', value: 0 },
  { label: '15 min antes', value: 15 },
  { label: '30 min antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '2 horas antes', value: 120 },
  { label: '3 horas antes', value: 180 },
  { label: '6 horas antes', value: 360 },
  { label: '12 horas antes', value: 720 },
  { label: '24 horas antes', value: 1440 },
];

const PERIODO_MAXIMO = [
  { label: '7 dias', value: 7 },
  { label: '15 dias', value: 15 },
  { label: '30 dias', value: 30 },
  { label: '45 dias', value: 45 },
  { label: '60 dias', value: 60 },
  { label: '90 dias', value: 90 },
  { label: '120 dias', value: 120 },
];

const DIAS = [
  { label: 'Dom', value: 0, short: 'D' },
  { label: 'Seg', value: 1, short: 'S' },
  { label: 'Ter', value: 2, short: 'T' },
  { label: 'Qua', value: 3, short: 'Q' },
  { label: 'Qui', value: 4, short: 'Q' },
  { label: 'Sex', value: 5, short: 'S' },
  { label: 'Sáb', value: 6, short: 'S' },
];

const DEFAULT_CONFIG: ConfiguracaoAgenda = {
  horaInicio: '09:00',
  horaFim: '18:00',
  almocoInicio: '12:00',
  almocoFim: '13:00',
  antecedenciaMinutos: 30,
  antecedenciaMaximaDias: 30,
  diasAtendimento: [1, 2, 3, 4, 5, 6],
};

export default function ConfigAgendaScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [config, setConfig] = useState<ConfiguracaoAgenda>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [almoco, setAlmoco] = useState(true); // toggle do intervalo de almoço

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const barbeiro = await getBarbeiro(uid);
      if (barbeiro?.configuracaoAgenda) {
        const c = barbeiro.configuracaoAgenda;
        setConfig(c);
        setAlmoco(!!c.almocoInicio && !!c.almocoFim);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDia = (dia: number) => {
    setConfig((prev) => {
      const dias = prev.diasAtendimento.includes(dia)
        ? prev.diasAtendimento.filter((d) => d !== dia)
        : [...prev.diasAtendimento, dia].sort();
      return { ...prev, diasAtendimento: dias };
    });
  };

  const handleSave = async () => {
    const configToSave: ConfiguracaoAgenda = {
      ...config,
      almocoInicio: almoco ? config.almocoInicio : '',
      almocoFim: almoco ? config.almocoFim : '',
    };

    if (configToSave.horaInicio >= configToSave.horaFim) {
      Alert.alert('Atenção', 'A hora de início deve ser anterior à hora de fim.');
      return;
    }
    if (almoco && configToSave.almocoInicio >= configToSave.almocoFim) {
      Alert.alert('Atenção', 'O início do almoço deve ser anterior ao fim.');
      return;
    }
    if (configToSave.diasAtendimento.length === 0) {
      Alert.alert('Atenção', 'Selecione ao menos um dia de atendimento.');
      return;
    }

    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await upsertBarbeiro(uid, { configuracaoAgenda: configToSave });
      Alert.alert('Sucesso!', 'Configuração de horários salva.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const renderPickerRow = (
    label: string,
    options: { label: string; value: number | string }[],
    current: number | string,
    onChange: (v: any) => void,
  ) => (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
        {options.map((opt) => (
          <TouchableOpacity
            key={String(opt.value)}
            style={[s.chip, current === opt.value && s.chipSelected]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[s.chipText, current === opt.value && s.chipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const horasOptions = HORAS.map((h) => ({ label: h, value: h }));

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

        {/* Dias de atendimento */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Dias de Atendimento</Text>
          <View style={s.diasRow}>
            {DIAS.map((dia) => (
              <TouchableOpacity
                key={dia.value}
                style={[
                  s.diaButton,
                  config.diasAtendimento.includes(dia.value) && s.diaButtonSelected,
                ]}
                onPress={() => toggleDia(dia.value)}
                accessibilityLabel={dia.label}
                accessibilityState={{ selected: config.diasAtendimento.includes(dia.value) }}
              >
                <Text
                  style={[
                    s.diaText,
                    config.diasAtendimento.includes(dia.value) && s.diaTextSelected,
                  ]}
                >
                  {dia.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Horário de trabalho */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Horário de Atendimento</Text>
          {renderPickerRow(
            'Início',
            horasOptions.filter((h) => h.value < config.horaFim),
            config.horaInicio,
            (v: string) => setConfig((p) => ({ ...p, horaInicio: v })),
          )}
          {renderPickerRow(
            'Fim',
            horasOptions.filter((h) => h.value > config.horaInicio),
            config.horaFim,
            (v: string) => setConfig((p) => ({ ...p, horaFim: v })),
          )}
        </View>

        {/* Intervalo de almoço */}
        <View style={s.card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Intervalo de Almoço</Text>
            <Switch
              value={almoco}
              onValueChange={setAlmoco}
              trackColor={{ true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
          {almoco && (
            <>
              {renderPickerRow(
                'Início do almoço',
                horasOptions.filter(
                  (h) => h.value > config.horaInicio && h.value < config.horaFim,
                ),
                config.almocoInicio,
                (v: string) => setConfig((p) => ({ ...p, almocoInicio: v })),
              )}
              {renderPickerRow(
                'Fim do almoço',
                horasOptions.filter(
                  (h) =>
                    h.value > config.almocoInicio && h.value < config.horaFim,
                ),
                config.almocoFim,
                (v: string) => setConfig((p) => ({ ...p, almocoFim: v })),
              )}
              <Text style={s.hint}>
                Horários entre {config.almocoInicio} e {config.almocoFim} não aparecerão
                para o cliente.
              </Text>
            </>
          )}
        </View>

        {/* Antecedência mínima */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Antecedência Mínima para Agendar</Text>
          <Text style={s.hint}>
            Evite agendamentos em cima da hora. Ex: "30 min antes" bloqueia
            horários nos próximos 30 minutos.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
            {ANTECEDENCIAS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  s.chip,
                  config.antecedenciaMinutos === opt.value && s.chipSelected,
                ]}
                onPress={() =>
                  setConfig((p) => ({ ...p, antecedenciaMinutos: opt.value }))
                }
              >
                <Text
                  style={[
                    s.chipText,
                    config.antecedenciaMinutos === opt.value && s.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Período máximo */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Período Máximo para Agendar</Text>
          <Text style={s.hint}>
            Quantos dias à frente o cliente pode marcar um horário.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
            {PERIODO_MAXIMO.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  s.chip,
                  config.antecedenciaMaximaDias === opt.value && s.chipSelected,
                ]}
                onPress={() =>
                  setConfig((p) => ({ ...p, antecedenciaMaximaDias: opt.value }))
                }
              >
                <Text
                  style={[
                    s.chipText,
                    config.antecedenciaMaximaDias === opt.value && s.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Botão salvar */}
        <TouchableOpacity
          style={[s.saveButton, saving && s.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Salvar configurações de horário"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveButtonText}>Salvar Configurações</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    scroll: {
      padding: 16,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    diasRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    diaButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceVariant,
      minWidth: 44,
      alignItems: 'center',
    },
    diaButtonSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    diaText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    diaTextSelected: {
      color: '#fff',
      fontWeight: '700',
    },
    fieldGroup: {
      marginBottom: 12,
    },
    fieldLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 6,
      fontWeight: '600',
    },
    chipScroll: {
      flexDirection: 'row',
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceVariant,
      marginRight: 8,
    },
    chipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    chipText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    chipTextSelected: {
      color: '#fff',
      fontWeight: '700',
    },
    hint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 10,
      lineHeight: 17,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
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
