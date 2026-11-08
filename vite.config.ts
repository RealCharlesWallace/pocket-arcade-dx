import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base path so the built bundle works on any GitHub Pages repo URL
  // (e.g., https://<username>.github.io/<repo-name>/) or custom domain.
  base: './',
  optimizeDeps: {
    include: ['serverboy/src/gameboy_core/gameboy.js'],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
    commonjsOptions: {
      include: [/serverboy/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});
