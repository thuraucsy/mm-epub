import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // base: process.env.NODE_ENV === 'production' ? '/mm-epub/' : '/', // since i use my own domain
})
