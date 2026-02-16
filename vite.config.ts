import { defineConfig } from 'vite'

export default defineConfig({
    base: './', // Relative base path for GitHub Pages
    server: {
        port: 5173,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
})
