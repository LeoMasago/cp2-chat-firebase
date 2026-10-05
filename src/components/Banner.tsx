import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '../theme';

export type BannerTone = 'info' | 'warning' | 'error' | 'success';

const toneStyles: Record<BannerTone, { background: string; foreground: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { background: colors.infoSoft, foreground: colors.info, icon: 'information-circle' },
  warning: { background: colors.warningSoft, foreground: colors.warning, icon: 'warning' },
  error: { background: colors.dangerSoft, foreground: colors.danger, icon: 'alert-circle' },
  success: { background: colors.successSoft, foreground: colors.success, icon: 'checkmark-circle' },
};

type BannerProps = {
  message: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

/** Faixa de aviso (permissão negada, falha de envio, sem conexão...). */
export function Banner({ message, tone = 'info', actionLabel, onAction, onDismiss }: BannerProps) {
  const { background, foreground, icon } = toneStyles[tone];
  return (
    <View style={[styles.banner, { backgroundColor: background }]} accessibilityRole="alert">
      <Ionicons name={icon} size={20} color={foreground} />
      <Text style={[styles.text, { color: foreground }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.action, { color: foreground }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dispensar aviso">
          <Ionicons name="close" size={18} color={foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: { flex: 1, fontSize: fontSize.sm },
  action: { fontSize: fontSize.sm, fontWeight: '700', textDecorationLine: 'underline' },
});
