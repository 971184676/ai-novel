import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import os from 'node:os';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
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
    // Clear dist before each build to avoid stale hashed assets
    emptyOutDir: true,
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
            if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-router-dom' || pkg === 'scheduler') return 'vendor-react';
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