import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import os from 'node:os';
import { copyFileSync, existsSync } from 'node:fs';

// https://vitejs.dev/config/
export default defineConfig({
  // 使用相对路径，同时支持根目录和子目录部署（GitHub Pages / Cloudflare Pages 等）
  base: './',
  plugins: [
    react(),
    // Vite by default ignores files starting with `_` in `public/` (e.g. `_headers`,
    // `_redirects`). We need them in `dist/` so Cloudflare Pages picks them up.
    {
      name: 'copy-cloudflare-config',
      closeBundle() {
        const files = ['_headers', '_redirects', '_routes.json', '.nojekyll'];
        for (const f of files) {
          const src = path.resolve(__dirname, 'public', f);
          const dest = path.resolve(__dirname, 'dist', f);
          if (existsSync(src)) copyFileSync(src, dest);
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: 'localhost',
    strictPort: true,
  },
  build: {
    // We clear `dist/` manually before build to avoid the Windows EPERM
    // error from Vite's `rmSync` when files are temporarily locked.
    emptyOutDir: false,
    // Split vendor bundles for faster initial load
    rollupOptions: {
      output: {
        manualChunks(id) {
            // Only chunk node_modules
            if (typeof id !== 'string' || !id.includes('node_modules')) return;
            // Normalize separators for cross-platform matching
            const norm = id.replace(/\\/g, '/');
            const match = norm.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
            if (!match) return;
            const pkg = match[1];
            // Large UI / utility libraries — one chunk each
            if (pkg.startsWith('@xyflow')) return 'vendor-xyflow';
            if (pkg.startsWith('@tiptap')) return 'vendor-tiptap';
            if (pkg.startsWith('@dnd-kit')) return 'vendor-dnd';
            if (pkg.startsWith('@radix-ui')) return 'vendor-radix';
            if (pkg.startsWith('@hookform')) return 'vendor-forms';
            // React ecosystem — keep ALL related packages in one chunk.
            // react-router-dom internally depends on @remix-run/router and
            // react-router (a separate package from react-router-dom). Both
            // of those use React APIs (createContext etc.) at module top
            // level, so they must live with React. Otherwise vendor-react and
            // vendor-other form a circular import, and ES module live
            // bindings leave React = undefined when vendor-other's top-level
            // code runs, breaking createContext and crashing the app.
            if (
              pkg === 'react' ||
              pkg === 'react-dom' ||
              pkg === 'react-router' ||
              pkg === 'react-router-dom' ||
              pkg === 'scheduler' ||
              pkg === '@remix-run/router'
            ) return 'vendor-react';
            if (pkg === 'konva' || pkg === 'react-konva') return 'vendor-konva';
            if (pkg === 'dexie' || pkg === 'dexie-react-hooks') return 'vendor-dexie';
            if (pkg === 'lucide-react') return 'vendor-icons';
            if (pkg === 'zod' || pkg === 'react-hook-form') return 'vendor-forms';
            if (pkg === 'zustand') return 'vendor-state';
            if (pkg === 'docx') return 'vendor-docx';
            if (pkg.startsWith('tippy.js')) return 'vendor-tippy';
            if (pkg === 'clsx' || pkg === 'class-variance-authority' || pkg === 'tailwind-merge') return 'vendor-utils';
            // Everything else — one shared vendor chunk
            return 'vendor-other';
          },
      },
    },
  },
  // Place cache outside the project to avoid Windows EPERM rename issues in this sandbox
  cacheDir: path.join(os.tmpdir(), 'novel-creator-vite-cache'),
});
