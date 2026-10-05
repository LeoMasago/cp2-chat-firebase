import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '../theme';
import { Button } from './Button';

type ErrorMessageProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** `block` ocupa a área do conteúdo (erro de carregamento); `inline` é um aviso compacto. */
  variant?: 'block' | 'inline';
};

export function ErrorMessage({ message, onRetry, retryLabel = 'Tentar novamente', variant = 'block' }: ErrorMessageProps) {
  if (variant === 'inline') {
    return (
      <View style={styles.inline} accessibilityRole="alert">
        <Ionicons name="alert-circle" size={18} color={colors.danger} />
        <Text style={styles.inlineText}>{message}</Text>
      </View>
    );
  }
  return (
    <View style={styles.block} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={44} color={colors.danger} />
      <Text style={styles.blockText}>{message}</Text>
      {onRetry ? <Button title={retryLabel} onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  blockText: { color: colors.text, fontSize: fontSize.md, textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inlineText: { flex: 1, color: colors.danger, fontSize: fontSize.sm },
});
