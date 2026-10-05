import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const backgrounds: Record<ButtonVariant, string> = {
  primary: colors.primary,
  secondary: colors.primarySoft,
  danger: colors.danger,
  ghost: 'transparent',
};

const textColors: Record<ButtonVariant, string> = {
  primary: colors.textOnPrimary,
  secondary: colors.primary,
  danger: colors.textOnPrimary,
  ghost: colors.primary,
};

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: backgrounds[variant] },
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} />
      ) : (
        <Text style={[styles.title, { color: textColors[variant] }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fontSize.lg, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
});
