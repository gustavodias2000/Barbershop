/**
 * PromocaoScreen — barbeiro envia uma mensagem promocional (desconto,
 * novidade, campanha) para todos os clientes da sua agenda de uma vez,
 * via WhatsApp.
 *
 * Reaproveita o mesmo WhatsAppService/Cloud Function `sendWhatsApp` já
 * usado para confirmações e lembretes — sem infraestrutura nova. O envio é
 * feito um cliente por vez (a Cloud Function não tem endpoint de envio em
 * massa), então mostramos o progresso real ("Enviando 3 de 20...") em vez
 * de travar a tela sem feedback durante o processo.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from '../../firebaseConfig';
import { listarClientesDoBarbeiro } from '../data/repositories/ClienteContatoRepository';
import WhatsAppService from '../services/WhatsAppService';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, ClienteContato } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Promocao'>;

export default function PromocaoScreen({ navigation: _navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const [clientes, setClientes] = useState<ClienteContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ enviados: 0, total: 0 });

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, []),
  );

  const carregar = async () => {
    try {
      const uid = auth.currentUser?.uid;
      const data = await listarClientesDoBarbeiro(uid);
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const destinatarios = clientes.filter((c) => !!c.telefone);

  const handleEnviar = () => {
    if (!mensagem.trim()) {
      Alert.alert('Atenção', 'Escreva a mensagem que deseja enviar.');
      return;
    }
    if (destinatarios.length === 0) {
      Alert.alert('Sem destinatários', 'Nenhum cliente da sua agenda tem telefone cadastrado.');
      return;
    }

    Alert.alert(
      'Enviar promoção',
      `Enviar esta mensagem para ${destinatarios.length} cliente${destinatarios.length === 1 ? '' : 's'} pelo WhatsApp?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: enviarParaTodos },
      ],
    );
  };

  const enviarParaTodos = async () => {
    setEnviando(true);
    setProgresso({ enviados: 0, total: destinatarios.length });
    let sucesso = 0;
    let falhas = 0;

    for (const cliente of destinatarios) {
      try {
        const texto = WhatsAppService.gerarMensagemPromocional({ nome: cliente.nome }, mensagem.trim());
        const ok = await WhatsAppService.sendTextMessage(cliente.telefone!, texto);
        if (ok) sucesso += 1;
        else falhas += 1;
      } catch (error) {
        console.error(`Erro ao enviar promoção para ${cliente.nome}:`, error);
        falhas += 1;
      }
      setProgresso((prev) => ({ ...prev, enviados: prev.enviados + 1 }));
    }

    setEnviando(false);
    setMensagem('');
    Alert.alert(
      'Envio concluído',
      falhas === 0
        ? `Mensagem enviada para ${sucesso} cliente${sucesso === 1 ? '' : 's'}.`
        : `${sucesso} enviada${sucesso === 1 ? '' : 's'} com sucesso, ${falhas} falhou${falhas === 1 ? '' : 'aram'}.`,
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
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.subtitle}>
          Envie uma mensagem de promoção, desconto ou novidade para toda a sua carteira de clientes de
          uma só vez. Use <Text style={s.code}>{'{nome_cliente}'}</Text> na mensagem para personalizar
          com o nome de cada cliente.
        </Text>

        <Text style={s.destinatariosText}>
          {destinatarios.length} de {clientes.length} cliente{clientes.length === 1 ? '' : 's'} da sua
          agenda {destinatarios.length === 1 ? 'tem' : 'têm'} telefone cadastrado e receberá{destinatarios.length === 1 ? '' : 'ão'} a mensagem.
        </Text>

        <Text style={s.label}>Mensagem</Text>
        <TextInput
          value={mensagem}
          onChangeText={setMensagem}
          style={s.textArea}
          placeholder="Ex.: Olá {nome_cliente}! Essa semana o corte está com 20% de desconto. Agende já! 💈"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={6}
          editable={!enviando}
        />

        {enviando ? (
          <View style={s.progressoContainer}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={s.progressoText}>
              Enviando {progresso.enviados} de {progresso.total}...
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.enviarButton, destinatarios.length === 0 && s.buttonDisabled]}
            onPress={handleEnviar}
            disabled={destinatarios.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Enviar promoção"
          >
            <Text style={s.enviarButtonText}>📣 Enviar promoção</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: 20, paddingBottom: 40 },
    subtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    code: {
      fontWeight: '700',
      color: theme.colors.text,
    },
    destinatariosText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: 20,
      lineHeight: 18,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 6,
    },
    textArea: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      minHeight: 140,
      textAlignVertical: 'top',
      marginBottom: 24,
    },
    enviarButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 15,
      alignItems: 'center',
      minHeight: 50,
      justifyContent: 'center',
    },
    enviarButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    progressoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 15,
    },
    progressoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
  });
