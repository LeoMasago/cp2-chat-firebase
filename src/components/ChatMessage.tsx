import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../theme';
import type { ChatMessage as ChatMessageData } from '../types/chat';
import { formatTime } from '../utils/date';

type ChatMessageProps = {
  message: ChatMessageData;
  isMine: boolean;
  /** Nome do autor, exibido em mensagens recebidas de grupos. */
  authorName?: string;
  /** Nome do integrante a quem a mensagem foi direcionada (grupos). */
  targetName?: string;
};

function ChatMessageComponent({ message, isMine, authorName, targetName }: ChatMessageProps) {
  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowOther]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {!isMine && authorName ? <Text style={styles.author}>{authorName}</Text> : null}
        {targetName ? (
          <Text style={[styles.target, isMine && styles.targetMine]}>Para @{targetName}</Text>
        ) : null}
        <Text style={[styles.text, isMine && styles.textMine]}>{message.text}</Text>
        <Text style={[styles.time, isMine && styles.timeMine]}>{formatTime(message.createdAt)}</Text>
      </View>
    </View>
  );
}

export const ChatMessage = memo(ChatMessageComponent);

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: 3, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  bubbleMine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  author: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700' },
  target: { color: colors.textMuted, fontSize: fontSize.xs, fontStyle: 'italic' },
  targetMine: { color: '#C7D2FE' },
  text: { color: colors.text, fontSize: fontSize.md },
  textMine: { color: colors.textOnPrimary },
  time: { alignSelf: 'flex-end', color: colors.textMuted, fontSize: 11 },
  timeMine: { color: '#C7D2FE' },
});
