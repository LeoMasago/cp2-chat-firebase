import { defineConfig } from 'vitest/config';

// Testes unitários das regras puras do app (utils). A API tem a sua própria suíte em server/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
