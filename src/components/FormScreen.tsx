import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type FormScreenProps = {
  children: ReactNode;
  /** Altura de cabeçalho a compensar quando o teclado abre (telas com header nativo). */
  keyboardVerticalOffset?: number;
};

/** Contêiner de formulários: rolagem, teclado sem cobrir campos e margens seguras. */
export function FormScreen({ children, keyboardVerticalOffset = 0 }: FormScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
});
