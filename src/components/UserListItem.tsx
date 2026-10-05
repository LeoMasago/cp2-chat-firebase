import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '../theme';
import type { PublicProfile } from '../types/user';
import { Avatar } from './Avatar';

type UserListItemProps = {
  user: PublicProfile;
  onPress: (user: PublicProfile) => void;
  /** Exibe uma caixa de seleção (modo de escolha de integrantes). */
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

function UserListItemComponent({ user, onPress, selectable = false, selected = false, disabled = false, disabledReason }: UserListItemProps) {
  return (
    <Pressable
      onPress={() => onPress(user)}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={{ checked: selectable ? selected : undefined, disabled }}
      accessibilityLabel={user.name}
    >
      <Avatar uri={user.photoUrl} size={44} />
      <View style={styles.texts}>
        <Text style={styles.name} numberOfLines={1}>
          {user.name}
        </Text>
        {disabledReason ? <Text style={styles.reason}>{disabledReason}</Text> : null}
      </View>
      {selectable ? (
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={24}
          color={selected ? colors.primary : colors.textMuted}
        />
      ) : (
        <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
      )}
    </Pressable>
  );
}

export const UserListItem = memo(UserListItemComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.5 },
  texts: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: fontSize.md, fontWeight: '500' },
  reason: { color: colors.textMuted, fontSize: fontSize.xs },
});
