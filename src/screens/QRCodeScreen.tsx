/**
 * QRCodeScreen — exibe o QR Code do barbeiro para o cliente escanear.
 *
 * Sem dependência nativa: usa a API pública qr-server.com para gerar
 * a imagem do QR Code. Funciona offline? Não — mas não exige pod install.
 *
 * O QR Code codifica um deep link do app: barbershop://agendar/{barbeiroId}
 * Futuramente pode ser substituído pelo link web quando implementado.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebaseConfig';
import { useTheme, type Theme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'QRCode'>;

const QR_SIZE = 240;

export default function QRCodeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const s = getStyles(theme);

  const uid = auth.currentUser?.uid || '';
  const displayName =
    auth.currentUser?.displayName ||
    auth.currentUser?.email?.split('@')[0] ||
    'barbeiro';

  // Link deep link do app + fallback para Play Store
  const deepLink = `barbershop://agendar/${uid}`;

  // QR Code gerado via API sem dependência nativa
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(deepLink)}&color=000000&bgcolor=ffffff&margin=10`;

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `Agende seu horário comigo pelo app Barbershop! 📱✂️\n\n` +
          `Baixe o app e use meu código de barbeiro:\n` +
          `🔑 ${uid}\n\n` +
          `Ou escaneie o QR Code impresso na barbearia.`,
        title: 'Agendar com ' + displayName,
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar.');
    }
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `barbershop://agendar/${uid}`,
        url: deepLink,
        title: 'Link de agendamento',
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível compartilhar o link.');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Instruções */}
        <View style={s.infoCard}>
          <Text style={s.infoTitle}>🔲 Seu QR Code de Agendamento</Text>
          <Text style={s.infoText}>
            Imprima e cole este QR Code na sua barbearia. Quando o cliente
            escanear, o app abre direto na tela de agendamento com você.
          </Text>
        </View>

        {/* QR Code */}
        <View style={s.qrContainer}>
          {!imageLoaded && !imageError && (
            <View style={s.qrPlaceholder}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={s.qrLoadingText}>Gerando QR Code...</Text>
            </View>
          )}
          {imageError && (
            <View style={s.qrPlaceholder}>
              <Text style={s.qrErrorIcon}>📵</Text>
              <Text style={s.qrErrorText}>
                Sem conexão à internet.{'\n'}O QR Code requer conexão para ser gerado.
              </Text>
            </View>
          )}
          <Image
            source={{ uri: qrUrl }}
            style={[
              s.qrImage,
              (!imageLoaded || imageError) && s.qrImageHidden,
            ]}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageLoaded(false);
              setImageError(true);
            }}
            accessibilityLabel="QR Code de agendamento"
          />
        </View>

        {/* ID do barbeiro */}
        <View style={s.idCard}>
          <Text style={s.idLabel}>Código do barbeiro</Text>
          <Text style={s.idValue} selectable>{uid}</Text>
          <Text style={s.idHint}>
            Clientes sem câmera podem informar este código no app.
          </Text>
        </View>

        {/* Botões de ação */}
        <TouchableOpacity style={s.shareButton} onPress={handleShare}>
          <Text style={s.shareButtonText}>📤 Compartilhar via WhatsApp / mais</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.shareLinkButton} onPress={handleShareLink}>
          <Text style={s.shareLinkText}>🔗 Copiar link direto</Text>
        </TouchableOpacity>

        {/* Dica de impressão */}
        <View style={s.tipCard}>
          <Text style={s.tipTitle}>💡 Dica de uso</Text>
          <Text style={s.tipText}>
            Tire um print desta tela e mande para uma gráfica imprimir em tamanho
            A5 ou A4. Cole no espelho ou balcão da barbearia para que os clientes
            que estão aguardando possam agendar facilmente o próximo horário.
          </Text>
        </View>
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
    scroll: {
      padding: 16,
      paddingBottom: 40,
      alignItems: 'center',
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      width: '100%',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    qrContainer: {
      width: QR_SIZE + 24,
      height: QR_SIZE + 24,
      backgroundColor: '#ffffff',
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
      padding: 12,
    },
    qrPlaceholder: {
      position: 'absolute',
      alignItems: 'center',
      gap: 12,
    },
    qrLoadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    qrErrorIcon: {
      fontSize: 40,
    },
    qrErrorText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    qrImage: {
      width: QR_SIZE,
      height: QR_SIZE,
      borderRadius: 8,
    },
    qrImageHidden: {
      opacity: 0,
      position: 'absolute',
    },
    idCard: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      padding: 14,
      width: '100%',
      marginBottom: 16,
      alignItems: 'center',
    },
    idLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 6,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    idValue: {
      fontSize: 13,
      color: theme.colors.text,
      fontFamily: 'monospace',
      marginBottom: 4,
    },
    idHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
    shareButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 16,
      paddingHorizontal: 24,
      width: '100%',
      alignItems: 'center',
      marginBottom: 10,
      minHeight: 52,
      justifyContent: 'center',
    },
    shareButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    shareLinkButton: {
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 24,
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 48,
      justifyContent: 'center',
    },
    shareLinkText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },
    tipCard: {
      backgroundColor: '#fefce8',
      borderRadius: 10,
      padding: 14,
      width: '100%',
      borderLeftWidth: 4,
      borderLeftColor: '#eab308',
    },
    tipTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#713f12',
      marginBottom: 6,
    },
    tipText: {
      fontSize: 13,
      color: '#713f12',
      lineHeight: 19,
    },
  });
