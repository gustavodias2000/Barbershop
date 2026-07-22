/**
 * TemplatesMensagemScreen — barbeiro personaliza os templates de mensagens
 * enviadas via WhatsApp em cada etapa do agendamento.
 *
 * Variáveis disponíveis:
 *   {nome_barbeiro}  {nome_cliente}  {data}  {horario}  {servico}
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { upsertBarbeiro, getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, TemplatesMensagem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TemplatesMensagem'>;

const VARIAVEIS = [
  '{nome_barbeiro}',
  '{nome_cliente}',
  '{data}',
  '{horario}',
  '{servico}',
];

const DEFAULTS: TemplatesMensagem = {
  agendamento: `Olá {nome_barbeiro}! 👋\n\nSou {nome_cliente} e gostaria de agendar um horário.\n\n📅 Data: {data}\n🕐 Horário: {horario}\n✂️ Serviço: {servico}\n\nAguardo confirmação. Obrigado! 🙏`,
  confirmacao: `Olá {nome_cliente}! 👋\n\nSeu agendamento foi confirmado! ✅\n\n👨‍💼 Barbeiro: {nome_barbeiro}\n📅 Data: {data}\n🕐 Horário: {horario}\n✂️ Serviço: {servico}\n\nNos vemos em breve! 💪`,
  cancelamento: `Olá {nome_cliente}! 👋\n\nInfelizmente precisamos cancelar seu agendamento:\n\n📅 Data: {data}\n🕐 Horário: {horario}\n\nPor favor, reagende quando for conveniente. Obrigado! 🙏`,
  lembrete: `Olá {nome_cliente}! 👋\n\n🔔 Lembrete do seu agendamento:\n\n👨‍💼 Barbeiro: {nome_barbeiro}\n📅 Data: {data}\n🕐 Horário: {horario}\n✂️ Serviço: {servico}\n\nTe esperamos! 💪`,
};

const LABELS: Record<keyof TemplatesMensagem, string> = {
  agendamento: '📩 Solicitação de Agendamento',
  confirmacao: '✅ Confirmação',
  cancelamento: '❌ Cancelamento',
  lembrete: '🔔 Lembrete',
};

export default function TemplatesMensagemScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [templates, setTemplates] = useState<TemplatesMensagem>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeField, setActiveField] = useState<keyof TemplatesMensagem | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const barbeiro = await getBarbeiro(uid);
      if (barbeiro?.templatesMensagem) {
        // Merge with defaults for any missing keys
        setTemplates({ ...DEFAULTS, ...barbeiro.templatesMensagem });
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await upsertBarbeiro(uid, { templatesMensagem: templates });
      Alert.alert('Sucesso!', 'Templates salvos com sucesso.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao salvar templates:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (key: keyof TemplatesMensagem) => {
    Alert.alert(
      'Restaurar padrão',
      'Restaurar o template padrão para este tipo de mensagem?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: () => setTemplates((prev) => ({ ...prev, [key]: DEFAULTS[key] })),
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
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Dica sobre variáveis */}
        <View style={s.helpCard}>
          <Text style={s.helpTitle}>Variáveis disponíveis</Text>
          <Text style={s.helpText}>
            Use estas variáveis no texto — elas serão substituídas automaticamente:
          </Text>
          <View style={s.varRow}>
            {VARIAVEIS.map((v) => (
              <View key={v} style={s.varChip}>
                <Text style={s.varChipText}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Um campo de texto por template */}
        {(Object.keys(LABELS) as Array<keyof TemplatesMensagem>).map((key) => (
          <View key={key} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{LABELS[key]}</Text>
              <TouchableOpacity onPress={() => handleReset(key)}>
                <Text style={s.resetText}>Restaurar padrão</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={templates[key]}
              onChangeText={(text) => setTemplates((prev) => ({ ...prev, [key]: text }))}
              style={[s.textArea, activeField === key && s.textAreaFocused]}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              onFocus={() => setActiveField(key)}
              onBlur={() => setActiveField(null)}
              placeholderTextColor={theme.colors.textMuted}
            />
            <Text style={s.charCount}>{templates[key].length} caracteres</Text>
          </View>
        ))}

        <TouchableOpacity
          style={[s.saveButton, saving && s.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveButtonText}>Salvar Templates</Text>
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
    helpCard: {
      backgroundColor: '#eff6ff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    helpTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: 6,
    },
    helpText: {
      fontSize: 13,
      color: '#374151',
      marginBottom: 10,
      lineHeight: 18,
    },
    varRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    varChip: {
      backgroundColor: theme.colors.primary,
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    varChipText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      fontFamily: 'monospace',
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
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    resetText: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    textArea: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      minHeight: 140,
      lineHeight: 20,
    },
    textAreaFocused: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    charCount: {
      fontSize: 11,
      color: theme.colors.textMuted,
      textAlign: 'right',
      marginTop: 4,
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
