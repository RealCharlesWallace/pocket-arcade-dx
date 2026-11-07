import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base path so the built bundle works on any GitHub Pages repo URL
  // (e.g., https://<username>.github.io/<repo-name>/) or custom domain.
  base: './',
});
