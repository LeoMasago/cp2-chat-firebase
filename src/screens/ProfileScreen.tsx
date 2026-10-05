import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { Loading } from '../components/Loading';
import { PhotoPicker } from '../components/PhotoPicker';
import { useAuth, useCurrentUser } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { usePublicProfiles } from '../hooks/useUsers';
import {
  getPermissionState,
  isDeviceNotificationsEnabled,
  registerDevice,
  setDeviceNotificationsEnabled,
  type PermissionState,
} from '../services/notificationService';
import { updateProfilePhoto } from '../services/userService';
import { colors, fontSize, radius, spacing } from '../theme';
import type { PickedImage } from '../types/media';
import type { ScreenProps } from '../types/navigation';
import { getErrorMessage } from '../utils/errors';
import { formatBirthDate, formatPhone } from '../utils/validation';

type InfoRowProps = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null };

/** Campo do perfil; quando o dado não está disponível, exibe um texto explicativo. */
function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, !value && styles.infoUnavailable]}>{value ?? 'Indisponível'}</Text>
      </View>
    </View>
  );
}

/** Seção de preferências de push do próprio usuário (somente no perfil próprio). */
function NotificationSettings({ uid }: { uid: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([isDeviceNotificationsEnabled(uid), getPermissionState()])
      .then(([deviceEnabled, permissionState]) => {
        if (cancelled) return;
        setEnabled(deviceEnabled);
        setPermission(permissionState);
      })
      .catch(() => {
        if (!cancelled) setMessage('Não foi possível ler as preferências de notificação.');
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const toggle = useCallback(
    async (next: boolean) => {
      setBusy(true);
      setMessage(null);
      try {
        if (next && enabled === null) {
          const result = await registerDevice(uid);
          if (result.status !== 'registered') {
            setMessage(
              result.status === 'denied'
                ? 'Permissão de notificações negada. Ative nas configurações do aparelho.'
                : result.status === 'unsupported' || result.status === 'no_token'
                  ? result.reason
                  : result.message,
            );
            return;
          }
        } else {
          await setDeviceNotificationsEnabled(uid, next);
        }
        setEnabled(next);
        setPermission(await getPermissionState());
      } catch (toggleError) {
        setMessage(getErrorMessage(toggleError));
      } finally {
        setBusy(false);
      }
    },
    [uid, enabled],
  );

  return (
    <View style={styles.card}>
      <View style={styles.switchRow}>
        <View style={styles.infoTexts}>
          <Text style={styles.cardTitle}>Notificações neste aparelho</Text>
          <Text style={styles.infoLabel}>Receber push de novas mensagens</Text>
        </View>
        <Switch value={enabled === true} onValueChange={toggle} disabled={busy} />
      </View>
      {permission === 'denied' ? (
        <Banner
          tone="warning"
          message="A permissão de notificações está bloqueada no sistema."
          actionLabel="Abrir configurações"
          onAction={() => {
            Linking.openSettings().catch(() => undefined);
          }}
        />
      ) : null}
      {message ? <Banner tone="error" message={message} onDismiss={() => setMessage(null)} /> : null}
    </View>
  );
}

/** Perfil de um usuário. Sem `userId`, mostra o perfil do usuário logado. */
export function ProfileScreen({ route }: ScreenProps<'Profile'>) {
  const currentUser = useCurrentUser();
  const { signOut } = useAuth();
  const targetUid = route.params?.userId ?? currentUser.uid;
  const isOwnProfile = targetUid === currentUser.uid;

  const { state, reload, updatePhoto } = useProfile(currentUser.uid, targetUid);
  const publicFallback = usePublicProfiles(state.status === 'error' && state.forbidden ? [targetUid] : []);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const changePhoto = useCallback(
    async (image: PickedImage) => {
      setPhotoBusy(true);
      setPhotoError(null);
      try {
        updatePhoto(await updateProfilePhoto(currentUser.uid, image));
      } catch (uploadError) {
        setPhotoError(getErrorMessage(uploadError));
      } finally {
        setPhotoBusy(false);
      }
    },
    [currentUser.uid, updatePhoto],
  );

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sair da conta', 'Você deixará de receber notificações neste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          signOut().catch((signOutError: unknown) => Alert.alert('Não foi possível sair', getErrorMessage(signOutError)));
        },
      },
    ]);
  }, [signOut]);

  if (state.status === 'loading') return <Loading message="Carregando perfil..." fullScreen />;

  if (state.status === 'error') {
    const publicProfile = publicFallback[targetUid];
    return (
      <View style={styles.errorContainer}>
        {state.forbidden && publicProfile ? (
          <View style={styles.header}>
            <Avatar uri={publicProfile.photoUrl} size={96} />
            <Text style={styles.name}>{publicProfile.name}</Text>
          </View>
        ) : null}
        <ErrorMessage
          message={
            state.forbidden
              ? 'Os dados cadastrais só ficam disponíveis para quem compartilha uma conversa individual ou um grupo com este usuário.'
              : state.message
          }
          onRetry={state.forbidden ? undefined : reload}
        />
      </View>
    );
  }

  const { profile } = state;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {isOwnProfile ? (
          <PhotoPicker currentUrl={profile.photoUrl} picked={null} onPick={changePhoto} label="Alterar foto" />
        ) : (
          <Avatar uri={profile.photoUrl} size={104} />
        )}
        <Text style={styles.name}>{profile.name}</Text>
        {photoBusy ? <Text style={styles.infoLabel}>Enviando foto...</Text> : null}
        {photoError ? <ErrorMessage variant="inline" message={photoError} /> : null}
      </View>

      <View style={styles.card}>
        <InfoRow icon="mail-outline" label="E-mail" value={profile.email} />
        <InfoRow icon="call-outline" label="Celular" value={profile.phoneNumber ? formatPhone(profile.phoneNumber) : null} />
        <InfoRow icon="calendar-outline" label="Data de nascimento" value={profile.birthDate ? formatBirthDate(profile.birthDate) : null} />
      </View>

      {isOwnProfile ? (
        <>
          <NotificationSettings uid={currentUser.uid} />
          <Button title="Sair da conta" variant="danger" onPress={confirmSignOut} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  errorContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  header: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  name: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.lg, overflow: 'hidden' },
  cardTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoTexts: { flex: 1, gap: 2 },
  infoLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  infoValue: { color: colors.text, fontSize: fontSize.md },
  infoUnavailable: { color: colors.textMuted, fontStyle: 'italic' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
