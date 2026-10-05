import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';
import {
  NOTIFICATION_POLICIES,
  NOTIFICATION_POLICY_LABELS,
  type NotificationPolicy,
} from '../types/notification';

type PolicySelectorProps = {
  value: NotificationPolicy;
  onChange: (policy: NotificationPolicy) => void;
  disabled?: boolean;
};

/** Escolha da política de notificações push do grupo (somente o proprietário altera). */
export function PolicySelector({ value, onChange, disabled = false }: PolicySelectorProps) {
  return (
    <View style={styles.container}>
      {NOTIFICATION_POLICIES.map((policy) => {
        const selected = policy === value;
        const { title, description } = NOTIFICATION_POLICY_LABELS[policy];
        return (
          <Pressable
            key={policy}
            onPress={() => onChange(policy)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.primary : colors.textMuted}
            />
            <View style={styles.texts}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.6 },
  texts: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  description: { color: colors.textMuted, fontSize: fontSize.xs },
});
