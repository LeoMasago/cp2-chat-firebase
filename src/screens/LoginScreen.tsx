import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';
import { Button } from '../components/Button';
import { ErrorMessage } from '../components/ErrorMessage';
import { FormScreen } from '../components/FormScreen';
import { TextField } from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import { colors, fontSize, spacing } from '../theme';
import type { ScreenProps } from '../types/navigation';
import { getErrorMessage } from '../utils/errors';
import { validateEmail } from '../utils/validation';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = useCallback(async () => {
    const nextEmailError = validateEmail(email);
    const nextPasswordError = password ? null : 'Informe a senha.';
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setSubmitError(null);
    if (nextEmailError || nextPasswordError) return;

    setLoading(true);
    try {
      await signIn(email, password);
      // O AuthContext detecta a sessão e o navegador troca para as telas protegidas.
    } catch (error) {
      setSubmitError(getErrorMessage(error));
      setLoading(false);
    }
  }, [email, password, signIn]);

  return (
    <FormScreen>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Ionicons name="chatbubbles" size={40} color={colors.textOnPrimary} />
        </View>
        <Text style={styles.title}>CP2 Chat</Text>
        <Text style={styles.subtitle}>Entre com seu e-mail e senha</Text>
      </View>

      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="voce@exemplo.com"
      />
      <TextField
        ref={passwordRef}
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        placeholder="Sua senha"
      />

      {submitError ? <ErrorMessage variant="inline" message={submitError} /> : null}

      <Button title="Entrar" onPress={handleSubmit} loading={loading} />
      <Button title="Criar conta" variant="ghost" onPress={() => navigation.navigate('Register')} disabled={loading} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.md },
});
