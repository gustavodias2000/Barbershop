/**
 * OnboardingScreen — apresentação animada exibida apenas na primeira abertura.
 *
 * • 3 slides por tipo de usuário (cliente / barbeiro)
 * • FlatList horizontal paginada com dot indicators
 * • AsyncStorage guarda a flag após a primeira visualização
 * • Botões "Pular" (vai direto ao último slide) e "Próximo" / "Começar!"
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Conteúdo dos slides ──────────────────────────────────────────────────────

interface Slide {
  key: string;
  emoji: string;
  titulo: string;
  descricao: string;
  corFundo: string;
  corDestaque: string;
}

const SLIDES_CLIENTE: Slide[] = [
  {
    key: 'c1',
    emoji: '🎉',
    titulo: 'Bem-vindo ao Barbershop!',
    descricao:
      'O jeito mais fácil de agendar seu corte favorito sem sair de casa. Rápido, simples e sem filas!',
    corFundo: '#1a1a2e',
    corDestaque: '#3498db',
  },
  {
    key: 'c2',
    emoji: '✂️',
    titulo: 'Escolha seu barbeiro',
    descricao:
      'Veja os serviços, preços e horários disponíveis. Encontre o profissional perfeito para você!',
    corFundo: '#16213e',
    corDestaque: '#2ecc71',
  },
  {
    key: 'c3',
    emoji: '📅',
    titulo: 'Confirme e pronto!',
    descricao:
      'Reserve seu horário em segundos e receba confirmação na hora. Sua cadeira está esperando! 💈',
    corFundo: '#0f3460',
    corDestaque: '#e74c3c',
  },
];

const SLIDES_BARBEIRO: Slide[] = [
  {
    key: 'b1',
    emoji: '💈',
    titulo: 'Bem-vindo, Barbeiro!',
    descricao:
      'Gerencie sua agenda, seus clientes e seus serviços em um único lugar. Profissionalismo na palma da mão!',
    corFundo: '#1a1a2e',
    corDestaque: '#3498db',
  },
  {
    key: 'b2',
    emoji: '📲',
    titulo: 'Receba agendamentos',
    descricao:
      'Clientes reservam horários em tempo real. Você confirma, cancela ou conclui com um toque!',
    corFundo: '#16213e',
    corDestaque: '#f39c12',
  },
  {
    key: 'b3',
    emoji: '🚀',
    titulo: 'Configure e comece!',
    descricao:
      'Defina seus horários, serviços e preços. Em minutos você já estará recebendo os primeiros clientes!',
    corFundo: '#0f3460',
    corDestaque: '#2ecc71',
  },
];

// ─── Chave do AsyncStorage por tipo ──────────────────────────────────────────

export const ONBOARDING_KEY: Record<'cliente' | 'barbeiro', string> = {
  cliente: 'onboardingVisto_cliente',
  barbeiro: 'onboardingVisto_barbeiro',
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function OnboardingScreen({ route, navigation }: Props) {
  const { tipo } = route.params;
  const slides = tipo === 'barbeiro' ? SLIDES_BARBEIRO : SLIDES_CLIENTE;
  const destino = tipo === 'barbeiro' ? 'Barbeiro' : 'Cliente';

  const flatListRef = useRef<FlatList<Slide>>(null);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const concluir = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY[tipo], 'true');
    } catch (_) {
      // ignora falha no storage — o onboarding pode reaparecer na próxima sessão
    }
    // Barbeiro vai para o wizard de configuração inicial (serviços + horário)
    // antes de cair na home vazia. Substitui a tela para não voltar com o back.
    if (tipo === 'barbeiro') {
      navigation.replace('SetupBarbeiro');
    } else {
      navigation.replace(destino as any);
    }
  }, [tipo, destino, navigation]);

  const irParaSlide = (index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setIndiceAtual(index);
  };

  const handleProximo = () => {
    if (indiceAtual < slides.length - 1) {
      irParaSlide(indiceAtual + 1);
    } else {
      concluir();
    }
  };

  const handlePular = () => {
    irParaSlide(slides.length - 1);
  };

  const onMomentumScrollEnd = (e: any) => {
    const novoIndice = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndiceAtual(novoIndice);
  };

  const slideAtual = slides[indiceAtual];
  const isUltimo = indiceAtual === slides.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: slideAtual.corFundo }]}>
      <StatusBar barStyle="light-content" backgroundColor={slideAtual.corFundo} />

      {/* Botão pular (some no último slide) */}
      {!isUltimo && (
        <SafeAreaView style={styles.pularWrapper} edges={['top']}>
          <TouchableOpacity
            onPress={handlePular}
            style={styles.pularBtn}
            accessibilityRole="button"
            accessibilityLabel="Pular apresentação"
          >
            <Text style={styles.pularText}>Pular</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Carrossel */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Círculo decorativo de fundo */}
            <View
              style={[styles.circulo, { borderColor: item.corDestaque + '30' }]}
            />
            <View
              style={[styles.circuloInner, { borderColor: item.corDestaque + '20' }]}
            />

            {/* Emoji principal */}
            <Text style={styles.emoji}>{item.emoji}</Text>

            {/* Linha colorida */}
            <View style={[styles.linha, { backgroundColor: item.corDestaque }]} />

            <Text style={styles.titulo}>{item.titulo}</Text>
            <Text style={styles.descricao}>{item.descricao}</Text>
          </View>
        )}
      />

      {/* Dots + botão */}
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {slides.map((_, i) => {
            const largura = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const cor = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: ['rgba(255,255,255,0.3)', '#fff', 'rgba(255,255,255,0.3)'],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: largura, backgroundColor: cor }]}
              />
            );
          })}
        </View>

        {/* Botão principal */}
        <TouchableOpacity
          style={[
            styles.botao,
            { backgroundColor: slideAtual.corDestaque },
          ]}
          onPress={handleProximo}
          accessibilityRole="button"
          accessibilityLabel={isUltimo ? 'Começar' : 'Próximo slide'}
        >
          <Text style={styles.botaoText}>
            {isUltimo ? '🚀 Começar!' : 'Próximo →'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  pularWrapper: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  pularBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  pularText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 160,
  },
  // Círculos decorativos
  circulo: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    borderWidth: 1,
    top: -SCREEN_WIDTH * 0.15,
    right: -SCREEN_WIDTH * 0.2,
  },
  circuloInner: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.65,
    height: SCREEN_WIDTH * 0.65,
    borderRadius: SCREEN_WIDTH * 0.325,
    borderWidth: 1,
    top: -SCREEN_WIDTH * 0.05,
    right: -SCREEN_WIDTH * 0.1,
  },
  emoji: {
    fontSize: 88,
    marginBottom: 24,
    textAlign: 'center',
  },
  linha: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
  },
  descricao: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 24,
  },
  // Footer com dots + botão
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  botao: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  botaoText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
