/**
 * Skeleton — placeholders animados de carregamento (item 17 da auditoria).
 * Substitui o spinner de tela cheia por "fantasmas" do conteúdo, padrão
 * moderno (Facebook/LinkedIn) que reduz a percepção de espera.
 *
 * Sem dependências externas: usa apenas Animated do próprio React Native.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type DimensionValue,
} from 'react-native';
import { useTheme, type Theme } from '../context/ThemeContext';

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bloco básico pulsante.
 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 6,
  style,
}: SkeletonBlockProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.surfaceVariant,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Card fantasma no formato dos cards de barbeiro/agendamento.
 */
export function SkeletonCard() {
  const { theme } = useTheme();
  const s = getStyles(theme);
  return (
    <View style={s.card}>
      <View style={s.row}>
        <SkeletonBlock width={50} height={50} radius={25} />
        <View style={s.lines}>
          <SkeletonBlock width="60%" height={16} />
          <SkeletonBlock width="40%" height={12} style={styles.mt8} />
          <SkeletonBlock width="30%" height={12} style={styles.mt8} />
        </View>
      </View>
      <SkeletonBlock height={40} radius={8} style={styles.mt14} />
    </View>
  );
}

/**
 * Lista de N cards fantasmas — usada enquanto as telas carregam.
 */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityLabel="Carregando conteúdo" accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
});

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
      borderRadius: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    lines: {
      flex: 1,
      marginLeft: 12,
    },
  });
