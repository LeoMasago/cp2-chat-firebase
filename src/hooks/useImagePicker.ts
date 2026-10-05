import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import type { PickedImage } from '../types/media';

const DENIED_MESSAGE = 'Para escolher uma foto, permita o acesso à galeria nas configurações do aparelho.';
const GENERIC_MESSAGE = 'Não foi possível abrir a galeria. Tente novamente.';

/**
 * Seleção de foto na galeria: solicita (e trata) a permissão e devolve o arquivo local escolhido.
 * A imagem é enviada ao Firebase Storage por `storageService`; nunca é convertida em Base64.
 */
export function useImagePicker() {
  const [error, setError] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const pickImage = useCallback(async (): Promise<PickedImage | null> => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPermissionBlocked(!permission.canAskAgain);
        setError(DENIED_MESSAGE);
        return null;
      }
      setPermissionBlocked(false);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return null;
      const asset = result.assets[0];
      if (!asset) return null;
      return { uri: asset.uri, mimeType: asset.mimeType ?? undefined };
    } catch {
      setError(GENERIC_MESSAGE);
      return null;
    }
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => undefined);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { pickImage, error, permissionBlocked, openSettings, clearError };
}
