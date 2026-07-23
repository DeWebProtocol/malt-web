import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    environmentOptions: {
      happyDOM: {
        url: 'https://malt.example/app'
      }
    },
    include: ['tests/**/*.test.mjs'],
    restoreMocks: true
  }
})
