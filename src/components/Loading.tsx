import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '../theme';

type LoadingProps = {
  message?: string;
  /** Ocupa a tela inteira (splash/primeiro carregamento). */
  fullScreen?: boolean;
};

export function Loading({ message, fullScreen = false }: LoadingProps) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  fullScreen: { flex: 1, backgroundColor: colors.background },
  message: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
});
