import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';
import type { ConversationSummary } from '../types/chat';
import { formatConversationTime } from '../utils/date';
import { Avatar } from './Avatar';

type ConversationItemProps = {
  conversation: ConversationSummary;
  currentUserId: string;
  onPress: (conversation: ConversationSummary) => void;
};

function ConversationItemComponent({ conversation, currentUserId, onPress }: ConversationItemProps) {
  const isGroup = conversation.type === 'group';
  const last = conversation.lastMessage;
  const preview = last
    ? `${last.senderId === currentUserId ? 'Você: ' : ''}${last.text}`
    : 'Nenhuma mensagem ainda';

  return (
    <Pressable
      onPress={() => onPress(conversation)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${isGroup ? 'Grupo' : 'Conversa com'} ${conversation.title}`}
    >
      <Avatar uri={conversation.photoUrl} kind={isGroup ? 'group' : 'user'} size={52} />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons
            name={isGroup ? 'people' : 'person'}
            size={14}
            color={isGroup ? colors.primary : colors.textMuted}
            accessibilityLabel={isGroup ? 'Grupo' : 'Conversa individual'}
          />
          <Text style={styles.title} numberOfLines={1}>
            {conversation.title}
          </Text>
          <View style={[styles.badge, isGroup ? styles.badgeGroup : styles.badgeDirect]}>
            <Text style={[styles.badgeText, isGroup ? styles.badgeTextGroup : null]}>
              {isGroup ? 'Grupo' : 'Individual'}
            </Text>
          </View>
        </View>
        <Text style={[styles.preview, !last && styles.previewEmpty]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {last ? <Text style={styles.time}>{formatConversationTime(last.createdAt)}</Text> : null}
    </Pressable>
  );
}

export const ConversationItem = memo(ConversationItemComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.primarySoft },
  content: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flexShrink: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: '600' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  badgeGroup: { backgroundColor: colors.primarySoft },
  badgeDirect: { backgroundColor: colors.background },
  badgeText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  badgeTextGroup: { color: colors.primary },
  preview: { color: colors.textMuted, fontSize: fontSize.md },
  previewEmpty: { fontStyle: 'italic' },
  time: { color: colors.textMuted, fontSize: fontSize.xs, alignSelf: 'flex-start', paddingTop: 4 },
});
