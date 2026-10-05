import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { PickedImage } from '../types/media';
import { AppError } from '../utils/errors';
import { storage } from './firebase';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/**
 * Envia a imagem escolhida na galeria ao Firebase Storage e devolve a URL final.
 * Somente essa URL é gravada no Firestore (nunca Base64).
 */
async function uploadImage(directory: string, filePrefix: string, image: PickedImage): Promise<string> {
  const contentType = image.mimeType && EXTENSIONS[image.mimeType] ? image.mimeType : 'image/jpeg';
  try {
    const response = await fetch(image.uri);
    const blob = await response.blob();
    const fileRef = ref(storage, `${directory}/${filePrefix}${Date.now()}.${EXTENSIONS[contentType]}`);
    await uploadBytes(fileRef, blob, { contentType });
    return await getDownloadURL(fileRef);
  } catch {
    throw new AppError(
      'image/upload-failed',
      'Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.',
    );
  }
}

/** `profilePhotos/{uid}/...` — regra do Storage: somente o próprio usuário envia. */
export function uploadProfilePhoto(uid: string, image: PickedImage): Promise<string> {
  return uploadImage(`profilePhotos/${uid}`, '', image);
}

/** `groupPhotos/{uidDoProprietario}/...` — regra do Storage: somente o proprietário envia. */
export function uploadGroupPhoto(ownerUid: string, groupId: string, image: PickedImage): Promise<string> {
  return uploadImage(`groupPhotos/${ownerUid}`, `${groupId}-`, image);
}
