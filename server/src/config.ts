import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  /** Credenciais da conta de serviço (Firebase Admin SDK) — somente na hospedagem. */
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_DATABASE_URL: z.url(),
  /** Token opcional do Expo Push Service (só necessário se "enhanced security" estiver ligado). */
  EXPO_ACCESS_TOKEN: z.string().optional(),
  /** Inclui um trecho do texto da mensagem no corpo do push. */
  NOTIFICATION_PREVIEW: booleanFromEnv,
  /** Quantos proxies confiar (Render/Cloud Run = 1) para obter o IP real. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
});

export type AppConfig = {
  port: number;
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    databaseURL: string;
  };
  expoAccessToken: string | undefined;
  notificationPreview: boolean;
  trustProxy: number;
};

/** Valida as variáveis de ambiente e falha cedo com uma mensagem clara. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${missing}`);
  }
  const values = parsed.data;
  return {
    port: values.PORT,
    firebase: {
      projectId: values.FIREBASE_PROJECT_ID,
      clientEmail: values.FIREBASE_CLIENT_EMAIL,
      // Hospedagens costumam guardar a chave com "\n" literal.
      privateKey: values.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      databaseURL: values.FIREBASE_DATABASE_URL,
    },
    expoAccessToken: values.EXPO_ACCESS_TOKEN,
    notificationPreview: values.NOTIFICATION_PREVIEW,
    trustProxy: values.TRUST_PROXY,
  };
}
