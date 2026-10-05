import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';
import { Avatar } from './Avatar';

type GroupMemberItemProps = {
  uid: string;
  name: string;
  photoUrl?: string;
  isOwner?: boolean;
  isCurrentUser?: boolean;
  onPress?: (uid: string) => void;
  /** Quando informado, exibe o botão de remover (somente o proprietário, para outros integrantes). */
  onRemove?: (uid: string) => void;
};

function GroupMemberItemComponent({ uid, name, photoUrl, isOwner = false, isCurrentUser = false, onPress, onRemove }: GroupMemberItemProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress ? () => onPress(uid) : undefined}
        disabled={!onPress}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${name}`}
      >
        <Avatar uri={photoUrl} size={44} />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
            {isCurrentUser ? ' (você)' : ''}
          </Text>
          {isOwner ? (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerText}>Proprietário</Text>
            </View>
          ) : null}
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={() => onRemove(uid)}
          hitSlop={8}
          style={styles.remove}
          accessibilityRole="button"
          accessibilityLabel={`Remover ${name} do grupo`}
        >
          <Ionicons name="close-circle" size={24} color={colors.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

export const GroupMemberItem = memo(GroupMemberItemComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texts: { flex: 1, gap: 2, alignItems: 'flex-start' },
  name: { color: colors.text, fontSize: fontSize.md, fontWeight: '500' },
  ownerBadge: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  ownerText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  remove: { paddingLeft: spacing.md },
});
