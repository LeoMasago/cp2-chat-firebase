import { Banner } from './Banner';

/** Aviso exibido enquanto o app está sem conexão com o Realtime Database. */
export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <Banner
      tone="warning"
      message="Sem conexão. As mensagens enviadas serão entregues quando a internet voltar."
    />
  );
}
