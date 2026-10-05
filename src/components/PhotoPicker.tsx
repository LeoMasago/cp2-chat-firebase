import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useImagePicker } from '../hooks/useImagePicker';
import { colors, fontSize, spacing } from '../theme';
import type { PickedImage } from '../types/media';
import { Avatar } from './Avatar';

type PhotoPickerProps = {
  /** Foto já salva (URL) — exibida enquanto nenhuma nova imagem for escolhida. */
  currentUrl?: string;
  /** Nova imagem escolhida (arquivo local), ainda não enviada. */
  picked: PickedImage | null;
  onPick: (image: PickedImage) => void;
  kind?: 'user' | 'group';
  label?: string;
  size?: number;
};

/** Avatar com botão para escolher uma foto na galeria (pede e trata a permissão). */
export function PhotoPicker({ currentUrl, picked, onPick, kind = 'user', label = 'Escolher foto', size = 104 }: PhotoPickerProps) {
  const { pickImage, error, permissionBlocked, openSettings } = useImagePicker();

  const handlePress = async () => {
    const image = await pickImage();
    if (image) onPick(image);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel={label}>
        <Avatar uri={picked?.uri ?? currentUrl} size={size} kind={kind} />
        <View style={styles.camera}>
          <Ionicons name="camera" size={16} color={colors.textOnPrimary} />
        </View>
      </Pressable>
      <Text style={styles.label}>{picked ? 'Foto selecionada' : label}</Text>
      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.error}>{error}</Text>
          {permissionBlocked ? (
            <Pressable onPress={openSettings} accessibilityRole="button">
              <Text style={styles.settings}>Abrir configurações</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  label: { color: colors.textMuted, fontSize: fontSize.sm },
  errorBox: { alignItems: 'center', gap: spacing.xs },
  error: { color: colors.danger, fontSize: fontSize.xs, textAlign: 'center' },
  settings: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700', textDecorationLine: 'underline' },
});
