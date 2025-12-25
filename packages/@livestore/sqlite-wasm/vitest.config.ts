import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: import.meta.dirname,
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.toml',
        },
        isolatedStorage: false,
        main: './src/test/setup.ts',
      },
    },
  },
})
