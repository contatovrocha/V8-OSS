import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

// VITE_TARGET=artifact gera um único HTML autocontido (JS e CSS embutidos) para hospedagem como página única.
const singleFile = process.env.VITE_TARGET === 'artifact'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(singleFile ? [viteSingleFile()] : [])],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Caminhos relativos: o build funciona na raiz do domínio ou em subpastas (ex.: GitHub Pages).
  base: './',
  build: { chunkSizeWarningLimit: 1500, ...(singleFile ? { outDir: 'dist-artifact' } : {}) },
})
