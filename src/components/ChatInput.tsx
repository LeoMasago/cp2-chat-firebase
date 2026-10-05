import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';

export const MAX_MESSAGE_LENGTH = 2000;

type ChatInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  disabled?: boolean;
  /** Destinatário da mensagem em grupos (chip "Para: ..."). */
  recipient?: { label: string; isTargeted: boolean; onPress: () => void; onClear: () => void };
  /** Abre a lista de integrantes para inserir uma menção (@nome). */
  onMentionPress?: () => void;
};

export function ChatInput({ value, onChangeText, onSend, disabled = false, recipient, onMentionPress }: ChatInputProps) {
  const canSend = !disabled && value.trim().length > 0;

  return (
    <View style={styles.container}>
      {recipient ? (
        <View style={styles.recipientRow}>
          <Pressable
            onPress={recipient.onPress}
            style={[styles.chip, recipient.isTargeted && styles.chipTargeted]}
            accessibilityRole="button"
            accessibilityLabel={`Destinatário: ${recipient.label}. Toque para alterar`}
          >
            <Ionicons
              name={recipient.isTargeted ? 'person' : 'people'}
              size={14}
              color={recipient.isTargeted ? colors.textOnPrimary : colors.primary}
            />
            <Text style={[styles.chipText, recipient.isTargeted && styles.chipTextTargeted]}>
              Para: {recipient.label}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={recipient.isTargeted ? colors.textOnPrimary : colors.primary}
            />
          </Pressable>
          {recipient.isTargeted ? (
            <Pressable onPress={recipient.onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Enviar para todos">
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        {onMentionPress ? (
          <Pressable
            onPress={onMentionPress}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Mencionar integrante"
          >
            <Ionicons name="at" size={22} color={colors.primary} />
          </Pressable>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Digite uma mensagem"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel="Mensagem"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[styles.sendButton, !canSend && styles.sendDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          accessibilityState={{ disabled: !canSend }}
        >
          <Ionicons name="send" size={20} color={colors.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipTargeted: { backgroundColor: colors.primary },
  chipText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '600' },
  chipTextTargeted: { color: colors.textOnPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    color: colors.text,
    fontSize: fontSize.md,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
