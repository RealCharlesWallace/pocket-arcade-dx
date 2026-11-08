import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base path so the built bundle works on any GitHub Pages repo URL
  // (e.g., https://<username>.github.io/<repo-name>/) or custom domain.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
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
