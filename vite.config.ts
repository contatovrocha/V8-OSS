import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Caminhos relativos: o build funciona na raiz do domínio ou em subpastas (ex.: GitHub Pages).
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
})
