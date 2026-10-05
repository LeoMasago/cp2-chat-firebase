import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, error, style, ...inputProps }, ref) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: fontSize.xs },
});
