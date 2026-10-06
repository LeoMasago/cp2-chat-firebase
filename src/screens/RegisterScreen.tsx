import { useCallback, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View, type TextInput } from 'react-native';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { FormScreen } from '../components/FormScreen';
import { PhotoPicker } from '../components/PhotoPicker';
import { TextField } from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import { colors, fontSize, spacing } from '../theme';
import type { PickedImage } from '../types/media';
import type { ScreenProps } from '../types/navigation';
import { getErrorMessage } from '../utils/errors';
import {
  maskBirthDate,
  maskPhone,
  onlyDigits,
  parseBirthDate,
  validateBirthDate,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from '../utils/validation';

type FormErrors = Partial<Record<'name' | 'email' | 'phone' | 'birthDate' | 'password' | 'confirmation', string>>;

export function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { register } = useAuth();
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  const handleSubmit = useCallback(async () => {
    const nextErrors: FormErrors = {};
    const fieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      phone: validatePhone(phone),
      birthDate: validateBirthDate(birthDate),
      password: validatePassword(password),
      confirmation: validatePasswordConfirmation(password, confirmation),
    };
    for (const [field, message] of Object.entries(fieldErrors)) {
      if (message) nextErrors[field as keyof FormErrors] = message;
    }
    setErrors(nextErrors);
    setSubmitError(null);
    const isoBirthDate = parseBirthDate(birthDate);
    if (Object.keys(nextErrors).length > 0 || !isoBirthDate) return;

    setLoading(true);
    try {
      const result = await register({
        name,
        email,
        password,
        phoneNumber: onlyDigits(phone),
        birthDate: isoBirthDate,
        photo,
      });
      if (result.photoUploadFailed) {
        Alert.alert(
          'Conta criada',
          'Não foi possível enviar sua foto agora. Você pode escolher uma foto depois, no seu perfil.',
        );
      }
      // Conta criada: o AuthContext detecta a sessão e o navegador abre as conversas.
    } catch (error) {
      setSubmitError(getErrorMessage(error));
      setLoading(false);
    }
  }, [name, email, phone, birthDate, password, confirmation, photo, register]);

  return (
    <FormScreen keyboardVerticalOffset={64}>
      <View style={styles.photo}>
        <PhotoPicker picked={photo} onPick={setPhoto} label="Escolher foto de perfil" />
        <Text style={styles.hint}>A foto é opcional. Sem foto, usamos uma imagem padrão.</Text>
      </View>

      <TextField
        label="Nome"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        placeholder="Seu nome completo"
      />
      <TextField
        ref={emailRef}
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        placeholder="voce@exemplo.com"
      />
      <TextField
        ref={phoneRef}
        label="Celular"
        value={phone}
        onChangeText={(text) => setPhone(maskPhone(text))}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        returnKeyType="next"
        onSubmitEditing={() => birthRef.current?.focus()}
        placeholder="(11) 91234-5678"
      />
      <TextField
        ref={birthRef}
        label="Data de nascimento"
        value={birthDate}
        onChangeText={(text) => setBirthDate(maskBirthDate(text))}
        error={errors.birthDate}
        keyboardType="number-pad"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="DD/MM/AAAA"
      />
      <TextField
        ref={passwordRef}
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        returnKeyType="next"
        onSubmitEditing={() => confirmationRef.current?.focus()}
        placeholder="Mínimo de 6 caracteres"
      />
      <TextField
        ref={confirmationRef}
        label="Confirmar senha"
        value={confirmation}
        onChangeText={setConfirmation}
        error={errors.confirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        placeholder="Repita a senha"
      />

      {submitError ? <ErrorMessage variant="inline" message={submitError} /> : null}

      <Button title="Criar conta" onPress={handleSubmit} loading={loading} />
      <Button title="Já tenho conta" variant="ghost" onPress={() => navigation.goBack()} disabled={loading} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: 'center', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' },
});
