import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts'],
    environment: 'node',
    // Todos os arquivos compartilham os mesmos emuladores; rodar em sequência evita interferência.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
