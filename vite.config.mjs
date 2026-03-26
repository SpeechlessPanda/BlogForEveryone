import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    root: path.resolve(__dirname, 'src/renderer'),
    base: './',
    plugins: [vue()],
    build: {
        outDir: path.resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true
    },
    server: {
        port: 5173,
        strictPort: true
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/renderer/src')
        }
    }
});
