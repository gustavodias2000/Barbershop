/**
 * ClientesScreen — agenda de clientes do barbeiro.
 *
 * Resolve a fricção de cadastro em massa: o barbeiro pode importar sua
 * agenda de contatos do telefone de uma vez (com permissão explícita), ou
 * cadastrar manualmente. Serve de base para uma futura tela de
 * "agendamento manual pelo barbeiro".
 */
import React, { useState, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import {
  listarClientesDoBarbeiro,
  adicionarClienteManual,
  atualizarCliente,
  importarClientesEmLote,
  removerCliente,
} from '../data/repositories/ClienteContatoRepository';
import {
  maskPhone,
  formatPhoneToE164,
  maskDiaMes,
  diaMesParaAniversario,
  aniversarioParaExibicao,
  birthdayParaAniversario,
} from '../utils/dateUtils';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, ClienteContato } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Clientes'>;

/** Subconjunto dos campos de `react-native-contacts` que usamos na importação. */
interface ContatoDoTelefone {
  givenName?: string;
  familyName?: string;
  phoneNumbers: Array<{ number: string }>;
  birthday?: { day?: number; month?: number; year?: number };
}

export default function ClientesScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [clientes, setClientes] = useState<ClienteContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [salvandoManual, setSalvandoManual] = useState(false);
  const [nomeManual, setNomeManual] = useState('');
  const [telefoneManual, setTelefoneManual] = useState('');
  const [aniversarioManual, setAniversarioManual] = useState('');
  /** null = cadastrando um novo cliente; preenchido = editando este cliente. */
  const [clienteEditando, setClienteEditando] = useState<ClienteContato | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchClientes();
    }, []),
  );

  const fetchClientes = async () => {
    try {
      const uid = auth.currentUser?.uid;
      const data = await listarClientesDoBarbeiro(uid);
      setClientes(data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalManual = () => {
    setClienteEditando(null);
    setNomeManual('');
    setTelefoneManual('');
    setAniversarioManual('');
    setModalVisible(true);
  };

  const abrirModalEdicao = (cliente: ClienteContato) => {
    setClienteEditando(cliente);
    setNomeManual(cliente.nome);
    setTelefoneManual(cliente.telefone ? maskPhone(cliente.telefone.replace(/^55/, '')) : '');
    setAniversarioManual(cliente.aniversario ? aniversarioParaExibicao(cliente.aniversario) : '');
    setModalVisible(true);
  };

  const handleSalvarManual = async () => {
    if (!nomeManual.trim()) {
      Alert.alert('Atenção', 'Informe o nome do cliente.');
      return;
    }
    if (aniversarioManual && aniversarioManual.replace(/\D/g, '').length === 4 && !diaMesParaAniversario(aniversarioManual)) {
      Alert.alert('Atenção', 'Data de aniversário inválida.');
      return;
    }
    setSalvandoManual(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const dados = {
        nome: nomeManual.trim(),
        telefone: telefoneManual ? formatPhoneToE164(telefoneManual) : undefined,
        aniversario: diaMesParaAniversario(aniversarioManual),
      };
      if (clienteEditando) {
        await atualizarCliente(uid, clienteEditando.id, dados);
      } else {
        await adicionarClienteManual(uid, dados);
      }
      setModalVisible(false);
      fetchClientes();
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvandoManual(false);
    }
  };

  const handleExcluir = (cliente: ClienteContato) => {
    Alert.alert('Remover cliente', `Remover "${cliente.nome}" da sua agenda?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            await removerCliente(uid, cliente.id);
            setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
          } catch (error) {
            console.error('Erro ao remover cliente:', error);
            Alert.alert('Erro', 'Não foi possível remover. Tente novamente.');
          }
        },
      },
    ]);
  };

  /**
   * Importa contatos do telefone. Requer o módulo nativo `react-native-contacts`
   * (permissão declarada em AndroidManifest.xml / Info.plist). Se a permissão
   * for negada, orienta o usuário a habilitá-la manualmente nas configurações
   * do sistema — nunca insiste nem repete o pedido automaticamente.
   */
  const handleImportarContatos = async () => {
    setImportando(true);
    try {
      // Import dinâmico: evita custo de carregar o módulo nativo em telas
      // que nunca usam esta função.
      const Contacts = (await import('react-native-contacts')).default;

      const permissao = await Contacts.requestPermission();
      if (permissao !== 'authorized') {
        Alert.alert(
          'Permissão necessária',
          'Para importar contatos, permita o acesso à sua agenda nas configurações do celular.',
          [
            { text: 'Agora não', style: 'cancel' },
            { text: 'Abrir configurações', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const todosContatos = (await Contacts.getAll()) as ContatoDoTelefone[];
      const telefonesJaCadastrados = new Set(
        clientes.map((c) => c.telefone).filter(Boolean) as string[],
      );

      const candidatos = todosContatos
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => {
          const nome = `${c.givenName || ''} ${c.familyName || ''}`.trim() || 'Sem nome';
          const telefone = formatPhoneToE164(c.phoneNumbers[0].number);
          const aniversario = birthdayParaAniversario(c.birthday);
          return { nome, telefone, aniversario };
        })
        .filter((c) => c.telefone && !telefonesJaCadastrados.has(c.telefone));

      if (candidatos.length === 0) {
        Alert.alert('Nada para importar', 'Todos os seus contatos com telefone já estão na sua agenda de clientes.');
        return;
      }

      Alert.alert(
        'Importar contatos',
        `Encontramos ${candidatos.length} contato${candidatos.length === 1 ? '' : 's'} com telefone que ainda não estão na sua agenda. Importar todos?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Importar',
            onPress: async () => {
              // O Alert nativo não fica "preso" ao fluxo async anterior — sem
              // isso, o app fica sem nenhum indicador visual enquanto salva
              // (o spinner da fase de leitura já tinha sido desligado).
              setImportando(true);
              try {
                const uid = auth.currentUser?.uid;
                if (!uid) return;
                const total = await importarClientesEmLote(uid, candidatos);
                Alert.alert('Sucesso!', `${total} contato${total === 1 ? '' : 's'} importado${total === 1 ? '' : 's'}.`);
                fetchClientes();
              } catch (error) {
                console.error('Erro ao importar contatos:', error);
                Alert.alert('Erro', 'Não foi possível concluir a importação. Tente novamente.');
              } finally {
                setImportando(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Erro ao acessar contatos:', error);
      Alert.alert(
        'Não foi possível acessar seus contatos',
        'Verifique se o app tem permissão de acesso à agenda de contatos.',
      );
    } finally {
      setImportando(false);
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
        data={clientes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>👥</Text>
            <Text style={s.emptyTitle}>Você ainda não possui clientes</Text>
            <Text style={s.emptyDesc}>
              Para facilitar, você pode importar da sua agenda de contatos ou cadastrar manualmente.
            </Text>
            <TouchableOpacity
              style={[s.primaryButton, importando && s.buttonDisabled]}
              onPress={handleImportarContatos}
              disabled={importando}
              accessibilityRole="button"
              accessibilityLabel="Importar contatos"
            >
              {importando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryButtonText}>📇 Importar contatos</Text>
              )}
            </TouchableOpacity>
            <Text style={s.ouText}>ou</Text>
            <TouchableOpacity
              style={s.secondaryButton}
              onPress={abrirModalManual}
              accessibilityRole="button"
              accessibilityLabel="Novo cliente"
            >
              <Text style={s.secondaryButtonText}>Novo cliente</Text>
            </TouchableOpacity>
          </View>
        }
        ListHeaderComponent={
          clientes.length > 0 ? (
            <View style={s.headerRow}>
              <Text style={s.subtitle}>
                {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} na sua agenda
              </Text>
              <View style={s.headerActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Aniversariantes')}
                  accessibilityRole="button"
                  accessibilityLabel="Ver aniversariantes"
                >
                  <Text style={s.importarLink}>🎂 Aniversários</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleImportarContatos}
                  disabled={importando}
                  accessibilityRole="button"
                  accessibilityLabel="Importar mais contatos"
                >
                  {importando ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Text style={s.importarLink}>📇 Importar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => abrirModalEdicao(item)}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.nome}`}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.clienteNome}>{item.nome}</Text>
              {item.telefone ? <Text style={s.clienteTelefone}>{item.telefone}</Text> : null}
              {item.aniversario ? (
                <Text style={s.clienteTelefone}>🎂 {aniversarioParaExibicao(item.aniversario)}</Text>
              ) : null}
            </View>
            {item.origem === 'contatos' && (
              <View style={s.badge}>
                <Text style={s.badgeText}>Contatos</Text>
              </View>
            )}
            <TouchableOpacity
              style={s.deleteButton}
              onPress={() => handleExcluir(item)}
              accessibilityLabel={`Remover ${item.nome}`}
            >
              <Text style={s.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {clientes.length > 0 && (
        <TouchableOpacity
          style={s.fab}
          onPress={abrirModalManual}
          accessibilityRole="button"
          accessibilityLabel="Adicionar cliente"
        >
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      )}

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
            <Text style={s.modalTitle}>{clienteEditando ? 'Editar Cliente' : 'Novo Cliente'}</Text>

            <Text style={s.label}>Nome</Text>
            <TextInput
              value={nomeManual}
              onChangeText={setNomeManual}
              style={s.input}
              placeholder="Nome do cliente"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={s.label}>Telefone (opcional)</Text>
            <TextInput
              value={telefoneManual}
              onChangeText={(t) => setTelefoneManual(maskPhone(t))}
              style={s.input}
              placeholder="(11) 99999-9999"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
              maxLength={15}
            />

            <Text style={s.label}>Aniversário (opcional)</Text>
            <TextInput
              value={aniversarioManual}
              onChangeText={(t) => setAniversarioManual(maskDiaMes(t))}
              style={s.input}
              placeholder="DD/MM"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              maxLength={5}
            />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmButton, salvandoManual && s.buttonDisabled]}
                onPress={handleSalvarManual}
                disabled={salvandoManual}
              >
                {salvandoManual ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.confirmButtonText}>Salvar</Text>
                )}
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
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, paddingBottom: 100, flexGrow: 1 },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    importarLink: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
      paddingHorizontal: 32,
    },
    emptyIcon: { fontSize: 56, marginBottom: 16 },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyDesc: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 24,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
      width: '100%',
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    ouText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginVertical: 12,
    },
    secondaryButton: {
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 24,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      width: '100%',
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    avatarText: {
      color: theme.colors.primary,
      fontWeight: '700',
      fontSize: 16,
    },
    clienteNome: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    clienteTelefone: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 8,
    },
    badgeText: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    deleteButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteButtonText: {
      fontSize: 16,
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
