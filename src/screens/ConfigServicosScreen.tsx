/**
 * ConfigServicosScreen — barbeiro cadastra/edita seus serviços
 * com nome, duração e preço. Os serviços são exibidos ao cliente
 * na tela de agendamento para seleção.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { upsertBarbeiro, getBarbeiro } from '../data/repositories/BarbeiroRepository';
import { atualizarProfissional } from '../data/repositories/NegocioRepository';
import { formatMoney } from '../utils/dateUtils';
import { getServicosPreSelecionados } from '../utils/servicosPadrao';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, ServicoBarbeiro } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfigServicos'>;

const DURACOES = [
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hora', value: 60 },
  { label: '1h 15', value: 75 },
  { label: '1h 30', value: 90 },
  { label: '2 horas', value: 120 },
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function ConfigServicosScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const profissionalId = route.params?.profissionalId;
  const profissionalNome = route.params?.profissionalNome;
  const targetId = profissionalId || auth.currentUser?.uid;

  const [servicos, setServicos] = useState<ServicoBarbeiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Campos do formulário no modal
  const [nomeServico, setNomeServico] = useState('');
  const [duracao, setDuracao] = useState(30);
  const [precoStr, setPrecoStr] = useState('');

  useEffect(() => {
    loadServicos();
  }, []);

  const loadServicos = async () => {
    try {
      if (!targetId) return;
      const barbeiro = await getBarbeiro(targetId);
      if (barbeiro?.servicos && barbeiro.servicos.length > 0) {
        setServicos(barbeiro.servicos);
      } else {
        setServicos(getServicosPreSelecionados());
      }
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (servico?: ServicoBarbeiro) => {
    if (servico) {
      setEditingId(servico.id);
      setNomeServico(servico.nome);
      setDuracao(servico.duracaoMinutos);
      const reais = servico.precoEmCentavos / 100;
      setPrecoStr(reais.toFixed(2).replace('.', ','));
    } else {
      setEditingId(null);
      setNomeServico('');
      setDuracao(30);
      setPrecoStr('');
    }
    setModalVisible(true);
  };

  const handleSalvarServico = () => {
    if (!nomeServico.trim()) {
      Alert.alert('Atenção', 'Informe o nome do serviço.');
      return;
    }
    const precoDigits = precoStr.replace(',', '.').replace(/[^0-9.]/g, '');
    const precoEmCentavos = Math.round(parseFloat(precoDigits || '0') * 100);
    if (precoEmCentavos <= 0) {
      Alert.alert('Atenção', 'Informe um preço válido.');
      return;
    }

    setServicos((prev) => {
      if (editingId) {
        return prev.map((s) =>
          s.id === editingId
            ? { ...s, nome: nomeServico.trim(), duracaoMinutos: duracao, precoEmCentavos }
            : s,
        );
      }
      return [
        ...prev,
        {
          id: generateId(),
          nome: nomeServico.trim(),
          duracaoMinutos: duracao,
          precoEmCentavos,
        },
      ];
    });
    setModalVisible(false);
  };

  const handleExcluir = (id: string) => {
    Alert.alert('Excluir serviço', 'Tem certeza que deseja excluir este serviço?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => setServicos((prev) => prev.filter((s) => s.id !== id)),
      },
    ]);
  };

  const handleSaveAll = async () => {
    if (servicos.length === 0) {
      Alert.alert('Atenção', 'Adicione ao menos um serviço.');
      return;
    }
    setSaving(true);
    try {
      if (!targetId) return;
      if (profissionalId) {
        await atualizarProfissional(profissionalId, { servicos });
      } else {
        await upsertBarbeiro(targetId, { servicos });
      }
      Alert.alert('Sucesso!', 'Serviços salvos com sucesso.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao salvar serviços:', error);
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
      <FlatList
        data={servicos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            {profissionalId && (
              <View style={s.profissionalBanner}>
                <Text style={s.profissionalBannerText}>
                  Editando os serviços de {profissionalNome || 'um profissional da equipe'}
                </Text>
              </View>
            )}
            <Text style={s.subtitle}>
              Defina seus serviços com duração e preço. O agendamento inteligente
              calculará os horários disponíveis com base na duração.
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>Nenhum serviço cadastrado.</Text>
            <Text style={s.emptySubtext}>Toque em "+" para adicionar.</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={[s.saveButton, saving && s.saveButtonDisabled]}
            onPress={handleSaveAll}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveButtonText}>Salvar Serviços</Text>
            )}
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardContent}>
              <Text style={s.servicoNome}>{item.nome}</Text>
              <View style={s.servicoMeta}>
                <Text style={s.servicoInfo}>⏱ {item.duracaoMinutos} min</Text>
                <Text style={s.servicoPreco}>{formatMoney(item.precoEmCentavos)}</Text>
              </View>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity
                style={[s.iconButton, s.editButton]}
                onPress={() => openModal(item)}
                accessibilityLabel={`Editar ${item.nome}`}
              >
                <Text style={s.iconButtonText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.iconButton, s.deleteButton]}
                onPress={() => handleExcluir(item.id)}
                accessibilityLabel={`Excluir ${item.nome}`}
              >
                <Text style={s.iconButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* FAB para adicionar */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => openModal()}
        accessibilityRole="button"
        accessibilityLabel="Adicionar serviço"
      >
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal de edição/criação */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {editingId ? 'Editar Serviço' : 'Novo Serviço'}
            </Text>

            <Text style={s.label}>Nome do serviço</Text>
            <TextInput
              value={nomeServico}
              onChangeText={setNomeServico}
              style={s.input}
              placeholder="Ex.: Corte degradê"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={s.label}>Duração</Text>
            <View style={s.duracaoRow}>
              {DURACOES.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[s.duracaoChip, duracao === d.value && s.duracaoChipSelected]}
                  onPress={() => setDuracao(d.value)}
                >
                  <Text
                    style={[
                      s.duracaoChipText,
                      duracao === d.value && s.duracaoChipTextSelected,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Preço (R$)</Text>
            <TextInput
              value={precoStr}
              onChangeText={setPrecoStr}
              style={s.input}
              placeholder="Ex.: 45,00"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
            />

            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={s.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmButton} onPress={handleSalvarServico}>
                <Text style={s.confirmButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
      paddingBottom: 100,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    profissionalBanner: {
      backgroundColor: theme.colors.primary + '20',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    profissionalBannerText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
      textAlign: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    emptySubtext: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    cardContent: {
      flex: 1,
    },
    servicoNome: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
    },
    servicoMeta: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    servicoInfo: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    servicoPreco: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.success,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    editButton: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    deleteButton: {
      backgroundColor: '#fef2f2',
    },
    iconButtonText: {
      fontSize: 18,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 16,
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
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 8,
    },
    fabText: {
      color: '#fff',
      fontSize: 28,
      lineHeight: 32,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      marginBottom: 16,
    },
    duracaoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    duracaoChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceVariant,
    },
    duracaoChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    duracaoChipText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    duracaoChipTextSelected: {
      color: '#fff',
      fontWeight: '700',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
    },
    confirmButtonText: {
      fontSize: 15,
      color: '#fff',
      fontWeight: '700',
    },
  });
