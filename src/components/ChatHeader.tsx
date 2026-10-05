import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing } from '../theme';
import { Avatar } from './Avatar';

type ChatHeaderProps = {
  title: string;
  subtitle?: string;
  photoUrl?: string;
  kind: 'user' | 'group';
  /** Ao tocar na foto: perfil do participante (individual) ou lista de integrantes (grupo). */
  onPhotoPress: () => void;
};

/** Título do cabeçalho do chat: foto tocável + nome da pessoa/grupo. */
export function ChatHeader({ title, subtitle, photoUrl, kind, onPhotoPress }: ChatHeaderProps) {
  return (
    <View style={styles.container}>
      <Avatar
        uri={photoUrl}
        kind={kind}
        size={36}
        onPress={onPhotoPress}
        accessibilityLabel={kind === 'group' ? 'Ver integrantes do grupo' : `Ver perfil de ${title}`}
      />
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 260 },
  texts: { flexShrink: 1 },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.xs },
});
