import fs from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base path so the built bundle works on any GitHub Pages repo URL
  // (e.g., https://<username>.github.io/<repo-name>/) or custom domain.
  base: './',
  plugins: [
    {
      name: 'iphone-live-diag',
      configureServer(server) {
        server.middlewares.use('/__diag', (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const forwarded = req.headers['x-forwarded-for'];
                const remoteIp =
                  (Array.isArray(forwarded) ? forwarded[0] : forwarded) ||
                  req.socket.remoteAddress ||
                  'unknown';
                const screenPng = parsed.screenPng as string | undefined;
                delete parsed.screenPng;
                const record = { remoteIp, ...parsed };
                const isLanPhone = !remoteIp.includes('127.0.0.1') && !remoteIp.includes('::1');
                const targetJson = isLanPhone ? '/tmp/iphone_physical_diag.json' : '/tmp/iphone_sim_diag.json';
                const targetPng = isLanPhone ? '/tmp/iphone_physical_lcd.png' : '/tmp/iphone_sim_lcd.png';
                fs.writeFileSync(targetJson, JSON.stringify(record, null, 2));
                if (screenPng && screenPng.startsWith('data:image/png;base64,')) {
                  fs.writeFileSync(targetPng, Buffer.from(screenPng.replace('data:image/png;base64,', ''), 'base64'));
                }
              } catch {
                // Ignore malformed JSON
              }
              res.statusCode = 204;
              res.end();
            });
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          const phys = fs.existsSync('/tmp/iphone_physical_diag.json')
            ? JSON.parse(fs.readFileSync('/tmp/iphone_physical_diag.json', 'utf8'))
            : null;
          const sim = fs.existsSync('/tmp/iphone_sim_diag.json')
            ? JSON.parse(fs.readFileSync('/tmp/iphone_sim_diag.json', 'utf8'))
            : null;
          res.end(JSON.stringify({ physicalIphone: phys, simulator: sim }, null, 2));
        });
      },
    },
  ],
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
