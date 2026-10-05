import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type AvatarProps = {
  /** URL da foto (Firebase Storage). Vazia/ausente ou com falha de carregamento → imagem padrão. */
  uri?: string | null;
  size?: number;
  /** `group` usa o ícone de grupo como imagem padrão. */
  kind?: 'user' | 'group';
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Foto de perfil/grupo com imagem padrão quando indisponível ou quando falha ao carregar. */
export function Avatar({ uri, size = 48, kind = 'user', onPress, accessibilityLabel }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // Uma nova URL merece uma nova tentativa de carregamento.
  useEffect(() => setFailed(false), [uri]);

  const showPhoto = Boolean(uri) && !failed;
  const content = showPhoto ? (
    <Image
      source={{ uri: uri ?? undefined }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons
        name={kind === 'group' ? 'people' : 'person'}
        size={size * 0.55}
        color={colors.avatarFallbackIcon}
      />
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={accessibilityLabel} hitSlop={6}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.avatarFallback, alignItems: 'center', justifyContent: 'center' },
});
