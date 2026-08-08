import { defineConfig } from 'vite'

// Relative base so the build works both at a domain root and under a
// GitHub Pages project path (https://<user>.github.io/vibe-one/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
